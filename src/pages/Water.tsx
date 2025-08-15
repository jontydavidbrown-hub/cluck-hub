import { useMemo, useState } from "react";
import { useServerState } from "../lib/serverState";

type WaterLog = { date: string; chlorine: number };

function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function Water() {
  const { state: logs, setState: setLogs, loading, synced } =
    useServerState<WaterLog[]>("waterLogs", []);

  const [date, setDate] = useState<string>(todayISO());
  const [chlorine, setChlorine] = useState<string>("");

  function add() {
    const c = Number(chlorine || 0);
    if (!date) return;
    setLogs([ ...logs, { date, chlorine: c } ]);
    setDate(todayISO());
    setChlorine("");
  }
  function remove(i: number) {
    const next = logs.slice(); next.splice(i, 1); setLogs(next);
  }

  const sorted = useMemo(
    () => [...logs].sort((a, b) => (a.date > b.date ? -1 : 1)),
    [logs]
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Water</h1>
        {!loading && (
          <span className={`text-xs px-2 py-1 rounded border ${synced ? "text-green-700 border-green-200 bg-green-50" : "text-amber-700 border-amber-200 bg-amber-50"}`}>
            {synced ? "Synced" : "Saving…"}
          </span>
        )}
      </header>

      <div className="grid gap-3 md:grid-cols-4 bg-white p-4 border rounded-xl">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded p-2" />
        <input
          placeholder="Chlorine reading"
          type="number"
          step="0.01"
          value={chlorine}
          onChange={(e) => setChlorine(e.target.value)}
          className="border rounded p-2"
        />
        <button onClick={add} className="rounded-lg bg-slate-900 text-white px-3 py-2">
          Add
        </button>
      </div>

      <div className="overflow-x-auto bg-white border rounded-xl">
        <table className="min-w-full">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3 border-b">Date</th>
              <th className="p-3 border-b">Chlorine</th>
              <th className="p-3 border-b"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i} className="border-b last:border-none">
                <td className="p-3">{r.date}</td>
                <td className="p-3">{r.chlorine}</td>
                <td className="p-3 text-right">
                  <button onClick={() => remove(i)} className="text-red-600 hover:underline">remove</button>
                </td>
              </tr>
            ))}
            {!sorted.length && (
              <tr><td className="p-6 text-slate-500" colSpan={3}>No water logs yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
