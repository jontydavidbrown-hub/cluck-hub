// src/pages/Morts.tsx
import { useEffect, useMemo, useState } from "react";
import { useCloudSlice } from "../lib/cloudSlice";
import { useSearchParams } from "react-router-dom";

type Shed = {
  id: string;
  name: string;
  placementDate?: string;      // YYYY-MM-DD
  placementBirds?: number;
  birdsPlaced?: number;
};

type Row = {
  id: string;
  date: string;                // YYYY-MM-DD
  shed?: string;

  // Explicit fields
  morts?: number;              // natural deaths
  cullRunts?: number;
  cullLegs?: number;
  cullNonStart?: number;
  cullOther?: number;

  // Compatibility fields used elsewhere
  culls?: number;              // sum of all cull categories
  mortalities?: number;        // morts + culls

  notes?: string;
};

function emptyRow(prefillShed = ""): Row {
  const today = new Date().toISOString().slice(0, 10);
  // NOTE: leave numeric fields undefined so the input shows transparent placeholder (no “0” to delete)
  return {
    id: crypto.randomUUID(),
    date: today,
    shed: prefillShed,
    morts: undefined,
    cullRunts: undefined,
    cullLegs: undefined,
    cullNonStart: undefined,
    cullOther: undefined,
    culls: 0,
    mortalities: 0,
    notes: "",
  };
}

function sumCulls(r: Partial<Row>) {
  return (Number(r.cullRunts) || 0)
       + (Number(r.cullLegs) || 0)
       + (Number(r.cullNonStart) || 0)
       + (Number(r.cullOther) || 0);
}
function clampNum(n: any) {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}
function daysBetweenUTC(a?: string, b?: string) {
  if (!a || !b) return undefined;
  const A = new Date(a + "T00:00:00Z").getTime();
  const B = new Date(b + "T00:00:00Z").getTime();
  return Math.floor((B - A) / (1000 * 60 * 60 * 24));
}

