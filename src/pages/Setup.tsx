import { useServerState } from "../lib/serverState";
import { useState } from "react";

type Shed = { id: string; name: string; placedDate?: string | null; initialCount?: number | null };

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function Setup() {
  const { state: sheds, setState: setSheds, loading, synced } =
    useServerState<Shed[]>("setup.sheds", []);

  const [form, setForm] = useState<Shed>({ id: "", name: "", placedDate: todayISO(), initialCount: null });

  function add() {
    if (!form.name) return;
    setSheds([...sheds, { ...form, id: uid() }]);
    setForm({ id: "", name: "", placedDate: todayISO(), initialCount: null });
  }
  function remove(id: string) {
    setSheds(sheds.filter(s => s.id !== id));
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Setup</h1>
        {!loading && (
          <span className={`text-xs px-2 py-1 rounded border ${synced ? "text-green-700 border-green-200 bg-green-50" : "text-amber-700 border-amber-200 bg-amber-50"}`}>
            {synced ? "Synced" : "Saving…"}
          </span>
        )}
      </header>

      <div className="grid gap-3 md:grid-cols-4 bg-white p-4 border rounded-xl">
        <input
          placeholder="Shed name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="border rounded p-2"
        />
        <input
          type="date"
          value={form.placedDate ?? ""}
          onChange={(e) => setForm({ ...form, placedDate: e.target.value })}
          className="border rounded p-2"
        />
        <input
          placeholder="Initial count"
          type="number"
          value={form.initialCount ?? ""}
          onChange={(e) =>
            setForm({ ...form, initialCount: e.target.value ? Number(e.target.value) : null })
          }
          className="border rounded p-2"
        />
        <button onClick={add} className="rounded-lg bg-slate-900 text-white px-3 py-2">
          Add
        </button>
      </div>

      <div className="bg-white border rounded-xl divide-y">
        {sheds.map((s) => (
          <div key={s.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-slate-500">
                Placed: {s.placedDate || "-"} · Initial Count: {s.initialCount ?? "-"}
              </div>
            </div>
            <button onClick={() => remove(s.id)} className="text-red-600 hover:underline">
              remove
            </button>
          </div>
        ))}
        {!sheds.length && <div className="p-6 text-slate-500">No sheds yet. Add one above.</div>}
      </div>
    </div>
  );
}
