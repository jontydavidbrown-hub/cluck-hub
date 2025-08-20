// src/pages/Farms.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useFarm } from "../lib/FarmContext";
import { dataGet, dataSet, dataDelete } from "../lib/storage";

type Farm = { id: string; name: string; role?: MemberRole };
type MemberRole = "owner" | "admin" | "manager" | "worker" | "viewer";
type Member = { id: string; email: string; role: MemberRole; status?: "active" | "invited" };
type Invite = { farmId: string; farmName?: string; role?: MemberRole; inviter?: string; createdAt?: string };

const roleOptions: { value: MemberRole; label: string; desc: string }[] = [
  { value: "owner",   label: "Owner",   desc: "Full control; manage billing and owners." },
  { value: "admin",   label: "Admin",   desc: "Manage farms, members, and all data." },
  { value: "manager", label: "Manager", desc: "Operate data, invite workers." },
  { value: "worker",  label: "Worker",  desc: "Add/edit operational data." },
  { value: "viewer",  label: "Viewer",  desc: "Read-only dashboards and records." },
];

// storage key helpers
const kUserRoot = (email: string) => `u/${encodeURIComponent(email)}`;
const kUserFarms = (email: string) => `${kUserRoot(email)}/farms`;
const kUserCurrentFarm = (email: string) => `${kUserRoot(email)}/currentFarm`;
const kFarmMembers = (farmId: string) => `farm/${farmId}/members`;
const kInvites = (email: string) => `invites/${email.toLowerCase()}`;

// detect current user email via a few likely endpoints
async function detectEmail(): Promise<string | null> {
  const candidates = [
    "/.netlify/functions/me",
    "/.netlify/functions/user",
    "/.netlify/functions/session",
    "/api/me",
  ];
  for (const url of candidates) {
    try {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) continue;
      const j: any = await r.json().catch(() => ({}));
      const e = j?.email || j?.user?.email || j?.account?.email || j?.data?.email || j?.profile?.email;
      const s = (e || "").toString().trim().toLowerCase();
      if (/\S+@\S+\.\S+/.test(s)) return s;
    } catch {}
  }
  return null;
}

