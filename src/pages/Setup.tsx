import { useServerState } from "../lib/serverState";
import { useState } from "react";

type Shed = { id: string; name: string };

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function Setup() {
  const { state: sheds, setState: setSheds, loading, synced } =
    useServerState<Shed[]>("sheds", []);

  const [name, setName] = useState("");

  function add() {
    if (!name.trim()) return;
    setSheds([...sheds, { id: uid(), name: name.trim() }]);
    setName("");
  }
  function remove(id: string) {
    setSheds(sheds.filter((s) => s.id !== id));
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
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded p-2 md:col-span-3"
        />
        <button onClick={add} className="rounded-lg bg-slate-900 text-white px-3 py-2">
          Add Shed
        </button>
      </div>

      <div className="bg-white border rounded-xl divide-y">
        {sheds.map((s) => (
          <div key={s.id} className="p-4 flex items-center justify-between">
            <div className="font-medium">{s.name}</div>
            <button onClick={() => remove(s.id)} className="text-red-600 hover:underline">remove</button>
          </div>
        ))}
        {!sheds.length && <div className="p-6 text-slate-500">No sheds yet. Add one above.</div>}
      </div>
    </div>
  );
}
