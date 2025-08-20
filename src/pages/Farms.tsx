// src/pages/Farms.tsx
import { useEffect, useMemo, useState } from "react";
import { useFarm } from "../lib/FarmContext";
import { useCloudSlice } from "../lib/cloudSlice";

type Farm = { id: string; name?: string };
type MemberRole = "owner" | "admin" | "manager" | "worker" | "viewer";
type Member = {
  id: string;
  email: string;
  role: MemberRole;
  status?: "active" | "invited";
};

type Invite = {
  farmId: string;
  farmName?: string;
  role?: MemberRole;
  inviter?: string;
  createdAt?: string;
};

const roleOptions: { value: MemberRole; label: string; desc: string }[] = [
  { value: "owner",   label: "Owner",   desc: "Full control. Can manage billing and owners." },
  { value: "admin",   label: "Admin",   desc: "Manage farms, members, and all data." },
  { value: "manager", label: "Manager", desc: "Add/edit operational data, invite workers." },
  { value: "worker",  label: "Worker",  desc: "Add/edit data (morts, weights, feed, water)." },
  { value: "viewer",  label: "Viewer",  desc: "Read-only access to dashboards and records." },
];

// Fallback storage key in /data if /members function is not available
const membersBlobKey = (farmId: string) => `farm/${farmId}/members`;
const invitesKey = (email: string) => `invites/${email}`;

// ---------- Helpers ----------
async function fetchJson<T = any>(
  input: RequestInfo,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data?: T; errorText?: string }> {
  try {
    const res = await fetch(input, { credentials: "include", ...init });
    const ct = res.headers.get("content-type") || "";
    const isJSON = ct.includes("application/json");
    const data = isJSON ? await res.json() : undefined;
    if (!res.ok) return { ok: false, status: res.status, data, errorText: (data as any)?.error || res.statusText };
    return { ok: true, status: res.status, data };
  } catch (e: any) {
    return { ok: false, status: 0, errorText: e?.message || "Network error" };
  }
}

async function dataGet<T = any>(key: string) {
  const r = await fetchJson<{ value?: T }>(`/.netlify/functions/data?key=${encodeURIComponent(key)}`);
  if (!r.ok) return undefined;
  return r.data?.value as T | undefined;
}

