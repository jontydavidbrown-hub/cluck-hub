import { useMemo, useState } from "react";
import { useServerState } from "../lib/serverState";

// Adjust fields to taste
type DailyEntry = {
  id: string;
  date: string;       // ISO date
  shed: string;
  tempAM?: number | null;
  tempPM?: number | null;
  mortalities?: number | null;
  comments?: string;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function DailyLog() {
  const { state: log, setState: setLog, loading, synced } =
    useServerState<DailyEntry[]>("dailyLog", []);

  const [form, setForm] = useState<DailyEntry>({
    id: "",
    date: todayISO(),
    shed: "",
    tempAM: null,
    tempPM: null,
    mortalities: null,
    comments: "",
  });

  const sorted = useMemo(
    () =>
      [...log].sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0)),
    [log]
  );

  function addEntry() {
    if (!form.shed) return;
    const entry: DailyEntry = { ...form, id: uid() };
    setLog([...log, entry]);
    setForm({
      id: "",
      date: todayISO(),
      shed: "",
      tempAM: null,
      tempPM: null,
      mortalities: null,
      comments: "",
    });
  }

  function removeEntry(id: string) {
    setLog(log.filter((e) => e.id !== id));
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Daily Log</h1>
        {!loading && (
          <span className={`text-xs px-2 py-1 rounded border ${synced ? "text-green-700 border-green-200 bg-green-50" : "text-amber-700 border-amber-200 bg-amber-50"}`}>
            {synced ? "Synced" : "Saving…"}
          </span>
        )}
      </header>

      {/* Entry form */}
      <div className="grid gap-3 md:grid-cols-7 bg-white p-4 border rounded-xl">
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="border rounded p-2 md:col-span-1"
        />
        <input
          placeholder="Shed"
          value={form.shed}
          onChange={(e) => setForm({ ...form, shed: e.target.value })}
          className="border rounded p-2 md:col-span-1"
        />
        <input
          placeholder="Temp AM"
          type="number"
          value={form.tempAM ?? ""}
          onChange={(e) =>
            setForm({ ...form, tempAM: e.target.value ? Number(e.target.value) : null })
          }
          className="border rounded p-2 md:col-span-1"
        />
        <input
          placeholder="Temp PM"
          type="number"
          value={form.tempPM ?? ""}
          onChange={(e) =>
            setForm({ ...form, tempPM: e.target.value ? Number(e.target.value) : null })
          }
          className="border rounded p-2 md:col-span-1"
        />
        <input
          placeholder="Mortalities"
          type="number"
          value={form.mortalities ?? ""}
          onChange={(e) =>
            setForm({
              ...form,
              mortalities: e.target.value ? Number(e.target.value) : null,
            })
          }
          className="border rounded p-2 md:col-span-1"
        />
        <input
          placeholder="Comments"
          value={form.comments ?? ""}
          onChange={(e) => setForm({ ...form, comments: e.target.value })}
          className="border rounded p-2 md:col-span-1"
        />
        <button onClick={addEntry} className="rounded-lg bg-slate-900 text-white px-3 py-2 md:col-span-1">
          Add
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border rounded-xl overflow-hidden">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3 border-b">Date</th>
              <th className="p-3 border-b">Shed</th>
              <th className="p-3 border-b">Temp AM</th>
              <th className="p-3 border-b">Temp PM</th>
              <th className="p-3 border-b">Mortalities</th>
              <th className="p-3 border-b">Comments</th>
              <th className="p-3 border-b"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => (
              <tr key={e.id} className="border-b last:border-none">
                <td className="p-3">{e.date}</td>
                <td className="p-3">{e.shed}</td>
                <td className="p-3">{e.tempAM ?? "-"}</td>
                <td className="p-3">{e.tempPM ?? "-"}</td>
                <td className="p-3">{e.mortalities ?? "-"}</td>
                <td className="p-3">{e.comments ?? "-"}</td>
                <td className="p-3 text-right">
                  <button onClick={() => removeEntry(e.id)} className="text-red-600 hover:underline">
                    remove
                  </button>
                </td>
              </tr>
            ))}
            {!sorted.length && (
              <tr>
                <td className="p-6 text-slate-500" colSpan={7}>
                  No log entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
