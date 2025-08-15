import { useMemo, useState } from "react";
import { useServerState } from "../lib/serverState";

type Delivery = { shed: string; type: "Starter" | "Grower" | "Finisher" | "Booster"; tonnes: number; date: string };
type Alloc = Record<"Starter" | "Grower" | "Finisher", number>; // loads per day (x24 = tonnes/day)

function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function FeedSilos() {
  const { state: sheds } = useServerState<string[]>("sheds", []);

  const { state: deliveries, setState: setDeliveries, loading, synced } =
    useServerState<Delivery[]>("deliveries", []);

  const { state: allocations, setState: setAlloc } =
    useServerState<Alloc>("allocations", { Starter: 0, Grower: 0, Finisher: 0 });

  const [shed, setShed] = useState("");
  const [form, setForm] = useState<Delivery>({ shed: "", type: "Starter", tonnes: 0, date: todayISO() });

  const allocTonnes = useMemo(
    () => ({
      Starter: (allocations["Starter"] || 0) * 24,
      Grower: (allocations["Grower"] || 0) * 24,
      Finisher: (allocations["Finisher"] || 0) * 24,
    }),
    [allocations]
  );

  function addDelivery() {
    if (!form.shed || !form.date || !form.type) return;
    setDeliveries([...deliveries, { ...form, tonnes: Number(form.tonnes || 0) }]);
    setForm({ shed: "", type: "Starter", tonnes: 0, date: todayISO() });
  }
  function removeDelivery(i: number) {
    const next = deliveries.slice(); next.splice(i, 1); setDeliveries(next);
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

      {/* Allocations */}
      <div className="bg-white border rounded-xl p-4">
        <div className="grid gap-3 md:grid-cols-3">
          {(["Starter", "Grower", "Finisher"] as const).map((k) => (
            <div key={k}>
              <label className="text-sm text-slate-500 block mb-1">{k} loads per hour</label>
              <input
                type="number"
                value={allocations[k] || 0}
                onChange={(e) => setAlloc({ ...allocations, [k]: Number(e.target.value || 0) })}
                className="border rounded p-2 w-full"
              />
              <div className="text-xs text-slate-500 mt-1">≈ {allocTonnes[k].toFixed(2)} t / day</div>
            </div>
          ))}
        </div>
      </div>

      {/* Add delivery */}
      <div className="grid gap-3 md:grid-cols-5 bg-white p-4 border rounded-xl">
        <select value={form.shed} onChange={(e) => setForm({ ...form, shed: e.target.value })} className="border rounded p-2">
          <option value="">Shed</option>
          {sheds.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Delivery["type"] })} className="border rounded p-2">
          {(["Starter", "Grower", "Finisher", "Booster"] as const).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border rounded p-2" />
        <input type="number" placeholder="Tonnes" value={form.tonnes} onChange={(e) => setForm({ ...form, tonnes: Number(e.target.value || 0) })} className="border rounded p-2" />
        <button onClick={addDelivery} className="rounded-lg bg-slate-900 text-white px-3 py-2">Add</button>
      </div>

      {/* List */}
      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3 border-b">Date</th>
              <th className="p-3 border-b">Shed</th>
              <th className="p-3 border-b">Type</th>
              <th className="p-3 border-b">Tonnes</th>
              <th className="p-3 border-b"></th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d, i) => (
              <tr key={i} className="border-b last:border-none">
                <td className="p-3">{d.date}</td>
                <td className="p-3">{d.shed}</td>
                <td className="p-3">{d.type}</td>
                <td className="p-3">{d.tonnes.toFixed(2)}</td>
                <td className="p-3 text-right"><button onClick={() => removeDelivery(i)} className="text-red-600 hover:underline">remove</button></td>
              </tr>
            ))}
            {!deliveries.length && <tr><td className="p-6 text-slate-500" colSpan={5}>No deliveries yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
