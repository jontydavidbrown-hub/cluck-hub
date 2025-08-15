import { useMemo, useState } from "react";
import { useServerState } from "../lib/serverState";

type WeightRec = {
  id: string;
  date: string;      // ISO date
  shed: string;
  buckets: number;   // number of buckets weighed
  birdsPerBucket: number;
  totalWeightKg: number; // total combined weight of those buckets (kg)
  notes?: string;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function Weights() {
  const { state: records, setState: setRecords, loading, synced } =
    useServerState<WeightRec[]>("weights", []);

  const [form, setForm] = useState<WeightRec>({
    id: "",
    date: todayISO(),
    shed: "",
    buckets: 1,
    birdsPerBucket: 10,
    totalWeightKg: 0,
    notes: "",
  });

  function addRecord() {
    if (!form.shed || !form.buckets || !form.birdsPerBucket) return;
    const rec: WeightRec = { ...form, id: uid() };
    setRecords([...records, rec]);
    setForm({
      id: "",
      date: todayISO(),
      shed: "",
      buckets: 1,
      birdsPerBucket: 10,
      totalWeightKg: 0,
      notes: "",
    });
  }

  function removeRecord(id: string) {
    setRecords(records.filter((r) => r.id !== id));
  }

  const withCalcs = useMemo(
    () =>
      records.map((r) => {
        const totalBirds = r.buckets * r.birdsPerBucket;
        const avgPerBird = totalBirds ? r.totalWeightKg * 1000 / totalBirds : 0; // grams
        return { ...r, totalBirds, avgPerBird };
      }),
    [records]
  );

  const byDate = useMemo(() => {
    const groups = new Map<string, typeof withCalcs>();
    for (const r of withCalcs) {
      const arr = groups.get(r.date) || [];
      arr.push(r);
      groups.set(r.date, arr);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => (a > b ? -1 : 1));
  }, [withCalcs]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Weights</h1>
        {!loading && (
          <span className={`text-xs px-2 py-1 rounded border ${synced ? "text-green-700 border-green-200 bg-green-50" : "text-amber-700 border-amber-200 bg-amber-50"}`}>
            {synced ? "Synced" : "Saving…"}
          </span>
        )}
      </header>

      {/* Input */}
      <div className="grid gap-3 md:grid-cols-6 bg-white p-4 border rounded-xl">
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
          placeholder="Buckets"
          type="number"
          value={form.buckets}
          onChange={(e) => setForm({ ...form, buckets: Number(e.target.value || 0) })}
          className="border rounded p-2 md:col-span-1"
        />
        <input
          placeholder="Birds per bucket"
          type="number"
          value={form.birdsPerBucket}
          onChange={(e) =>
            setForm({ ...form, birdsPerBucket: Number(e.target.value || 0) })
          }
          className="border rounded p-2 md:col-span-1"
        />
        <input
          placeholder="Total weight (kg)"
          type="number"
          step="0.01"
          value={form.totalWeightKg}
          onChange={(e) =>
            setForm({ ...form, totalWeightKg: Number(e.target.value || 0) })
          }
          className="border rounded p-2 md:col-span-1"
        />
        <button onClick={addRecord} className="rounded-lg bg-slate-900 text-white px-3 py-2 md:col-span-1">
          Add
        </button>
        <input
          placeholder="Notes (optional)"
          value={form.notes ?? ""}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="border rounded p-2 md:col-span-6"
        />
      </div>

      {/* Groups by date */}
      <div className="space-y-4">
        {byDate.map(([date, arr]) => (
          <div key={date} className="bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b font-semibold">{date}</div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="text-left">
                  <tr>
                    <th className="p-3 border-b">Shed</th>
                    <th className="p-3 border-b">Buckets</th>
                    <th className="p-3 border-b">Birds/Bucket</th>
                    <th className="p-3 border-b">Total Birds</th>
                    <th className="p-3 border-b">Total (kg)</th>
                    <th className="p-3 border-b">Avg per bird (g)</th>
                    <th className="p-3 border-b">Notes</th>
                    <th className="p-3 border-b"></th>
                  </tr>
                </thead>
                <tbody>
                  {arr.map((r) => (
                    <tr key={r.id} className="border-b last:border-none">
                      <td className="p-3">{r.shed}</td>
                      <td className="p-3">{r.buckets}</td>
                      <td className="p-3">{r.birdsPerBucket}</td>
                      <td className="p-3">{r.totalBirds}</td>
                      <td className="p-3">{r.totalWeightKg.toFixed(2)}</td>
                      <td className="p-3">{Math.round(r.avgPerBird)}</td>
                      <td className="p-3">{r.notes ?? "-"}</td>
                      <td className="p-3 text-right">
                        <button onClick={() => removeRecord(r.id)} className="text-red-600 hover:underline">
                          remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!arr.length && (
                    <tr>
                      <td className="p-6 text-slate-500" colSpan={8}>
                        No records.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {!byDate.length && (
          <div className="text-slate-500">No weight records yet. Add one above.</div>
        )}
      </div>
    </div>
  );
}
