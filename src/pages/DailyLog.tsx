import { useMemo, useState } from "react";
import { useCloudSlice } from "../lib/cloudSlice";
import { downloadCsv } from "../lib/csv";
import { pdfDailyLog } from "../lib/pdfLogs";

type Row = {
  id: string;
  date: string;            // YYYY-MM-DD
  shed?: string;
  mortalities?: number;
  culls?: number;
  notes?: string;
};

function emptyRow(): Row {
  const today = new Date().toISOString().slice(0, 10);
  return { id: crypto.randomUUID(), date: today, shed: "", mortalities: 0, culls: 0, notes: "" };
}

export default function DailyLog() {
  const [rows, setRows] = useCloudSlice<Row[]>("dailyLog", []);
  const [draft, setDraft] = useState<Row>(emptyRow());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Row | null>(null);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.date.localeCompare(b.date)),
    [rows]
  );

  const totals = useMemo(
    () => ({
      mortalities: rows.reduce((sum, r) => sum + (Number(r.mortalities) || 0), 0),
      culls: rows.reduce((sum, r) => sum + (Number(r.culls) || 0), 0),
    }),
    [rows]
  );

  const addRow = () => {
    if (!draft.date) return;
    setRows([...(rows || []), { ...draft, mortalities: Number(draft.mortalities) || 0, culls: Number(draft.culls) || 0 }]);
    setDraft(emptyRow());
  };

  const startEdit = (r: Row) => {
    setEditingId(r.id);
    setEdit({ ...r });
  };

  const saveEdit = () => {
    if (!edit) return;
    setRows(rows.map(r => (r.id === edit.id ? { ...edit, mortalities: Number(edit.mortalities) || 0, culls: Number(edit.culls) || 0 } : r)));
    setEditingId(null);
    setEdit(null);
  };

  const remove = (id: string) => {
    if (!confirm("Remove this entry?")) return;
    setRows(rows.filter(r => r.id !== id));
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Daily Log</h1>
        <div className="flex gap-2">
          <button className="px-3 py-1 border rounded" onClick={() => downloadCsv("daily-log.csv", rows as any[])}>
            Export CSV
          </button>
          <button className="px-3 py-1 border rounded" onClick={() => pdfDailyLog(rows as any[])}>
            Export PDF
          </button>
        </div>
      </div>

      {/* Add form */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="font-medium mb-3">Add entry</div>
        <div className="grid md:grid-cols-6 gap-3">
          <div>
            <label className="block text-sm mb-1">Date</label>
            <input type="date" className="w-full border rounded px-2 py-1"
              value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm mb-1">Shed</label>
            <input type="text" className="w-full border rounded px-2 py-1"
              placeholder="e.g., Shed 1"
              value={draft.shed ?? ""} onChange={e => setDraft({ ...draft, shed: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm mb-1">Mortalities</label>
            <input type="number" min={0} className="w-full border rounded px-2 py-1"
              value={draft.mortalities ?? 0} onChange={e => setDraft({ ...draft, mortalities: Number(e.target.value) })} />
          </div>
          <div>
            <label className="block text-sm mb-1">Culls</label>
            <input type="number" min={0} className="w-full border rounded px-2 py-1"
              value={draft.culls ?? 0} onChange={e => setDraft({ ...draft, culls: Number(e.target.value) })} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Notes</label>
            <input type="text" className="w-full border rounded px-2 py-1"
              value={draft.notes ?? ""} onChange={e => setDraft({ ...draft, notes: e.target.value })} />
          </div>
        </div>
        <div className="mt-3">
          <button className="px-4 py-2 rounded bg-black text-white" onClick={addRow}>Add</button>
        </div>
      </div>

      {/* Table */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">Date</th>
                <th className="py-2 pr-2">Shed</th>
                <th className="py-2 pr-2">Mortalities</th>
                <th className="py-2 pr-2">Culls</th>
                <th className="py-2 pr-2">Notes</th>
                <th className="py-2 pr-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r.id} className="border-b">
                  <td className="py-2 pr-2">
                    {editingId === r.id ? (
                      <input type="date" className="border rounded px-2 py-1"
                        value={edit?.date || ""} onChange={e => setEdit(s => ({ ...(s as Row), date: e.target.value }))} />
                    ) : r.date}
                  </td>
                  <td className="py-2 pr-2">
                    {editingId === r.id ? (
                      <input className="border rounded px-2 py-1" value={edit?.shed || ""}
                        onChange={e => setEdit(s => ({ ...(s as Row), shed: e.target.value }))} />
                    ) : (r.shed || "")}
                  </td>
                  <td className="py-2 pr-2">
                    {editingId === r.id ? (
                      <input type="number" min={0} className="border rounded px-2 py-1" value={edit?.mortalities ?? 0}
                        onChange={e => setEdit(s => ({ ...(s as Row), mortalities: Number(e.target.value) }))} />
                    ) : (r.mortalities ?? 0)}
                  </td>
                  <td className="py-2 pr-2">
                    {editingId === r.id ? (
                      <input type="number" min={0} className="border rounded px-2 py-1" value={edit?.culls ?? 0}
                        onChange={e => setEdit(s => ({ ...(s as Row), culls: Number(e.target.value) }))} />
                    ) : (r.culls ?? 0)}
                  </td>
                  <td className="py-2 pr-2">
                    {editingId === r.id ? (
                      <input className="border rounded px-2 py-1" value={edit?.notes || ""}
                        onChange={e => setEdit(s => ({ ...(s as Row), notes: e.target.value }))} />
                    ) : (r.notes || "")}
                  </td>
                  <td className="py-2 pr-2">
                    {editingId === r.id ? (
                      <div className="flex gap-2">
                        <button className="px-2 py-1 border rounded" onClick={saveEdit}>Save</button>
                        <button className="px-2 py-1 border rounded" onClick={() => { setEditingId(null); setEdit(null); }}>Cancel</button>
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
                <tr><td className="py-6 text-gray-500" colSpan={6}>No entries yet.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="font-medium">
                <td className="py-2 pr-2" colSpan={2}>Totals</td>
                <td className="py-2 pr-2">{totals.mortalities}</td>
                <td className="py-2 pr-2">{totals.culls}</td>
                <td className="py-2 pr-2" colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
