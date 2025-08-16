import { useEffect, useMemo, useState } from "react";
import { useFarm } from "../lib/FarmContext";

export default function Members() {
  const { farms = [], farmId, inviteMember, changeRole, removeMember, refresh } = useFarm() as any;
  const farm = useMemo(() => farms.find((f: any) => f.id === farmId) || null, [farms, farmId]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner"|"manager"|"worker"|"viewer">("viewer");

  // Avoid infinite loop: call refresh only once on mount (not on every state change)
  useEffect(() => { try { refresh?.(); } catch {} }, []);

  if (!farm) return <div className="p-4">Select a farm.</div>;

  const members: Array<{ email: string; role: "owner"|"manager"|"worker"|"viewer" }> =
    Array.isArray(farm.members) ? farm.members : [];

  async function doInvite() {
    const e = email.trim();
    if (!e) return;
    await inviteMember(farm.id, e, role);
    setEmail("");
  }

  return (
    <div className="animate-fade-slide space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Members — {farm.name}</h1>
          <p className="text-sm text-slate-600">Invite teammates and manage roles for this farm.</p>
        </div>
      </div>

      {/* Invite form */}
      <div className="card p-4 space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block sm:col-span-2">
            <div className="text-xs font-medium mb-1 text-slate-700">Email</div>
            <input
              type="email"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium mb-1 text-slate-700">Role</div>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
            >
              <option value="viewer">Viewer</option>
              <option value="worker">Worker</option>
              <option value="manager">Manager</option>
              <option value="owner">Owner</option>
            </select>
          </label>
        </div>
        <div className="flex justify-end">
          <button
            onClick={doInvite}
            disabled={!email.trim()}
            className="rounded-xl bg-emerald-600 text-white px-4 py-2 shadow-sm hover:opacity-95 transition disabled:opacity-50"
          >
            Invite
          </button>
        </div>
      </div>

      {/* Members table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50">
          <h2 className="text-sm font-semibold text-slate-800">Current members</h2>
        </div>
        <div className="p-2 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-600">
              <tr className="border-b border-slate-200">
                <th className="py-2 px-3">Email</th>
                <th className="py-2 px-3">Role</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m, idx) => (
                <tr key={m.email + idx} className="border-b last:border-0 border-slate-100 hover:bg-slate-50/60">
                  <td className="py-2 px-3">{m.email}</td>
                  <td className="py-2 px-3">
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm"
                      value={m.role}
                      onChange={(e) => changeRole(farm.id, m.email, e.target.value as any)}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="worker">Worker</option>
                      <option value="manager">Manager</option>
                      <option value="owner">Owner</option>
                    </select>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button
                      className="text-xs rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 px-2 py-1 transition"
                      onClick={() => removeMember(farm.id, m.email)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr><td className="p-6 text-slate-500" colSpan={3}>No members yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
