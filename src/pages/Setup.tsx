import { useEffect, useMemo, useState } from "react";
import { useCloudSlice } from "../lib/cloudSlice";

type Settings = {
  batchLengthDays?: number;
  // (anything else you already store is preserved)
};

type Shed = {
  id: string;
  name: string;
  placementDate?: string;     // YYYY-MM-DD
  placementBirds?: number;    // number, optional so placeholder can show
};

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export default function Setup() {
  // Persisted settings (unchanged key)
  const [settings, setSettings] = useCloudSlice<Settings>("settings", {});
  // Persisted sheds list (key matches typical usage; change if your repo uses a different one)
  const [sheds, setSheds] = useCloudSlice<Shed[]>("sheds", []);

  // --- Batch length: allow clearing while typing ---
  const [batchDraft, setBatchDraft] = useState<string>("");

  // Keep local draft in sync with persisted settings
  useEffect(() => {
    const v = settings.batchLengthDays;
    setBatchDraft(v == null ? "" : String(v));
  }, [settings.batchLengthDays]);

  function commitBatchLength() {
    const raw = batchDraft.trim();
    if (raw === "") {
      // Keep behavior consistent: if empty, fall back to 1 (minimum) on commit
      setSettings((prev) => ({ ...prev, batchLengthDays: 1 }));
      setBatchDraft("1");
      return;
    }
    const n = Math.max(1, Number(raw));
    setSettings((prev) => ({ ...prev, batchLengthDays: n }));
    setBatchDraft(String(n));
  }

  // --- Sheds helpers ---
  const shedsSorted = useMemo(
    () => [...(sheds || [])].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [sheds]
  );

  function addShed(nameRaw: string) {
    const name = nameRaw.trim();
    if (!name) return;
    const shed: Shed = { id: newId(), name, placementDate: "", placementBirds: undefined };
    setSheds((prev) => [...(prev || []), shed]);
  }

  function updateShed(id: string, patch: Partial<Shed>) {
    setSheds((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeShed(id: string) {
    if (!confirm("Remove this shed?")) return;
    setSheds((prev) => prev.filter((s) => s.id !== id));
  }

  // Local input for adding a shed
  const [newShedName, setNewShedName] = useState("");

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Setup</h1>

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
              value={batchDraft}                         // <-- can be empty while typing
              onChange={(e) => setBatchDraft(e.target.value)}
              onBlur={commitBatchLength}
              onKeyDown={(e) => { if (e.key === "Enter") commitBatchLength(); }}
            />
            <p className="mt-1 text-xs text-slate-500">
              You can clear the field to edit; it will commit a minimum of 1 on blur/enter.
            </p>
          </div>
        </div>
      </div>

      {/* Sheds configuration */}
      <div className="card p-4 space-y-4">
        <div className="font-medium">Sheds</div>

        {/* Add shed */}
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="flex-1 border rounded px-3 py-2"
            placeholder="New shed name (e.g., Shed 1)"
            value={newShedName}
            onChange={(e) => setNewShedName(e.target.value)}
          />
          <button
            className="rounded bg-slate-900 text-white px-4 py-2"
            onClick={() => { addShed(newShedName); setNewShedName(""); }}
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
                      value={s.placementBirds ?? ""}  {/* transparent, type-over */}
                      onChange={(e) =>
                        updateShed(
                          s.id,
                          { placementBirds: e.target.value === "" ? undefined : Number(e.target.value) }
                        )
                      }
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
          Use placement date and birds to prefill other parts of the app. Numbers use transparent placeholders so you can type over them.
        </p>
      </div>
    </div>
  );
}
