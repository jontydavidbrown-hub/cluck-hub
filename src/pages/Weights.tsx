import { useEffect, useMemo, useState, useRef } from "react";
import { useCloudSlice } from "../lib/cloudSlice";
import { useLocation } from "react-router-dom";

type WeightRow = {
  id: string;
  date: string;        // YYYY-MM-DD
  shed?: string;
  avgWeight?: number;  // grams
  sample?: number;     // n birds sampled
  notes?: string;
};

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}
function emptyRow(): WeightRow {
  return { id: newId(), date: todayYmd(), shed: "", avgWeight: undefined, sample: undefined, notes: "" };
}

export default function Weights() {
  // Keep the same slice key ("weights"); change this line only if your repo uses a different key.
  const [rows, setRows] = useCloudSlice<WeightRow[]>("weights", []);
  const [draft, setDraft] = useState<WeightRow>(emptyRow());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<WeightRow | null>(null);

  // ✅ Preselect shed from query (?shed=...)
  const location = useLocation();
  const weightRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const preset = params.get("shed") || "";
    if (preset) setDraft((d) => ({ ...d, shed: preset }));
    // optional nicety: focus avg weight on entry when presetting shed
    if (preset) {
      const t = window.setTimeout(() => weightRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [location.search]);

  const sorted = useMemo(
    () => [...(rows || [])].sort((a, b) => a.date.localeCompare(b.date)),
    [rows]
  );

  const addRow = () => {
    if (!draft.date) return;
    const cleaned: WeightRow = {
      ...draft,
      avgWeight: draft.avgWeight == null || (draft.avgWeight as any) === "" ? undefined : Number(draft.avgWeight) || 0,
      sample: draft.sample == null || (draft.sample as any) === "" ? undefined : Math.max(0, Number(draft.sample) || 0),
      id: draft.id || newId(),
    };
    setRows((prev) => [...(prev || []), cleaned]);
    setDraft(emptyRow());
  };

  const startEdit = (r: WeightRow) => {
    setEditingId(r.id);
    setEdit({ ...r });
  };

  const saveEdit = () => {
    if (!edit) return;
    const cleaned: WeightRow = {
      ...edit,
      avgWeight: edit.avgWeight == null || (edit.avgWeight as any) === "" ? undefined : Number(edit.avgWeight) || 0,
      sample: edit.sample == null || (edit.sample as any) === "" ? undefined : Math.max(0, Number(edit.sample) || 0),
    };
    setRows((prev) => prev.map((r) => (r.id === cleaned.id ? cleaned : r)));
    setEditingId(null);
    setEdit(null);
  };

  const remove = (id: string) => {
    if (!confirm("Remove this entry?")) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Weights</h1>
      </div>

      {/* Add form */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="font-medium mb-3">Add weights</div>
        <div className="grid md:grid-cols-6 gap-3">
          <div>
            <label className="block text-sm mb-1">Date</label>
            <input
              type="date"
              className="w-full border rounded px-2 py-1"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Shed</label>
            <input
              type="text"
              className="w-full border rounded px-2 py-1"
              placeholder="e.g., Shed 1"
              value={draft.shed ?? ""}
              onChange={(e) => setDraft({ ...draft, shed: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Avg weight (g)</label>
            <input
              ref={weightRef}
              type="number" step="1" min={0}
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              placeholder="0"
              value={draft.avgWeight ?? ""}
              onChange={(e) => setDraft({ ...draft, avgWeight: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Sample size</label>
            <input
              type="number" step="1" min={0}
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              placeholder="0"
              value={draft.sample ?? ""}
              onChange={(e) => setDraft({ ...draft, sample: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Notes</label>
            <input
              className="w-full border rounded px-2 py-1"
              value={draft.notes ?? ""}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
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
                <th className="py-2 pr-2">Avg weight (g)</th>
                <th className="py-2 pr-2">Sample</th>
                <th className="py-2 pr-2">Notes</th>
                <th className="py-2 pr-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="py-2 pr-2">
                    {editingId === r.id ? (
                      <input
                        type="date"
                        className="border rounded px-2 py-1"
                        value={edit?.date || ""}
                        onChange={(e) => setEdit((s) => ({ ...(s as WeightRow), date: e.target.value }))}
                      />
                    ) : r.date}
                  </td>

                  <td className="py-2 pr-2">
                    {editingId === r.id ? (
                      <input
                        className="border rounded px-2 py-1"
                        value={edit?.shed || ""}
                        onChange={(e) => setEdit((s) => ({ ...(s as WeightRow), shed: e.target.value }))}
                      />
                    ) : (r.shed || "")}
                  </td>

                  <td className="py-2 pr-2">
                    {editingId === r.id ? (
                      <input
                        type="number" step="1" min={0}
                        className="border rounded px-2 py-1 placeholder-transparent"
                        placeholder="0"
                        value={edit?.avgWeight ?? ""}
                        onChange={(e) => setEdit((s) => ({ ...(s as WeightRow), avgWeight: e.target.value === "" ? undefined : Number(e.target.value) }))}
                      />
                    ) : (r.avgWeight != null ? Number(r.avgWeight).toFixed(0) : "—")}
                  </td>

                  <td className="py-2 pr-2">
                    {editingId === r.id ? (
                      <input
                        type="number" step="1" min={0}
                        className="border rounded px-2 py-1 placeholder-transparent"
                        placeholder="0"
                        value={edit?.sample ?? ""}
                        onChange={(e) => setEdit((s) => ({ ...(s as WeightRow), sample: e.target.value === "" ? undefined : Number(e.target.value) }))}
                      />
                    ) : (r.sample != null ? r.sample : "—")}
                  </td>

                  <td className="py-2 pr-2">
                    {editingId === r.id ? (
                      <input
                        className="border rounded px-2 py-1"
                        value={edit?.notes || ""}
                        onChange={(e) => setEdit((s) => ({ ...(s as WeightRow), notes: e.target.value }))}
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
                <tr><td className="py-6 text-gray-500" colSpan={6}>No weights yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
