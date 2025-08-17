import { useMemo, useState } from "react";
import { useCloudSlice } from "../lib/cloudSlice";

type WaterRow = {
  id: string;
  date: string;            // YYYY-MM-DD
  shed?: string;
  chlorine?: number;       // ppm
  ph?: number;
  liters?: number;         // volume used/added (optional)
  notes?: string;
};

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
function emptyRow(): WaterRow {
  const today = new Date().toISOString().slice(0, 10);
  return { id: newId(), date: today, shed: "", chlorine: undefined, ph: undefined, liters: undefined, notes: "" };
}

export default function Water() {
  // Keep the key "water" so existing data/behavior is unchanged.
  const [rows, setRows] = useCloudSlice<WaterRow[]>("water", []);
  const [draft, setDraft] = useState<WaterRow>(emptyRow());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<WaterRow | null>(null);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.date.localeCompare(b.date)),
    [rows]
  );

  const addRow = () => {
    if (!draft.date) return;
    const cleaned: WaterRow = {
      ...draft,
      chlorine: Number(draft.chlorine ?? 0) || 0,
      ph: Number(draft.ph ?? 0) || 0,
      liters: draft.liters == null || draft.liters === ("" as any) ? undefined : Number(draft.liters) || 0,
      id: draft.id || newId(),
    };
    setRows(prev => [...(prev || []), cleaned]);
    setDraft(emptyRow());
  };

  const startEdit = (r: WaterRow) => {
    setEditingId(r.id);
    setEdit({ ...r });
  };

  const saveEdit = () => {
    if (!edit) return;
    const cleaned: WaterRow = {
      ...edit,
      chlorine: Number(edit.chlorine ?? 0) || 0,
      ph: Number(edit.ph ?? 0) || 0,
      liters: edit.liters == null || (edit.liters as any) === "" ? undefined : Number(edit.liters) || 0,
    };
    setRows(prev => prev.map(r => (r.id === cleaned.id ? cleaned : r)));
    setEditingId(null);
    setEdit(null);
  };

  const remove = (id: string) => {
    if (!confirm("Remove this entry?")) return;
    setRows(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Water</h1>
      </div>

      {/* Add form */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="font-medium mb-3">Add reading</div>
        <div className="grid md:grid-cols-6 gap-3">
          <div>
            <label className="block text-sm mb-1">Date</label>
            <input
              type="date"
              className="w-full border rounded px-2 py-1"
              value={draft.date}
              onChange={e => setDraft({ ...draft, date: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Shed</label>
            <input
              className="w-full border rounded px-2 py-1"
              placeholder="e.g., Shed 1"
              value={draft.shed ?? ""}
              onChange={e => setDraft({ ...draft, shed: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Chlorine (ppm)</label>
            <input
              type="number" step="0.01" min={0}
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              placeholder="0"
              value={draft.chlorine ?? ""}
              onChange={e => setDraft({ ...draft, chlorine: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">pH</label>
            <input
              type="number" step="0.01"
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              placeholder="0"
              value={draft.ph ?? ""}
              onChange={e => setDraft({ ...draft, ph: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Liters (optional)</label>
            <input
              type="number" step="0.01" min={0}
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              placeholder="0"
              value={draft.liters ?? ""}
              onChange={e => setDraft({ ...draft, liters: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Notes</label>
            <input
              className="w-full border rounded px-2 py-1"
              value={draft.notes ?? ""}
              onChange={e => setDraft({ ...draft, notes: e.target.value })}
            />
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
                <th className="py-2 pr-2">Chlorine (ppm)</th>
                <th className="py-2 pr-2">pH</th>
                <th className="py-2 pr-2">Liters</th>
                <th className="py-2 pr-2">Notes</th>
                <th className="py-2 pr-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r.id} className="border-b">
                  <td className="py-2 pr-2">
                    {editingId === r.id ? (
                      <input
                        type="date"
                        className="border rounded px-2 py-1"
                        value={edit?.date || ""}
                        onChange={e => setEdit(s => ({ ...(s as WaterRow), date: e.target.value }))}
                      />
                    ) : r.date}
                  </td>
                  <td className="py-2 pr-2">
                    {editingId === r.id ? (
                      <input
                        className="border rounded px-2 py-1"
                        value={edit?.shed || ""}
                        onChange={e => setEdit(s => ({ ...(s as WaterRow), shed: e.target.value }))}
                      />
                    ) : (r.shed || "")}
                  </td>
                  <td className="py-2 pr-2">
                    {editingId === r.id ? (
                      <input
                        type="number" step="0.01" min={0}
                        className="border rounded px-2 py-1 placeholder-transparent"
                        placeholder="0"
                        value={edit?.chlorine ?? ""}
                        onChange={e => setEdit(s => ({ ...(s as WaterRow), chlorine: e.target.value === "" ? undefined : Number(e.target.value) }))}
                      />
                    ) : (Number(r.chlorine) || 0).toFixed(2)}
                  </td>
                  <td className="py-2 pr-2">
                    {editingId === r.id ? (
                      <input
                        type="number" step="0.01"
                        className="border rounded px-2 py-1 placeholder-transparent"
                        placeholder="0"
                        value={edit?.ph ?? ""}
                        onChange={e => setEdit(s => ({ ...(s as WaterRow), ph: e.target.value === "" ? undefined : Number(e.target.value) }))}
                      />
                    ) : (Number(r.ph) || 0).toFixed(2)}
                  </td>
                  <td className="py-2 pr-2">
                    {editingId === r.id ? (
                      <input
                        type="number" step="0.01" min={0}
                        className="border rounded px-2 py-1 placeholder-transparent"
                        placeholder="0"
                        value={edit?.liters ?? ""}
                        onChange={e => setEdit(s => ({ ...(s as WaterRow), liters: e.target.value === "" ? undefined : Number(e.target.value) }))}
                      />
                    ) : (r.liters != null ? Number(r.liters).toFixed(2) : "—")}
                  </td>
                  <td className="py-2 pr-2">
                    {editingId === r.id ? (
                      <input
                        className="border rounded px-2 py-1"
                        value={edit?.notes || ""}
                        onChange={e => setEdit(s => ({ ...(s as WaterRow), notes: e.target.value }))}
                      />
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
                <tr><td className="py-6 text-gray-500" colSpan={7}>No readings yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
