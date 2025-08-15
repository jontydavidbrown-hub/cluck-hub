import { useFarm } from "../lib/FarmContext";
import { useEffect, useMemo, useState } from "react";

export default function Members() {
  const { farms, farmId, inviteMember, changeRole, removeMember, refresh } = useFarm();
  const farm = useMemo(() => farms.find(f => f.id === farmId) || null, [farms, farmId]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner"|"manager"|"worker"|"viewer">("viewer");

  useEffect(() => { refresh(); }, [refresh]);

  if (!farm) return <div className="p-4">Select a farm.</div>;

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Members — {farm.name}</h1>

      <div className="p-4 rounded-2xl border space-y-3">
        <div className="font-medium">Invite member</div>
        <div className="flex gap-2 flex-wrap">
          <input className="border rounded px-2 py-1" placeholder="email@domain"
                 value={email} onChange={e => setEmail(e.target.value)} />
          <select className="border rounded px-2 py-1" value={role} onChange={e => setRole(e.target.value as any)}>
            <option value="viewer">viewer</option>
            <option value="worker">worker</option>
            <option value="manager">manager</option>
            <option value="owner">owner</option>
          </select>
          <button className="px-3 py-1 rounded bg-black text-white"
                  onClick={async()=>{ if(email) { await inviteMember(farm.id, email, role); setEmail(""); } }}>
            Invite
          </button>
        </div>
      </div>

      <div className="p-4 rounded-2xl border">
        <div className="font-medium mb-2">Current members</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Email</th>
              <th className="py-2">Role</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {farm.members.map(m => (
              <tr key={m.email} className="border-b">
                <td className="py-2">{m.email}</td>
                <td className="py-2">
                  <select
                    className="border rounded px-2 py-1"
                    value={m.role}
                    onChange={async (e)=> await changeRole(farm.id, m.email, e.target.value as any)}
                  >
                    <option value="viewer">viewer</option>
                    <option value="worker">worker</option>
                    <option value="manager">manager</option>
                    <option value="owner">owner</option>
                  </select>
                </td>
                <td className="py-2">
                  <button className="text-red-600 underline"
                          onClick={async()=> await removeMember(farm.id, m.email)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {farm.members.length === 0 && (
              <tr><td className="py-4 text-gray-500" colSpan={3}>No members yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