export default function Morts() {
  const [search] = useSearchParams();
  const preselectShed = search.get("shed") || "";

  const [rows, setRows] = useCloudSlice<Row[]>("dailyLog", []);
  const [sheds] = useCloudSlice<Shed[]>("sheds", []);

  const [draft, setDraft] = useState<Row>(emptyRow(preselectShed));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Row | null>(null);

  // Keep shed list stable by name for selects
  const shedNames = useMemo(
    () => (sheds || []).map(s => s.name || "").filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [sheds]
  );

  // Sorted global view (by date asc, then shed)
  const sorted = useMemo(
    () =>
      [...(rows || [])].sort((a, b) =>
        (a.date || "").localeCompare(b.date || "") || (a.shed || "").localeCompare(b.shed || "")
      ),
    [rows]
  );

  // Group rows by shed for breakdown
  const byShed = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of sorted) {
      const key = (r.shed || "").trim() || "(No shed)";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(r);
    }
    return m;
  }, [sorted]);

  // Lookup placementDate for day age
  const placementByShed = useMemo(() => {
    const m = new Map<string, string | undefined>();
    for (const s of sheds || []) {
      const name = (s.name || "").trim();
      if (name) m.set(name, s.placementDate);
    }
    return m;
  }, [sheds]);

  useEffect(() => {
    // If URL preselects shed and draft is empty, apply once
    if (preselectShed && !draft.shed) {
      setDraft(d => ({ ...d, shed: preselectShed }));
    }
  }, [preselectShed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- CRUD helpers
  function normalize(r: Row): Row {
    const morts = clampNum(r.morts);
    const cRunts = clampNum(r.cullRunts);
    const cLegs = clampNum(r.cullLegs);
    const cNon = clampNum(r.cullNonStart);
    const cOther = clampNum(r.cullOther);
    const culls = cRunts + cLegs + cNon + cOther;
    const mortalities = morts + culls;
    return {
      ...r,
      morts,
      cullRunts: cRunts,
      cullLegs: cLegs,
      cullNonStart: cNon,
      cullOther: cOther,
      culls,
      mortalities,
    };
  }

  function addRow() {
    if (!draft.date) return;
    const cleaned = normalize(draft);
    setRows([...(rows || []), cleaned]);
    setDraft(emptyRow(preselectShed));
  }

  function startEdit(r: Row) {
    setEditingId(r.id);
    setEdit({ ...r });
  }

  function saveEdit() {
    if (!edit) return;
    const cleaned = normalize(edit);
    setRows((rows || []).map(r => (r.id === cleaned.id ? cleaned : r)));
    setEditingId(null);
    setEdit(null);
  }

  function remove(id: string) {
    if (!confirm("Remove this entry?")) return;
    setRows((rows || []).filter(r => r.id !== id));
  }

  // ---- UI
  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Morts</h1>
      </div>

      {/* Add form */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="font-medium mb-3">Add entry</div>
        <div className="grid md:grid-cols-8 gap-3">
          <div>
            <label className="block text-sm mb-1">Date</label>
            <input
              type="date"
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Shed</label>
            <input
              list="shed-list"
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              placeholder="e.g., Shed 1"
              value={draft.shed ?? ""}
              onChange={(e) => setDraft({ ...draft, shed: e.target.value })}
            />
            <datalist id="shed-list">
              {shedNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-sm mb-1">Morts</label>
            <input
              type="number"
              min={0}
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              placeholder="0"
              value={draft.morts === undefined ? "" : draft.morts}
              onChange={(e) => setDraft({ ...draft, morts: e.target.value === "" ? undefined : clampNum(e.target.value) })}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Cull Runts</label>
            <input
              type="number"
              min={0}
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              placeholder="0"
              value={draft.cullRunts === undefined ? "" : draft.cullRunts}
              onChange={(e) => setDraft({ ...draft, cullRunts: e.target.value === "" ? undefined : clampNum(e.target.value) })}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Cull Legs</label>
            <input
              type="number"
              min={0}
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              placeholder="0"
              value={draft.cullLegs === undefined ? "" : draft.cullLegs}
              onChange={(e) => setDraft({ ...draft, cullLegs: e.target.value === "" ? undefined : clampNum(e.target.value) })}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Cull Non-Start</label>
            <input
              type="number"
              min={0}
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              placeholder="0"
              value={draft.cullNonStart === undefined ? "" : draft.cullNonStart}
              onChange={(e) => setDraft({ ...draft, cullNonStart: e.target.value === "" ? undefined : clampNum(e.target.value) })}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Cull Other</label>
            <input
              type="number"
              min={0}
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              placeholder="0"
              value={draft.cullOther === undefined ? "" : draft.cullOther}
              onChange={(e) => setDraft({ ...draft, cullOther: e.target.value === "" ? undefined : clampNum(e.target.value) })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Notes</label>
            <input
              type="text"
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              placeholder="Optional notes"
              value={draft.notes ?? ""}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-3">
          <button className="px-4 py-2 rounded bg-black text-white" onClick={addRow}>
            Add
          </button>
        </div>
      </div>

      {/* Main table */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">Date</th>
                <th className="py-2 pr-2">Shed</th>
                <th className="py-2 pr-2">Morts</th>
                <th className="py-2 pr-2">Cull Runts</th>
                <th className="py-2 pr-2">Cull Legs</th>
                <th className="py-2 pr-2">Cull Non-Start</th>
                <th className="py-2 pr-2">Cull Other</th>
                <th className="py-2 pr-2">Total</th>
                <th className="py-2 pr-2">Notes</th>
                <th className="py-2 pr-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const total = (Number(r.morts) || 0) + sumCulls(r);
                return (
                  <tr key={r.id} className="border-b">
                    <td className="py-2 pr-2">
                      {editingId === r.id ? (
                        <input
                          type="date"
                          className="border rounded px-2 py-1 placeholder-transparent"
                          value={edit?.date || ""}
                          onChange={(e) => setEdit((s) => ({ ...(s as Row), date: e.target.value }))}
                        />
                      ) : (
                        r.date
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      {editingId === r.id ? (
                        <input
                          list="shed-list"
                          className="border rounded px-2 py-1 placeholder-transparent"
                          placeholder="e.g., Shed 1"
                          value={edit?.shed ?? ""}
                          onChange={(e) => setEdit((s) => ({ ...(s as Row), shed: e.target.value }))}
                        />
                      ) : (
                        r.shed || ""
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      {editingId === r.id ? (
                        <input
                          type="number"
                          min={0}
                          className="border rounded px-2 py-1 placeholder-transparent"
                          placeholder="0"
                          value={edit?.morts === undefined ? "" : edit?.morts}
                          onChange={(e) => setEdit((s) => ({ ...(s as Row), morts: e.target.value === "" ? undefined : clampNum(e.target.value) }))}
                        />
                      ) : (
                        r.morts ?? 0
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      {editingId === r.id ? (
                        <input
                          type="number"
                          min={0}
                          className="border rounded px-2 py-1 placeholder-transparent"
                          placeholder="0"
                          value={edit?.cullRunts === undefined ? "" : edit?.cullRunts}
                          onChange={(e) => setEdit((s) => ({ ...(s as Row), cullRunts: e.target.value === "" ? undefined : clampNum(e.target.value) }))}
                        />
                      ) : (
                        r.cullRunts ?? 0
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      {editingId === r.id ? (
                        <input
                          type="number"
                          min={0}
                          className="border rounded px-2 py-1 placeholder-transparent"
                          placeholder="0"
                          value={edit?.cullLegs === undefined ? "" : edit?.cullLegs}
                          onChange={(e) => setEdit((s) => ({ ...(s as Row), cullLegs: e.target.value === "" ? undefined : clampNum(e.target.value) }))}
                        />
                      ) : (
                        r.cullLegs ?? 0
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      {editingId === r.id ? (
                        <input
                          type="number"
                          min={0}
                          className="border rounded px-2 py-1 placeholder-transparent"
                          placeholder="0"
                          value={edit?.cullNonStart === undefined ? "" : edit?.cullNonStart}
                          onChange={(e) => setEdit((s) => ({ ...(s as Row), cullNonStart: e.target.value === "" ? undefined : clampNum(e.target.value) }))}
                        />
                      ) : (
                        r.cullNonStart ?? 0
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      {editingId === r.id ? (
                        <input
                          type="number"
                          min={0}
                          className="border rounded px-2 py-1 placeholder-transparent"
                          placeholder="0"
                          value={edit?.cullOther === undefined ? "" : edit?.cullOther}
                          onChange={(e) => setEdit((s) => ({ ...(s as Row), cullOther: e.target.value === "" ? undefined : clampNum(e.target.value) }))}
                        />
                      ) : (
                        r.cullOther ?? 0
                      )}
                    </td>
                    <td className="py-2 pr-2">{total}</td>
                    <td className="py-2 pr-2">
                      {editingId === r.id ? (
                        <input
                          className="border rounded px-2 py-1 placeholder-transparent"
                          placeholder="Optional notes"
                          value={edit?.notes ?? ""}
                          onChange={(e) => setEdit((s) => ({ ...(s as Row), notes: e.target.value }))}
                        />
                      ) : (
                        r.notes || ""
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      {editingId === r.id ? (
                        <div className="flex gap-2">
                          <button className="px-2 py-1 border rounded" onClick={saveEdit}>
                            Save
                          </button>
                          <button
                            className="px-2 py-1 border rounded"
                            onClick={() => {
                              setEditingId(null);
                              setEdit(null);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button className="px-2 py-1 border rounded" onClick={() => startEdit(r)}>
                            Edit
                          </button>
                          <button
                            className="px-2 py-1 border rounded text-red-600"
                            onClick={() => remove(r.id)}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td className="py-6 text-gray-500" colSpan={10}>
                    No entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-shed breakdown */}
      <div className="space-y-4">
        {[...byShed.entries()].map(([shedName, list]) => {
          const placement = placementByShed.get(shedName);
          const rowsDesc = [...list].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

          return (
            <div key={shedName} className="p-4 border rounded-2xl bg-white">
              <div className="font-medium mb-3">Breakdown — {shedName}</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 pr-2">Day Age</th>
                      <th className="py-2 pr-2">Morts</th>
                      <th className="py-2 pr-2">Cull Runts</th>
                      <th className="py-2 pr-2">Cull Legs</th>
                      <th className="py-2 pr-2">Cull Non-Start</th>
                      <th className="py-2 pr-2">Cull Other</th>
                      <th className="py-2 pr-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsDesc.map((r) => {
                      const age = placement ? daysBetweenUTC(placement, r.date) : undefined;
                      const total = (Number(r.morts) || 0) + sumCulls(r);
                      return (
                        <tr key={r.id} className="border-b">
                          <td className="py-2 pr-2">{r.date}</td>
                          <td className="py-2 pr-2">{typeof age === "number" ? age : "—"}</td>
                          <td className="py-2 pr-2">{r.morts ?? 0}</td>
                          <td className="py-2 pr-2">{r.cullRunts ?? 0}</td>
                          <td className="py-2 pr-2">{r.cullLegs ?? 0}</td>
                          <td className="py-2 pr-2">{r.cullNonStart ?? 0}</td>
                          <td className="py-2 pr-2">{r.cullOther ?? 0}</td>
                          <td className="py-2 pr-2">{total}</td>
                        </tr>
                      );
                    })}
                    {rowsDesc.length === 0 && (
                      <tr>
                        <td className="py-4 text-gray-500" colSpan={8}>
                          No entries.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
