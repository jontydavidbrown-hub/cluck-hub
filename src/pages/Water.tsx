import { useMemo, useState } from "react";
import { useCloudSlice } from "../lib/cloudSlice";
import { downloadCsv } from "../lib/csv";
import { pdfWaterLogs } from "../lib/pdfLogs";

type WaterRow = { id: string; date: string; ppm: number; notes?: string };

function emptyRow(): WaterRow {
  const today = new Date().toISOString().slice(0, 10);
  return { id: crypto.randomUUID(), date: today, ppm: 0, notes: "" };
}

export default function Water() {
  const [rows, setRows] = useCloudSlice<WaterRow[]>("waterLogs", []);
  const [draft, setDraft] = useState<WaterRow>(emptyRow());
  const [editing, setEditing] = useState<WaterRow | null>(null);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.date.localeCompare(b.date)),
    [rows]
  );

  const add = () => {
    if (!draft.date) return;
    setRows([...(rows || []), { ...draft, ppm: Number(draft.ppm) || 0 }]);
    setDraft(emptyRow());
  };

  const startEdit = (r: WaterRow) => setEditing({ ...r });
  const saveEdit = () => {
    if (!editing) return;
    setRows(rows.map(r => (r.id === editing.id ? { ...editing, ppm: Number(editing.ppm) || 0 } : r)));
    setEditing(null);
  };
  const remove = (id: string) => {
    if (!confirm("Remove this reading?")) return;
    setRows(rows.filter(r => r.id !== id));
  };

  const avg = useMemo(() => {
    if (rows.length === 0) return 0;
    const sum = rows.reduce((s, r) => s + (Number(r.ppm) || 0), 0);
    return Math.round((sum / rows.length) * 100) / 100;
  }, [rows]);

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Water (Chlorine)</h1>
        <div className="flex gap-2">
          <button className="px-3 py-1 border rounded" onClick={() => downloadCsv("water-logs.csv", rows as any[])}>
            Export CSV
          </button>
          <button className="px-3 py-1 border rounded" onClick={() => pdfWaterLogs(rows as any[])}>
            Export PDF
          </button>
        </div>
      </div>

      {/* Add form */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="font-medium mb-3">Add reading</div>
        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm mb-1">Date</label>
            <input type="date" className="w-full border rounded px-2 py-1"
              value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm mb-1">Chlorine (ppm)</label>
            <input
              type="number"
              placeholder="0"
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              value={something}
              onChange={e => setSomething(Number(e.target.value))}
            />


          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Notes</label>
            <input className="w-full border rounded px-2 py-1"
              value={draft.notes ?? ""} onChange={e => setDraft({ ...draft, notes: e.target.value })} />
          </div>
        </div>
        <div className="mt-3">
          <button className="px-4 py-2 rounded bg-black text-white" onClick={add}>Add</button>
        </div>
      </div>

      {/* Table */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="mb-2 text-sm text-gray-600">Average ppm: <span className="font-medium">{avg}</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">Date</th>
                <th className="py-2 pr-2">ppm</th>
                <th className="py-2 pr-2">Notes</th>
                <th className="py-2 pr-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r.id} className="border-b">
                  <td className="py-2 pr-2">
                    {editing?.id === r.id ? (
                      <input type="date" className="border rounded px-2 py-1"
                        value={editing.date} onChange={e => setEditing(s => ({ ...(s as WaterRow), date: e.target.value }))} />
                    ) : r.date}
                  </td>
                  <td className="py-2 pr-2">
                    {editing?.id === r.id ? (
                      <input type="number" step="0.01" className="border rounded px-2 py-1"
                        value={editing.ppm} onChange={e => setEditing(s => ({ ...(s as WaterRow), ppm: Number(e.target.value) }))} />
                    ) : r.ppm}
                  </td>
                  <td className="py-2 pr-2">
                    {editing?.id === r.id ? (
                      <input className="border rounded px-2 py-1"
                        value={editing.notes ?? ""} onChange={e => setEditing(s => ({ ...(s as WaterRow), notes: e.target.value }))} />
                    ) : (r.notes || "")}
                  </td>
                  <td className="py-2 pr-2">
                    {editing?.id === r.id ? (
                      <div className="flex gap-2">
                        <button className="px-2 py-1 border rounded" onClick={saveEdit}>Save</button>
                        <button className="px-2 py-1 border rounded" onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button className="px-2 py-1 border rounded" onClick={() => startEdit(r)}>Edit</button>
                        <button className="px-2 py-1 border rounded text-red-600" onClick={() => remove(r.id)}>Remove</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td className="py-6 text-gray-500" colSpan={4}>No readings yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
