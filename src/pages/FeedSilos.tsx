import { useMemo, useState } from "react";
import { useServerState } from "../lib/serverState";

type Silo = {
  id: string;
  name: string;
  capacityT: number; // total capacity in tonnes
  levelT: number;    // current level in tonnes
  notes?: string;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function FeedSilos() {
  const { state: silos, setState: setSilos, loading, synced } =
    useServerState<Silo[]>("feedSilos", []);

  const [form, setForm] = useState<Silo>({
    id: "",
    name: "",
    capacityT: 0,
    levelT: 0,
    notes: "",
  });

  function addSilo() {
    if (!form.name) return;
    const s: Silo = { ...form, id: uid() };
    setSilos([...silos, s]);
    setForm({ id: "", name: "", capacityT: 0, levelT: 0, notes: "" });
  }

  const totals = useMemo(() => {
    const cap = silos.reduce((a, s) => a + (s.capacityT || 0), 0);
    const lvl = silos.reduce((a, s) => a + (s.levelT || 0), 0);
    return { cap, lvl, pct: cap ? Math.round((lvl / cap) * 100) : 0 };
  }, [silos]);

  function updateLevel(id: string, levelT: number) {
    setSilos(silos.map(s => (s.id === id ? { ...s, levelT } : s)));
  }
  function removeSilo(id: string) {
    setSilos(silos.filter(s => s.id !== id));
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Feed & Silos</h1>
        {!loading && (
          <span className={`text-xs px-2 py-1 rounded border ${synced ? "text-green-700 border-green-200 bg-green-50" : "text-amber-700 border-amber-200 bg-amber-50"}`}>
            {synced ? "Synced" : "Saving…"}
          </span>
        )}
      </header>

      {/* Add form */}
      <div className="grid gap-3 md:grid-cols-5 bg-white p-4 border rounded-xl">
        <input
          placeholder="Silo name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="border rounded p-2 md:col-span-1"
        />
        <input
          placeholder="Capacity (t)"
          type="number"
          value={form.capacityT || ""}
          onChange={(e) =>
            setForm({ ...form, capacityT: e.target.value ? Number(e.target.value) : 0 })
          }
          className="border rounded p-2 md:col-span-1"
        />
        <input
          placeholder="Current level (t)"
          type="number"
          value={form.levelT || ""}
          onChange={(e) =>
            setForm({ ...form, levelT: e.target.value ? Number(e.target.value) : 0 })
          }
          className="border rounded p-2 md:col-span-1"
        />
        <input
          placeholder="Notes"
          value={form.notes ?? ""}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="border rounded p-2 md:col-span-1"
        />
        <button onClick={addSilo} className="rounded-lg bg-slate-900 text-white px-3 py-2 md:col-span-1">
          Add
        </button>
      </div>

      {/* Totals */}
      <div className="bg-white border rounded-xl p-4">
        <div className="flex items-center gap-4">
          <div><b>Total capacity:</b> {totals.cap.toFixed(2)} t</div>
          <div><b>Total level:</b> {totals.lvl.toFixed(2)} t</div>
          <div><b>Fullness:</b> {totals.pct}%</div>
        </div>
      </div>

      {/* List */}
      <div className="grid gap-4 md:grid-cols-2">
        {silos.map((s) => (
          <div key={s.id} className="bg-white border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">{s.name}</h3>
              <button onClick={() => removeSilo(s.id)} className="text-red-600 hover:underline">
                remove
              </button>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <div>
                <div className="text-sm text-slate-500">Capacity (t)</div>
                <div className="font-medium">{s.capacityT.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Level (t)</div>
                <input
                  type="number"
                  value={s.levelT}
                  onChange={(e) => updateLevel(s.id, Number(e.target.value || 0))}
                  className="border rounded p-2 w-full"
                />
              </div>
              <div>
                <div className="text-sm text-slate-500">Fullness</div>
                <div className="font-medium">
                  {s.capacityT ? Math.round((s.levelT / s.capacityT) * 100) : 0}%
                </div>
              </div>
            </div>
            {s.notes && <p className="text-sm text-slate-600 mt-2">{s.notes}</p>}
          </div>
        ))}
        {!silos.length && (
          <div className="text-slate-500">No silos yet. Add one above.</div>
        )}
      </div>
    </div>
  );
}
