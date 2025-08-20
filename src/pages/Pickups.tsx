// src/pages/Pickups.tsx
import { useMemo, useState } from "react";
import { useCloudSlice } from "../lib/cloudSlice";

type Shed = {
  id: string;
  name: string;
  placementDate?: string;     // YYYY-MM-DD
  placementBirds?: number;    // legacy
  birdsPlaced?: number;       // current
};

type Pickup = {
  id: string;
  date: string;   // YYYY-MM-DD
  shedId: string;
  birds: number;  // number of birds picked up (live hauled)
};

const uuid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Math.random()).slice(2));

/** Day age on a specific date (1-based). If no date provided, uses today. */
function dayAgeOn(placement?: string, onDate?: string): number | null {
  if (!placement) return null;
  const start = new Date(placement + "T00:00:00");
  const at = onDate ? new Date(onDate + "T00:00:00") : new Date();
  if (isNaN(+start) || isNaN(+at)) return null;
  const diff = Math.floor((+at - +start) / 86400000);
  return Math.max(0, diff + 1);
}

export default function Pickups() {
  // Cloud slices (scoped by farm via useCloudSlice)
  const [sheds] = useCloudSlice<Shed[]>("sheds", []);
  const [rows, setRows] = useCloudSlice<Pickup[]>("pickups", []);

  const shedsSorted = useMemo(
    () => [...(sheds || [])].sort((a, b) => (a?.name || "").localeCompare(b?.name || "")),
    [sheds]
  );

  // Top Shed selector (large control)
  const [shedSel, setShedSel] = useState<string>(() => shedsSorted[0]?.id || "");
  const selectedShed = useMemo(
    () => shedsSorted.find((s) => s.id === shedSel) || null,
    [shedSel, shedsSorted]
  );

  // Draft add form (shed controlled by the big selector)
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState<string>(today);
  const [birds, setBirds] = useState<string>("");

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string>(today);
  const [editBirds, setEditBirds] = useState<string>("0");

  // Derived table (show ALL pickups; you can filter to shed if you prefer)
  const sorted = useMemo(
    () =>
      [...(rows || [])].sort((a, b) =>
        (a.date || "").localeCompare(b.date || "") || (a.id || "").localeCompare(b.id || "")
      ),
    [rows]
  );

  function addPickup() {
    if (!shedSel) return alert("Please select a shed first.");
    const count = Number(birds);
    if (!Number.isFinite(count) || count <= 0) return;
    const next: Pickup = { id: uuid(), date: date || today, shedId: shedSel, birds: Math.floor(count) };
    setRows([...(rows || []), next]);
    setDate(today);
    setBirds("");
  }

  function startEdit(r: Pickup) {
    setEditingId(r.id);
    setEditDate(r.date);
    setEditBirds(String(r.birds ?? 0));
  }
  function saveEdit(id: string) {
    const n = Math.max(0, Math.floor(Number(editBirds) || 0));
    setRows((prev) => (prev || []).map((r) => (r.id === id ? { ...r, date: editDate || r.date, birds: n } : r)));
    setEditingId(null);
  }
  function remove(id: string) {
    if (!confirm("Remove this pickup entry?")) return;
    setRows((prev) => (prev || []).filter((r) => r.id !== id));
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pickups</h1>
      </div>

      {/* Large shed selector */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="text-sm mb-2 text-slate-600 text-center">Shed</div>
        <div className="flex justify-center">
          <select
            className="border rounded px-3 py-2 bg-white placeholder-transparent"
            value={shedSel}
            onChange={(e) => setShedSel(e.target.value)}
          >
            {shedsSorted.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name || `Shed ${String(s.id).slice(0, 4)}`}
              </option>
            ))}
          </select>
        </div>
        {selectedShed && (
          <p className="mt-2 text-center text-xs text-slate-500">
            Day age on <b>{date}</b>:{" "}
            <b>{dayAgeOn(selectedShed.placementDate, date) ?? "—"}</b>
          </p>
        )}
      </div>

      {/* Add entry (shed comes from the selector above) */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="font-medium mb-3">Add Entry</div>
        <div className="grid md:grid-cols-3 gap-3">
          <label className="block">
            <div className="text-sm mb-1">Date</div>
            <input
              type="date"
              className="w-full border rounded px-3 py-2 placeholder-transparent"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="block">
            <div className="text-sm mb-1">Birds Picked Up</div>
            <input
              type="number"
              min={0}
              className="w-full border rounded px-3 py-2 placeholder-transparent"
              placeholder="0"
              value={birds}
              onChange={(e) => setBirds(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addPickup();
              }}
            />
          </label>
          <div className="flex items-end">
            <button className="rounded bg-slate-900 text-white px-4 py-2 w-full md:w-auto" onClick={addPickup}>
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Table of all pickups */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="font-medium mb-3">Saved Pickups</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">Date</th>
                <th className="py-2 pr-2">Day Age</th>
                <th className="py-2 pr-2">Shed</th>
                <th className="py-2 pr-2">Birds</th>
                <th className="py-2 pr-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const shed = shedsSorted.find((s) => s.id === r.shedId);
                const isEdit = editingId === r.id;
                const dateForAge = isEdit ? editDate : r.date;
                const dayAge = dayAgeOn(shed?.placementDate, dateForAge);
                const shedName = shed?.name || `Shed ${String(r.shedId).slice(0, 4)}`;
                return (
                  <tr key={r.id} className="border-b">
                    <td className="py-2 pr-2">
                      {isEdit ? (
                        <input
                          type="date"
                          className="border rounded px-2 py-1"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                        />
                      ) : (
                        r.date
                      )}
                    </td>
                    <td className="py-2 pr-2">{dayAge ?? "—"}</td>
                    <td className="py-2 pr-2">{shedName}</td>
                    <td className="py-2 pr-2">
                      {isEdit ? (
                        <input
                          type="number"
                          min={0}
                          className="border rounded px-2 py-1"
                          value={editBirds}
                          onChange={(e) => setEditBirds(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(r.id);
                          }}
                        />
                      ) : (
                        (r.birds ?? 0).toLocaleString()
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      {isEdit ? (
                        <div className="flex gap-2">
                          <button className="px-2 py-1 border rounded" onClick={() => saveEdit(r.id)}>
                            Save
                          </button>
                          <button
                            className="px-2 py-1 border rounded"
                            onClick={() => {
                              setEditingId(null);
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
                  <td className="py-6 text-gray-500" colSpan={5}>
                    No pickup entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
