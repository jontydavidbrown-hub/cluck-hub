// src/pages/Farms.tsx
import React, { useMemo, useState } from "react";
import { useFarm } from "../lib/FarmContext";

type Farm = { id: string; name: string };

export default function FarmsPage() {
  const { farms, farmId, setFarmId, createFarm, deleteFarm, email, loading, error } = useFarm();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const farmsSorted = useMemo(
    () => [...(farms || [])].sort((a: Farm, b: Farm) => a.name.localeCompare(b.name)),
    [farms]
  );

  async function onCreate() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await createFarm(name);
      setNewName("");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this farm? This cannot be undone.")) return;
    await deleteFarm(id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Farms</h1>
          <div className="text-xs text-slate-500">
            Signed in as: <span className="font-medium">{email || "—"}</span>
          </div>
        </div>
        {farms.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Current farm:</label>
            <select
              className="border rounded-lg px-2 py-1 bg-white/80 shadow-sm"
              value={farmId ?? ""}
              onChange={(e) => setFarmId(e.target.value || null)}
            >
              {farmsSorted.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading && <div className="text-slate-500">Loading…</div>}
      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border bg-white space-y-2">
          <div className="text-sm font-medium text-center">Your farms</div>
          <ul className="text-sm space-y-1">
            {farmsSorted.map((f) => (
              <li key={f.id} className="flex items-center justify-between">
                <span className={["truncate", f.id === farmId ? "font-semibold" : ""].join(" ")}>
                  {f.name}
                </span>
                <div className="flex items-center gap-2">
                  {f.id !== farmId && (
                    <button className="text-xs rounded border px-2 py-1 hover:bg-slate-50"
                      onClick={() => setFarmId(f.id)}>
                      Switch
                    </button>
                  )}
                  <button className="text-xs rounded border px-2 py-1 hover:bg-red-50 text-red-600"
                    onClick={() => onDelete(f.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
            {farms.length === 0 && <li className="text-slate-500 text-center">No farms yet.</li>}
          </ul>
        </div>

        <div className="p-4 rounded-xl border bg-white">
          <div className="text-sm font-medium text-center mb-2">Create new farm</div>
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded px-3 py-2"
              placeholder="Farm name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onCreate(); }}
            />
            <button
              className="rounded bg-slate-900 text-white px-4 py-2 disabled:opacity-60"
              disabled={busy || !newName.trim()}
              onClick={onCreate}
            >
              Create
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500 text-center">
            Data is saved per account & per farm. Switch farms using the selector above.
          </p>
        </div>
      </div>
    </div>
  );
}