async function dataSet(key: string, value: any) {
  return fetchJson(`/.netlify/functions/data?key=${encodeURIComponent(key)}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}

async function getCurrentUserEmail(): Promise<string | null> {
  // Try the user function that exists in your repo
  const u = await fetchJson<{ email?: string }>(`/.netlify/functions/user`);
  if (u.ok && u.data?.email) return u.data.email;
  // Fallback (if your auth exposes a different endpoint, add it here)
  return null;
}

// ---------- Component ----------
export default function Farms() {
  const { farms = [], farmId, setFarmId, createFarm, deleteFarm } = useFarm() as any;

  const farmsSorted = useMemo(
    () => [...(farms || [])].sort((a: Farm, b: Farm) => (a?.name || "").localeCompare(b?.name || "")),
    [farms]
  );

  const [newName, setNewName] = useState("");
  const [busyFarm, setBusyFarm] = useState(false);

  async function onCreateFarm() {
    const name = newName.trim();
    if (!name) return;
    setBusyFarm(true);
    try {
      await createFarm?.(name);
      setNewName("");
    } finally {
      setBusyFarm(false);
    }
  }
  async function onDeleteFarm(id: string) {
    if (!confirm("Are you sure you want to delete this farm? This cannot be undone.")) return;
    await deleteFarm?.(id);
  }

  // -------- Members Section --------
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  // Invite form state (for inviting others)
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("viewer");
  const [inviting, setInviting] = useState(false);
  const emailOk = /\S+@\S+\.\S+/.test(inviteEmail);

  // Cloud slice only used to force a refresh when others change farms elsewhere
  const [dummy] = useCloudSlice("farms_dummy_sync", 0);

  async function loadMembers() {
    if (!farmId) { setMembers([]); return; }
    setLoadingMembers(true);
    setMembersError(null);
    // Try primary serverless function
    const url = `/.netlify/functions/members?farmId=${encodeURIComponent(farmId)}`;
    const res = await fetchJson<{ members: Member[] }>(url);
    if (res.ok && Array.isArray(res.data?.members)) {
      setMembers(res.data!.members);
      setLoadingMembers(false);
      return;
    }
    // Fallback to /data key
    const fb = await fetchJson<{ value?: Member[] }>(`/.netlify/functions/data?key=${encodeURIComponent(membersBlobKey(farmId))}`);
    if (fb.ok && Array.isArray(fb.data?.value)) {
      setMembers(fb.data!.value!);
      setLoadingMembers(false);
      return;
    }
    setMembersError(res.errorText || fb.errorText || "Failed to load members");
    setLoadingMembers(false);
  }

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId, dummy]);

  async function saveMembersFallback(next: Member[]) {
    if (!farmId) return;
    await dataSet(membersBlobKey(farmId), next);
  }

  async function invite() {
    if (!farmId) return alert("Please select a farm first.");
    if (!emailOk) return alert("Please enter a valid email address.");
    setInviting(true);
    setMembersError(null);

    // Try serverless function (if present in your project)
    const res = await fetchJson<{ members: Member[] }>(`/.netlify/functions/members`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "invite", farmId, email: inviteEmail.trim(), role: inviteRole }),
    });
    if (res.ok) {
      setInviteEmail("");
      setInviteRole("viewer");
      setMembers(res.data?.members || []);
      setInviting(false);
      return;
    }

    // Fallback: write to /data invites/<email>
    try {
      const email = inviteEmail.trim().toLowerCase();
      const existing: Invite[] = (await dataGet<Invite[]>(invitesKey(email))) || [];
      const farmName = farms.find(f => f.id === farmId)?.name;
      const next: Invite[] = [
        ...existing.filter(i => i.farmId !== String(farmId)),
        { farmId: String(farmId), farmName, role: inviteRole, createdAt: new Date().toISOString() },
      ];
      await dataSet(invitesKey(email), next);
      setInviteEmail("");
      setInviteRole("viewer");
      alert(`Invite sent to ${email}`);
    } catch (e: any) {
      setMembersError(res.errorText || e?.message || "Invite failed");
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(memberId: string, role: MemberRole) {
    if (!farmId) return;
    const res = await fetchJson<{ members: Member[] }>(`/.netlify/functions/members`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateRole", farmId, memberId, role }),
    });
    if (res.ok) { setMembers(res.data?.members || []); return; }
    // Fallback
    const next = members.map(m => m.id === memberId ? { ...m, role } : m);
    await saveMembersFallback(next);
    setMembers(next);
  }

  async function removeMember(memberId: string) {
    if (!farmId) return;
    if (!confirm("Remove this member from the farm?")) return;
    const res = await fetchJson<{ members: Member[] }>(`/.netlify/functions/members`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", farmId, memberId }),
    });
    if (res.ok) { setMembers(res.data?.members || []); return; }
    // Fallback
    const next = members.filter(m => m.id !== memberId);
    await saveMembersFallback(next);
    setMembers(next);
  }

  // -------- Invites (for the current user) --------
  const [myEmail, setMyEmail] = useState<string | null>(null);
  const [myInvites, setMyInvites] = useState<Invite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [invitesError, setInvitesError] = useState<string | null>(null);

  async function loadMyInvites() {
    setLoadingInvites(true);
    setInvitesError(null);
    try {
      const email = myEmail ?? (await getCurrentUserEmail());
      if (!email) { setLoadingInvites(false); return; }
      const invites = (await dataGet<Invite[]>(invitesKey(email.toLowerCase()))) || [];
      // Enrich names from farms list if missing
      const withNames = invites.map(i => i.farmName ? i : { ...i, farmName: farms.find(f => f.id === i.farmId)?.name });
      setMyEmail(email);
      setMyInvites(withNames);
    } catch (e: any) {
      setInvitesError(e?.message || "Failed to load invites");
    } finally {
      setLoadingInvites(false);
    }
  }

  useEffect(() => {
    loadMyInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farms.length]); // reload if farm list changes (names)

  async function acceptInvite(inv: Invite) {
    if (!myEmail) return alert("Please sign in again.");
    try {
      // Add user to farm members (fallback path)
      const current: Member[] = (await dataGet<Member[]>(membersBlobKey(inv.farmId))) || [];
      const exists = current.some(m => m.email?.toLowerCase() === myEmail.toLowerCase());
      if (!exists) {
        const member: Member = {
          id: (globalThis as any).crypto?.randomUUID?.() ?? String(Math.random()).slice(2),
          email: myEmail,
          role: inv.role || "viewer",
          status: "active",
        };
        await dataSet(membersBlobKey(inv.farmId), [...current, member]);
      }

      // Remove invite from invites/<email>
      const rest = myInvites.filter(i => i.farmId !== inv.farmId);
      await dataSet(invitesKey(myEmail.toLowerCase()), rest);
      setMyInvites(rest);

      // Switch to that farm so user sees it immediately
      setFarmId?.(inv.farmId);
      alert(`Joined ${inv.farmName || "farm"} as ${inv.role || "viewer"}`);
    } catch (e: any) {
      alert(`Accept failed: ${e?.message || "unknown error"}`);
    }
  }

  async function declineInvite(inv: Invite) {
    if (!myEmail) return;
    try {
      const rest = myInvites.filter(i => i.farmId !== inv.farmId);
      await dataSet(invitesKey(myEmail.toLowerCase()), rest);
      setMyInvites(rest);
    } catch (e: any) {
      alert(`Decline failed: ${e?.message || "unknown error"}`);
    }
  }

  return (
    <div className="animate-fade-slide space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Farms</h1>
        {Array.isArray(farms) && farms.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Current farm:</label>
            <select
              className="border rounded-lg px-2 py-1 bg-white/80 backdrop-blur-sm shadow-sm"
              value={farmId ?? (farms[0]?.id ?? "")}
              onChange={(e) => setFarmId?.(e.target.value)}
            >
              {farmsSorted.map((f: Farm) => (
                <option key={f.id} value={f.id}>
                  {f.name || "Farm " + String(f.id).slice(0, 4)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ===== Invites for current user ===== */}
      <div className="p-4 rounded-xl border bg-white space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Your Invites</div>
          <button
            type="button"
            className="text-sm px-3 py-1 border rounded"
            onClick={loadMyInvites}
          >
            Refresh
          </button>
        </div>

        {loadingInvites && <div className="text-sm text-slate-500">Loading invites…</div>}
        {invitesError && <div className="text-sm text-red-600">{invitesError}</div>}

        {!loadingInvites && myInvites.length === 0 && (
          <div className="text-sm text-slate-500">No invites.</div>
        )}

        {!loadingInvites && myInvites.length > 0 && (
          <ul className="space-y-2">
            {myInvites.map((inv) => (
              <li key={inv.farmId} className="flex items-center justify-between border rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {inv.farmName || "Farm " + inv.farmId.slice(0, 6)}
                  </div>
                  <div className="text-xs text-slate-500">
                    Role: {inv.role || "viewer"}{inv.inviter ? ` • Invited by ${inv.inviter}` : ""}{inv.createdAt ? ` • ${new Date(inv.createdAt).toLocaleString()}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-1 rounded border bg-green-600 text-white"
                    onClick={() => acceptInvite(inv)}
                  >
                    Accept
                  </button>
                  <button
                    className="px-3 py-1 rounded border"
                    onClick={() => declineInvite(inv)}
                  >
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
            {(farmsSorted || []).map((f: Farm) => (
              <li key={f.id} className="flex items-center justify-between">
                <span className={["truncate", f.id === farmId ? "font-semibold" : ""].join(" ")}>
                  {f.name || "Farm " + String(f.id).slice(0, 4)}
                </span>
                <div className="flex items-center gap-2">
                  {f.id !== farmId && (
                    <button className="text-xs rounded border px-2 py-1 hover:bg-slate-50" onClick={() => setFarmId?.(f.id)}>Switch</button>
                  )}
                  <button className="text-xs rounded border px-2 py-1 hover:bg-red-50 text-red-600" onClick={() => onDeleteFarm(f.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
            {(!farms || farms.length === 0) && <li className="text-slate-500 text-center">No farms yet.</li>}
          </ul>
        </div>

        <div className="p-4 rounded-xl border bg-white">
          <div className="text-sm font-medium text-center mb-2">Create new farm</div>
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded px-3 py-2"
              placeholder="Farm name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onCreateFarm(); }}
            />
            <button className="rounded bg-slate-900 text-white px-4 py-2 disabled:opacity-60"
              disabled={busyFarm || !newName.trim()} onClick={onCreateFarm}>
              Create
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500 text-center">
            New farms are shared with members you invite below.
          </p>
        </div>
      </div>

      {/* ===== Members ===== */}
      <div className="p-4 rounded-xl border bg-white space-y-4">
        <div className="text-lg font-semibold text-center">Members</div>

        {/* Invite row */}
        <div className="grid md:grid-cols-3 gap-3 items-end">
          <label className="block">
            <div className="text-sm mb-1">Email</div>
            <input
              type="email"
              className="w-full border rounded px-3 py-2"
              placeholder="person@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && emailOk && !inviting) invite(); }}
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
          <div className="flex md:justify-end">
            <button
              type="button"
              className="rounded bg-slate-900 text-white px-4 py-2 w-full md:w-auto disabled:opacity-60"
              disabled={!farmId || !emailOk || inviting}
              onClick={invite}
            >
              {inviting ? "Inviting…" : "Invite"}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Owners/Admins can manage everything. Managers can invite workers and edit data. Workers can add/edit operational data. Viewers are read-only.
        </p>

        {/* Members table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">Email</th>
                <th className="py-2 pr-2">Role</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingMembers && (
                <tr><td colSpan={4} className="py-4 text-slate-500">Loading members…</td></tr>
              )}
              {!loadingMembers && members.map((m) => (
                <tr key={m.id} className="border-b">
                  <td className="py-2 pr-2">{m.email}</td>
                  <td className="py-2 pr-2">
                    <select
                      className="border rounded px-2 py-1"
                      value={m.role}
                      onChange={(e) => changeRole(m.id, e.target.value as MemberRole)}
                    >
                      {roleOptions.map(r => (
                        <option key={r.value} value={r.value}>
                          {r.label} — {r.desc}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">{m.status || "active"}</td>
                  <td className="py-2 pr-2">
                    <button className="px-2 py-1 border rounded text-red-600" onClick={() => removeMember(m.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {!loadingMembers && members.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-slate-500">No members yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {membersError && <div className="text-sm text-red-600">{membersError}</div>}
      </div>
    </div>
  );
}
