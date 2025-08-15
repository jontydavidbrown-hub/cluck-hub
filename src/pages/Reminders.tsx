import { useServerState } from "../lib/serverState";
import { useState } from "react";

type Reminder = {
  id: string;
  when: string; // ISO date
  text: string;
  done: boolean;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function Reminders() {
  const { state: reminders, setState: setReminders, loading, synced } =
    useServerState<Reminder[]>("reminders", []);
  const [form, setForm] = useState<Reminder>({ id: "", when: todayISO(), text: "", done: false });

  function add() {
    if (!form.text) return;
    const r = { ...form, id: uid() };
    setReminders([...reminders, r]);
    setForm({ id: "", when: todayISO(), text: "", done: false });
  }

  function toggle(id: string) {
    setReminders(reminders.map(r => (r.id === id ? { ...r, done: !r.done } : r)));
  }
  function remove(id: string) {
    setReminders(reminders.filter(r => r.id !== id));
  }

  const sorted = [...reminders].sort((a,b)=> (a.when > b.when ? 1 : -1));

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reminders</h1>
        {!loading && (
          <span className={`text-xs px-2 py-1 rounded border ${synced ? "text-green-700 border-green-200 bg-green-50" : "text-amber-700 border-amber-200 bg-amber-50"}`}>
            {synced ? "Synced" : "Saving…"}
          </span>
        )}
      </header>

      <div className="grid gap-3 md:grid-cols-4 bg-white p-4 border rounded-xl">
        <input
          type="date"
          value={form.when}
          onChange={(e) => setForm({ ...form, when: e.target.value })}
          className="border rounded p-2"
        />
        <input
          placeholder="Reminder"
          value={form.text}
          onChange={(e) => setForm({ ...form, text: e.target.value })}
          className="border rounded p-2 md:col-span-2"
        />
        <button onClick={add} className="rounded-lg bg-slate-900 text-white px-3 py-2">
          Add
        </button>
      </div>

      <div className="bg-white border rounded-xl divide-y">
        {sorted.map((r) => (
          <div key={r.id} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={r.done} onChange={() => toggle(r.id)} />
              <div>
                <div className={`font-medium ${r.done ? "line-through text-slate-400" : ""}`}>{r.text}</div>
                <div className="text-xs text-slate-500">{r.when}</div>
              </div>
            </div>
            <button onClick={() => remove(r.id)} className="text-red-600 hover:underline">remove</button>
          </div>
        ))}
        {!sorted.length && <div className="p-6 text-slate-500">No reminders yet.</div>}
      </div>
    </div>
  );
}
