import { useEffect, useMemo, useState } from "react";
import { useServerState } from "../lib/serverState";

type Mort = {
  shed: string;
  date: string;
  deads: number;
  runtCulls: number;
  legCulls: number;
};

type Shed = { id: string; name: string };

function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function DailyLog() {
  const { state: shedsRaw } = useServerState<any>("sheds", []);
  const shedNames = useMemo<string[]>(() => {
    if (!Array.isArray(shedsRaw)) return [];
    return shedsRaw.map((x: any) => (typeof x === "string" ? x : x?.name)).filter(Boolean);
  }, [shedsRaw]);

  const { state: entries, setState: setEntries, loading, synced } =
    useServerState<Mort[]>("dailyLog", []);

  const [shed, setShed] = useState("");
  const [date, setDate] = useState(todayISO());
  const [deads, setDeads] = useState<number | "">("");
  const [runt, setRunt] = useState<number | "">("");
  const [leg, setLeg] = useState<number | "">("");

  // Preselect shed from ?shed=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const target = params.get("shed");
    if (target && shedNames.includes(target)) {
      setShed(target);
    } else if (!shed && shedNames.length) {
      setShed(shedNames[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shedNames.join("|")]);

  const sorted = useMemo(
    () => [...entries].sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0)),
    [entries]
  );

  function add() {
    if (!shed || !date) return;
    const m: Mort = {
      shed,
      date,
      deads: Number(deads || 0),
      runtCulls: Number(runt || 0),
      legCulls: Number(leg || 0),
    };
    setEntries([...entries, m]);
    setDeads(""); setRunt(""); setLeg("");
  }

  function remove(idx: number) {
    const next = entries.slice(); next.splice(idx, 1); setEntries(next);
  }

  const totals = useMemo(() => {
    const t = { deads: 0, runtCulls: 0, legCulls: 0 };
    for (const e of entries) { t.deads += e.deads; t.runtCulls += e.runtCulls; t.legCulls += e.legCulls; }
    return t;
  }, [entries]);

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

      {/* Form */}
      <div className="grid gap-3 md:grid-cols-6 bg-white p-4 border rounded-xl">
        <select value={shed} onChange={(e) => setShed(e.target.value)} className="border rounded p-2">
          <option value="">Select shed</option>
          {shedNames.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded p-2" />
        <input placeholder="Deads" type="number" value={deads} onChange={(e) => setDeads(e.target.value === "" ? "" : Number(e.target.value))} className="border rounded p-2" />
        <input placeholder="Runt culls" type="number" value={runt} onChange={(e) => setRunt(e.target.value === "" ? "" : Number(e.target.value))} className="border rounded p-2" />
        <input placeholder="Leg culls" type="number" value={leg} onChange={(e) => setLeg(e.target.value === "" ? "" : Number(e.target.value))} className="border rounded p-2" />
        <button onClick={add} className="rounded-lg bg-slate-900 text-white px-3 py-2">Add</button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border rounded-xl overflow-hidden">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3 border-b">Date</th>
              <th className="p-3 border-b">Shed</th>
              <th className="p-3 border-b">Deads</th>
              <th className="p-3 border-b">Runt culls</th>
              <th className="p-3 border-b">Leg culls</th>
              <th className="p-3 border-b"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e, i) => (
              <tr key={i} className="border-b last:border-none">
                <td className="p-3">{e.date}</td>
                <td className="p-3">{e.shed}</td>
                <td className="p-3">{e.deads}</td>
                <td className="p-3">{e.runtCulls}</td>
                <td className="p-3">{e.legCulls}</td>
                <td className="p-3 text-right">
                  <button onClick={() => remove(i)} className="text-red-600 hover:underline">remove</button>
                </td>
              </tr>
            ))}
            {!sorted.length && (
              <tr><td className="p-6 text-slate-500" colSpan={6}>No entries yet.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-medium">
              <td className="p-3" colSpan={2}>Totals</td>
              <td className="p-3">{totals.deads}</td>
              <td className="p-3">{totals.runtCulls}</td>
              <td className="p-3">{totals.legCulls}</td>
              <td className="p-3" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