function uid(): string {
  // @ts-ignore
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const FarmsPage: React.FC = () => {
  const { farms = [], farmId, setFarmId, createFarm, deleteFarm, email: ctxEmail, loading, error } = useFarm();

  // ---------- Create/Delete ----------
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const farmsSorted = useMemo(
    () => [...(farms || [])].sort((a: Farm, b: Farm) => a.name.localeCompare(b.name)),
    [farms]
  );

  async function onCreate() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await createFarm(name);
      setNewName("");
    } finally {
      setBusy(false);
    }
  }
  async function onDelete(id: string) {
    if (!confirm("Delete this farm? This cannot be undone.")) return;
    await deleteFarm(id);
  }

  // ---------- Inviter: send invite ----------
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("viewer");
  const [inviteFarm, setInviteFarm] = useState<string>("");
  const [inviting, setInviting] = useState(false);
  const emailOk = /\S+@\S+\.\S+/.test(inviteEmail);

  async function sendInvite() {
    const targetFarmId = (inviteFarm || farmId || "").toString();
    if (!targetFarmId) return alert("Select the farm to invite the user to.");
    if (!emailOk) return alert("Enter a valid email address.");
    if (!ctxEmail) return alert("Please sign in.");

    setInviting(true);
    try {
      const invitee = inviteEmail.trim().toLowerCase();
      const existing: Invite[] = (await dataGet<Invite[]>(kInvites(invitee))) || [];
      const farmName = farms.find(f => f.id === targetFarmId)?.name || "Farm";
      const next: Invite[] = [
        // keep any different farm invites; replace the same farm invite if present
        ...existing.filter(i => i.farmId !== targetFarmId),
        {
          farmId: targetFarmId,
          farmName,
          role: inviteRole,
          inviter: ctxEmail,
          createdAt: new Date().toISOString(),
        },
      ];
      await dataSet(kInvites(invitee), next);
      setInviteEmail("");
      setInviteRole("viewer");
      alert(`Invite sent to ${invitee} for "${farmName}".`);
    } catch (e: any) {
      alert(`Invite failed: ${e?.message || "unknown error"}`);
    } finally {
      setInviting(false);
    }
  }

  // ---------- Invitee: view & accept/decline ----------
  const [myEmail, setMyEmail] = useState<string>("");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [invErr, setInvErr] = useState<string | null>(null);

  const loadInvites = useCallback(async (override?: string) => {
    setLoadingInvites(true);
    setInvErr(null);
    try {
      const e = (override || myEmail || ctxEmail || (await detectEmail()) || "").toLowerCase();
      setMyEmail(e);
      if (!e) { setInvites([]); setLoadingInvites(false); return; }
      const list = (await dataGet<Invite[]>(kInvites(e))) || [];
      setInvites(list);
    } catch (err: any) {
      setInvErr(err?.message || "Failed to load invites");
    } finally {
      setLoadingInvites(false);
    }
  }, [myEmail, ctxEmail]);

  useEffect(() => { loadInvites(); }, [loadInvites]);

  async function acceptInvite(inv: Invite) {
    try {
      const e = (myEmail || ctxEmail || "").toLowerCase();
      if (!e) return alert("Please enter your email or sign in.");

      // 1) Add invitee to farm members
      const members = (await dataGet<Member[]>(kFarmMembers(inv.farmId))) || [];
      const exists = members.some(m => (m.email || "").toLowerCase() === e);
      if (!exists) {
        const member: Member = { id: uid(), email: e, role: inv.role || "viewer", status: "active" };
        await dataSet(kFarmMembers(inv.farmId), [...members, member]);
      }

      // 2) Add farm to invitee's farm list
      const userFarms = (await dataGet<Farm[]>(kUserFarms(e))) || [];
      const haveFarm = userFarms.some(f => f.id === inv.farmId);
      if (!haveFarm) {
        const farmName = inv.farmName || `Farm ${inv.farmId.slice(0,6)}`;
        await dataSet(kUserFarms(e), [...userFarms, { id: inv.farmId, name: farmName, role: inv.role || "viewer" }]);
      }

      // 3) Make it their current farm so they immediately see data
      await dataSet(kUserCurrentFarm(e), inv.farmId);

      // 4) Remove the invite
      const rest = invites.filter(i => i.farmId !== inv.farmId);
      await dataSet(kInvites(e), rest);
      setInvites(rest);

      // If the current user is the invitee, switch locally too
      if (ctxEmail && ctxEmail.toLowerCase() === e) {
        setFarmId(inv.farmId);
      }
      alert(`Joined "${inv.farmName || "farm"}" as ${inv.role || "viewer"}.`);
    } catch (err: any) {
      alert(`Accept failed: ${err?.message || "unknown error"}`);
    }
  }

  async function declineInvite(inv: Invite) {
    try {
      const e = (myEmail || ctxEmail || "").toLowerCase();
      if (!e) return;
      const rest = invites.filter(i => i.farmId !== inv.farmId);
      await dataSet(kInvites(e), rest);
      setInvites(rest);
    } catch (err: any) {
      alert(`Decline failed: ${err?.message || "unknown error"}`);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Farms</h1>
          <div className="text-xs text-slate-500">
            Signed in as: <span className="font-medium">{ctxEmail || "—"}</span>
          </div>
        </div>
        {farms.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Current farm:</label>
            <select
              className="border rounded-lg px-2 py-1 bg-white/80 shadow-sm"
              value={farmId ?? ""}
              onChange={(e) => setFarmId(e.target.value || null)}
            >
              {farmsSorted.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading && <div className="text-slate-500">Loading…</div>}
      {error && <div className="text-red-600 text-sm">{error}</div>}

      {/* ===== Invitee panel: Your Invites ===== */}
      <div className="p-4 rounded-xl border bg-white space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-lg font-semibold">Your Invites</div>
          <div className="flex gap-2">
            <input
              className="border rounded px-2 py-1 text-sm"
              placeholder="your@email.com"
              value={myEmail}
              onChange={(e) => setMyEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") loadInvites(myEmail); }}
              style={{ minWidth: 220 }}
            />
            <button className="text-sm px-3 py-1 border rounded" onClick={() => loadInvites(myEmail)}>
              Load
            </button>
            <button className="text-sm px-3 py-1 border rounded" onClick={() => loadInvites()}>
              Auto‑detect
            </button>
          </div>
        </div>

        {loadingInvites && <div className="text-sm text-slate-500">Loading invites…</div>}
        {invErr && <div className="text-sm text-red-600">{invErr}</div>}

        {!loadingInvites && invites.length === 0 && (
          <div className="text-sm text-slate-500">No invites for {myEmail || "this account"}.</div>
        )}

        {!loadingInvites && invites.length > 0 && (
          <ul className="space-y-2">
            {invites.map((inv) => (
              <li key={inv.farmId} className="flex items-center justify-between border rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{inv.farmName || "Farm " + inv.farmId.slice(0,6)}</div>
                  <div className="text-xs text-slate-500">
                    Role: {inv.role || "viewer"}
                    {inv.inviter ? ` • Invited by ${inv.inviter}` : ""}
                    {inv.createdAt ? ` • ${new Date(inv.createdAt).toLocaleString()}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1 rounded border bg-green-600 text-white" onClick={() => acceptInvite(inv)}>
                    Accept
                  </button>
                  <button className="px-3 py-1 rounded border" onClick={() => declineInvite(inv)}>
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ===== Your farms ===== */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border bg-white space-y-2">
          <div className="text-sm font-medium text-center">Your farms</div>
          <ul className="text-sm space-y-1">
            {farmsSorted.map((f) => (
              <li key={f.id} className="flex items-center justify-between">
                <span className={["truncate", f.id === farmId ? "font-semibold" : ""].join(" ")}>
                  {f.name}
                </span>
                <div className="flex items-center gap-2">
                  {f.id !== farmId && (
                    <button className="text-xs rounded border px-2 py-1 hover:bg-slate-50" onClick={() => setFarmId(f.id)}>
                      Switch
                    </button>
                  )}
                  <button className="text-xs rounded border px-2 py-1 hover:bg-red-50 text-red-600" onClick={() => onDelete(f.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
            {farms.length === 0 && <li className="text-slate-500 text-center">No farms yet.</li>}
          </ul>
        </div>

        {/* Create new farm */}
        <div className="p-4 rounded-xl border bg-white">
          <div className="text-sm font-medium text-center mb-2">Create new farm</div>
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded px-3 py-2"
              placeholder="Farm name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onCreate(); }}
            />
            <button
              className="rounded bg-slate-900 text-white px-4 py-2 disabled:opacity-60"
              disabled={busy || !newName.trim()}
              onClick={onCreate}
            >
              Create
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500 text-center">
            Data is saved per account & per farm. Switch farms using the selector above.
          </p>
        </div>
      </div>

      {/* ===== Inviter: send invite (farm picker + role) ===== */}
      <div className="p-4 rounded-xl border bg-white space-y-4">
        <div className="text-lg font-semibold text-center">Invite someone to a farm</div>
        <div className="grid md:grid-cols-4 gap-3 items-end">
          <label className="block">
            <div className="text-sm mb-1">Email</div>
            <input
              type="email"
              className="w-full border rounded px-3 py-2"
              placeholder="person@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </label>

          <label className="block">
            <div className="text-sm mb-1">Role</div>
            <select
              className="w-full border rounded px-3 py-2"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as MemberRole)}
            >
              {roleOptions.map(r => (
                <option key={r.value} value={r.value}>
                  {r.label} — {r.desc}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="text-sm mb-1">Invite to farm</div>
            <select
              className="w-full border rounded px-3 py-2"
              value={inviteFarm || farmId || ""}
              onChange={(e) => setInviteFarm(e.target.value)}
            >
              <option value="">— Select a farm —</option>
              {farmsSorted.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex md:justify-end">
            <button
              type="button"
              className="rounded bg-slate-900 text-white px-4 py-2 w-full md:w-auto disabled:opacity-60"
              disabled={!emailOk || !(inviteFarm || farmId) || inviting}
              onClick={sendInvite}
            >
              {inviting ? "Inviting…" : "Send Invite"}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          The invite will appear on the recipient’s Farms page when they sign in with that email. On acceptance,
          they’ll be added as a member and the farm will show in their list across devices.
        </p>
      </div>
    </div>
  );
};

export default FarmsPage;
