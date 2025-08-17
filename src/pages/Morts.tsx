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

  morts?: number;              // natural deaths
  cullRunts?: number;
  cullLegs?: number;
  cullNonStart?: number;
  cullOther?: number;

  culls?: number;              // aggregate culls (compat)
  mortalities?: number;        // morts + culls (compat)
};

function emptyRow(): Row {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: crypto.randomUUID(),
    date: today,
    morts: undefined,
    cullRunts: undefined,
    cullLegs: undefined,
    cullNonStart: undefined,
    cullOther: undefined,
    culls: 0,
    mortalities: 0,
  };
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
function cullsOnly(r: Partial<Row>) {
  if (typeof r.culls === "number") return Math.max(0, r.culls);
  const sum =
    (Number(r.cullRunts) || 0) +
    (Number(r.cullLegs) || 0) +
    (Number(r.cullNonStart) || 0) +
    (Number(r.cullOther) || 0);
  return Math.max(0, sum);
}
function mortsOnly(r: Partial<Row>) {
  return Math.max(0, Number(r.morts) || 0);
}

export default function Morts() {
  const [search] = useSearchParams();
  const preselectShed = search.get("shed") || "";

  const [rows, setRows] = useCloudSlice<Row[]>("dailyLog", []);
  const [sheds] = useCloudSlice<Shed[]>("sheds", []);

  // Shed selector
  const shedNames = useMemo(
    () => (sheds || []).map(s => s.name || "").filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [sheds]
  );
  const [selectedShed, setSelectedShed] = useState<string>("");

  useEffect(() => {
    if (selectedShed) return;
    if (preselectShed) setSelectedShed(preselectShed);
    else if (shedNames.length) setSelectedShed(shedNames[0]);
  }, [preselectShed, shedNames, selectedShed]);

  // placement + placed birds (for %)
  const metaByShed = useMemo(() => {
    const m = new Map<string, { placementDate?: string; placed: number }>();
    for (const s of sheds || []) {
      const name = (s.name || "").trim();
      if (!name) continue;
      m.set(name, {
        placementDate: s.placementDate,
        placed: Number(s.birdsPlaced ?? s.placementBirds) || 0,
      });
    }
    return m;
  }, [sheds]);

  const shedRows = useMemo(() => {
    const list = (rows || []).filter(r => (r.shed || "") === (selectedShed || ""));
    return list.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }, [rows, selectedShed]);

  // Draft row
  const [draft, setDraft] = useState<Row>(emptyRow());
  useEffect(() => {
    setDraft(d => ({ ...emptyRow(), date: d.date || new Date().toISOString().slice(0, 10) }));
  }, [selectedShed]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Row | null>(null);

  function normalize(r: Row): Row {
    const morts = clampNum(r.morts);
    const cullRunts = clampNum(r.cullRunts);
    const cullLegs = clampNum(r.cullLegs);
    const cullNonStart = clampNum(r.cullNonStart);
    const cullOther = clampNum(r.cullOther);
    const culls = cullRunts + cullLegs + cullNonStart + cullOther;
    const mortalities = morts + culls;
    return { ...r, morts, cullRunts, cullLegs, cullNonStart, cullOther, culls, mortalities };
  }

  function addRow() {
    if (!draft.date || !selectedShed) return;
    const cleaned = normalize({
      ...draft,
      shed: selectedShed,
      morts: draft.morts ?? 0,
      cullRunts: draft.cullRunts ?? 0,
      cullLegs: draft.cullLegs ?? 0,
      cullNonStart: draft.cullNonStart ?? 0,
      cullOther: draft.cullOther ?? 0,
    });
    setRows([...(rows || []), cleaned]);
    setDraft(emptyRow());
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

  // Summary tiles: Today (M/C), All-time (M/C), % of Placed Birds
  const summary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const place = metaByShed.get(selectedShed || "");
    const placed = place?.placed ?? 0;

    let mAll = 0, cAll = 0, mToday = 0, cToday = 0;
    for (const r of shedRows) {
      const m = mortsOnly(r);
      const c = cullsOnly(r);
      mAll += m; cAll += c;
      if (r.date === today) { mToday += m; cToday += c; }
    }
    const pct = placed > 0 ? ((mAll + cAll) / placed) * 100 : 0;
    return { placed, mAll, cAll, mToday, cToday, pct };
  }, [metaByShed, selectedShed, shedRows]);

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Morts</h1>
      </div>

      {/* Shed Number selector */}
      <div className="p-4 border rounded-2xl bg-white">
        <label className="block text-sm mb-1">Shed Number</label>
        {shedNames.length > 0 ? (
          <select
            className="w-full md:max-w-sm border rounded-lg px-3 py-2 text-base"
            value={selectedShed}
            onChange={(e) => setSelectedShed(e.target.value)}
          >
            {shedNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        ) : (
          <div className="text-sm text-slate-600">
            No sheds configured. Add sheds in <span className="font-medium">Setup</span>.
          </div>
        )}
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded border p-4 bg-white">
          <div className="text-xs text-slate-500">Today (Morts/Culls)</div>
          <div className="text-2xl font-semibold">{summary.mToday}/{summary.cToday}</div>
        </div>
        <div className="rounded border p-4 bg-white">
          <div className="text-xs text-slate-500">All Time (Morts/Culls)</div>
          <div className="text-2xl font-semibold">{summary.mAll}/{summary.cAll}</div>
        </div>
        <div className="rounded border p-4 bg-white">
          <div className="text-xs text-slate-500">% of Placed Birds</div>
          <div className="text-2xl font-semibold">
            {summary.placed > 0 ? summary.pct.toFixed(1) : "0.0"}%
          </div>
        </div>
      </div>

      {/* Add entry (shed removed, notes removed) */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="font-medium mb-3">Add entry</div>
        <div className="grid md:grid-cols-6 gap-3">
          <div>
            <label className="block text-sm mb-1">Date</label>
            <input
              type="date"
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Morts</label>
            <input
              type="number" min={0}
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              placeholder="0"
              value={draft.morts === undefined ? "" : draft.morts}
              onChange={(e) => setDraft({ ...draft, morts: e.target.value === "" ? undefined : clampNum(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Cull Runts</label>
            <input
              type="number" min={0}
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              placeholder="0"
              value={draft.cullRunts === undefined ? "" : draft.cullRunts}
              onChange={(e) => setDraft({ ...draft, cullRunts: e.target.value === "" ? undefined : clampNum(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Cull Legs</label>
            <input
              type="number" min={0}
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              placeholder="0"
              value={draft.cullLegs === undefined ? "" : draft.cullLegs}
              onChange={(e) => setDraft({ ...draft, cullLegs: e.target.value === "" ? undefined : clampNum(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Cull Non-Start</label>
            <input
              type="number" min={0}
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              placeholder="0"
              value={draft.cullNonStart === undefined ? "" : draft.cullNonStart}
              onChange={(e) => setDraft({ ...draft, cullNonStart: e.target.value === "" ? undefined : clampNum(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Cull Other</label>
            <input
              type="number" min={0}
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              placeholder="0"
              value={draft.cullOther === undefined ? "" : draft.cullOther}
              onChange={(e) => setDraft({ ...draft, cullOther: e.target.value === "" ? undefined : clampNum(e.target.value) })}
            />
          </div>
        </div>

        <div className="mt-3">
          <button
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
            onClick={addRow}
            disabled={!selectedShed}
          >
            Add
          </button>
        </div>
      </div>

      {/* Breakdown table (Day Age only; editable & removable) */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="font-medium mb-3">Breakdown — {selectedShed || "No shed selected"}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">Day Age</th>
                <th className="py-2 pr-2">Morts</th>
                <th className="py-2 pr-2">Cull Runts</th>
                <th className="py-2 pr-2">Cull Legs</th>
                <th className="py-2 pr-2">Cull Non-Start</th>
                <th className="py-2 pr-2">Cull Other</th>
                <th className="py-2 pr-2">Total</th>
                <th className="py-2 pr-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shedRows.map((r) => {
                const place = metaByShed.get(selectedShed || "");
                const age = place?.placementDate ? daysBetweenUTC(place.placementDate, r.date) : undefined;
                const total = (mortsOnly(r) + cullsOnly(r)) || 0;
                const isEditing = editingId === r.id;

                return (
                  <tr key={r.id} className="border-b">
                    <td className="py-2 pr-2">{typeof age === "number" ? age : "—"}</td>

                    <td className="py-2 pr-2">
                      {isEditing ? (
                        <input
                          type="number" min={0}
                          className="border rounded px-2 py-1 placeholder-transparent"
                          placeholder="0"
                          value={edit?.morts === undefined ? "" : edit?.morts}
                          onChange={(e) => setEdit((s) => ({ ...(s as Row), morts: e.target.value === "" ? undefined : clampNum(e.target.value) }))}
                        />
                      ) : (
                        mortsOnly(r)
                      )}
                    </td>

                    <td className="py-2 pr-2">
                      {isEditing ? (
                        <input
                          type="number" min={0}
                          className="border rounded px-2 py-1 placeholder-transparent"
                          placeholder="0"
                          value={edit?.cullRunts === undefined ? "" : edit?.cullRunts}
                          onChange={(e) => setEdit((s) => ({ ...(s as Row), cullRunts: e.target.value === "" ? undefined : clampNum(e.target.value) }))}
                        />
                      ) : (
                        Number(r.cullRunts) || 0
                      )}
                    </td>

                    <td className="py-2 pr-2">
                      {isEditing ? (
                        <input
                          type="number" min={0}
                          className="border rounded px-2 py-1 placeholder-transparent"
                          placeholder="0"
                          value={edit?.cullLegs === undefined ? "" : edit?.cullLegs}
                          onChange={(e) => setEdit((s) => ({ ...(s as Row), cullLegs: e.target.value === "" ? undefined : clampNum(e.target.value) }))}
                        />
                      ) : (
                        Number(r.cullLegs) || 0
                      )}
                    </td>

                    <td className="py-2 pr-2">
                      {isEditing ? (
                        <input
                          type="number" min={0}
                          className="border rounded px-2 py-1 placeholder-transparent"
                          placeholder="0"
                          value={edit?.cullNonStart === undefined ? "" : edit?.cullNonStart}
                          onChange={(e) => setEdit((s) => ({ ...(s as Row), cullNonStart: e.target.value === "" ? undefined : clampNum(e.target.value) }))}
                        />
                      ) : (
                        Number(r.cullNonStart) || 0
                      )}
                    </td>

                    <td className="py-2 pr-2">
                      {isEditing ? (
                        <input
                          type="number" min={0}
                          className="border rounded px-2 py-1 placeholder-transparent"
                          placeholder="0"
                          value={edit?.cullOther === undefined ? "" : edit?.cullOther}
                          onChange={(e) => setEdit((s) => ({ ...(s as Row), cullOther: e.target.value === "" ? undefined : clampNum(e.target.value) }))}
                        />
                      ) : (
                        Number(r.cullOther) || 0
                      )}
                    </td>

                    <td className="py-2 pr-2">{total}</td>

                    <td className="py-2 pr-2">
                      {isEditing ? (
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
                );
              })}
              {shedRows.length === 0 && (
                <tr><td className="py-6 text-gray-500" colSpan={8}>No entries for this shed.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
