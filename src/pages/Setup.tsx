import { useEffect, useMemo, useState } from "react";
import { useCloudSlice } from "../lib/cloudSlice";

type Settings = {
  batchLengthDays?: number;
};

type Shed = {
  id: string;
  name: string;
  placementDate?: string;      // YYYY-MM-DD
  placementBirds?: number;     // we'll also mirror to birdsPlaced for dashboard compatibility
  birdsPlaced?: number;        // some dashboards may read this name
};

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export default function Setup() {
  // Persisted slices (keys unchanged)
  const [settings, setSettings] = useCloudSlice<Settings>("settings", {});
  const [sheds, setSheds] = useCloudSlice<Shed[]>("sheds", []);

  // Batch length uses a local draft so you can clear/retype easily
  const [batchDraft, setBatchDraft] = useState<string>("");

  // “Saved” flash
  const [justSaved, setJustSaved] = useState(false);

  // For focusing the newly added shed row
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    const v = settings.batchLengthDays;
    setBatchDraft(v == null ? "" : String(v));
  }, [settings.batchLengthDays]);

  function commitBatchLength() {
    const raw = batchDraft.trim();
    if (raw === "") {
      setSettings((prev) => ({ ...prev, batchLengthDays: 1 }));
      setBatchDraft("1");
      return;
    }
    const n = Math.max(1, Number(raw));
    setSettings((prev) => ({ ...prev, batchLengthDays: n }));
    setBatchDraft(String(n));
  }

  // Normalize shed bird fields so both names are present
  function normalizeShedBirds(s: Shed): Shed {
    const v =
      s.placementBirds != null ? Number(s.placementBirds) :
      s.birdsPlaced != null ? Number(s.birdsPlaced) :
      undefined;
    return { ...s, placementBirds: v, birdsPlaced: v };
  }

  async function handleSave() {
    // Ensure any draft is committed
    commitBatchLength();

    // Normalize & force push sheds
    setSheds((prev) => {
      const list = (prev || []).map(normalizeShedBirds);
      return [...list]; // new array to guarantee a write
    });

    // Nudge settings too (in case unchanged object)
    setSettings((prev) => ({ ...prev }));

    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 1500);
  }

  // Sorted sheds for stable UI
  const shedsSorted = useMemo(
    () => [...(sheds || [])].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [sheds]
  );

  function addBlankShedRow() {
    const id = newId();
    const shed: Shed = { id, name: "", placementDate: "", placementBirds: undefined, birdsPlaced: undefined };
    setSheds((prev) => [...(prev || []), shed]);
    setFocusId(id);
  }

  function updateShed(id: string, patch: Partial<Shed>) {
    setSheds((prev) =>
      prev.map((s) => (s.id === id ? normalizeShedBirds({ ...s, ...patch }) : s))
    );
  }

  function removeShed(id: string) {
    if (!confirm("Remove this shed?")) return;
    setSheds((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Setup</h1>
        <div className="flex items-center gap-2">
          {justSaved && <span className="text-sm text-green-600">Saved ✓</span>}
          <button className="rounded bg-slate-900 text-white px-4 py-2" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>

      {/* Batch settings */}
      <div className="card p-4 space-y-4">
        <div className="font-medium">Batch settings</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm mb-1">Batch length (days)</label>
            <input
              type="number"
              min={1}
              placeholder="0"
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              value={batchDraft}
              onChange={(e) => setBatchDraft(e.target.value)}
              onBlur={commitBatchLength}
              onKeyDown={(e) => { if (e.key === "Enter") commitBatchLength(); }}
            />
            <p className="mt-1 text-xs text-slate-500">
              Clear to edit; commits a minimum of 1 on blur/enter.
            </p>
          </div>
        </div>
      </div>

      {/* Sheds configuration */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-medium">Sheds</div>
          <button
            className="rounded bg-slate-900 text-white px-4 py-2"
            onClick={addBlankShedRow}
          >
            Add Shed
          </button>
        </div>

        {/* List/edit sheds */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">Shed</th>
                <th className="py-2 pr-2">Placement date</th>
                <th className="py-2 pr-2">Placement birds</th>
                <th className="py-2 pr-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shedsSorted.map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="py-2 pr-2">
                    <input
                      className="border rounded px-2 py-1"
                      value={s.name}
                      autoFocus={s.id === focusId}
                      onChange={(e) => updateShed(s.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="date"
                      className="border rounded px-2 py-1"
                      value={s.placementDate || ""}
                      onChange={(e) => updateShed(s.id, { placementDate: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      className="border rounded px-2 py-1 placeholder-transparent"
                      value={s.placementBirds ?? s.birdsPlaced ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const v = raw === "" ? undefined : Number(raw);
                        updateShed(s.id, { placementBirds: v, birdsPlaced: v });
                      }}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <button
                      className="px-2 py-1 border rounded text-red-600"
                      onClick={() => removeShed(s.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {shedsSorted.length === 0 && (
                <tr>
                  <td className="py-6 text-gray-500" colSpan={4}>No sheds yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-600">
          Numbers use transparent placeholders so you can type over them. We sync both “placementBirds” and “birdsPlaced” for dashboard compatibility.
        </p>
      </div>
    </div>
  );
}
