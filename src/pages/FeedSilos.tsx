import { useMemo, useState } from "react";
import { useCloudSlice } from "../lib/cloudSlice";

type Delivery = { shed: string; type: "Starter" | "Grower" | "Finisher" | "Booster"; tonnes: number; date: string };
type Alloc = Record<"Starter" | "Grower" | "Finisher", number>; // loads per day (x24 = tonnes/day)

function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function FeedSilos() {
  const { state: shedsRaw } = useCloudSlice<any>("sheds", []);
  const sheds: string[] = Array.isArray(shedsRaw)
    ? shedsRaw.map((x: any) => (typeof x === "string" ? x : x?.name)).filter(Boolean)
    : [];

  const { state: deliveries, setState: setDeliveries, loading, synced } =
    useCloudSlice<Delivery[]>("deliveries", []);

  const { state: allocations, setState: setAlloc } =
    useCloudSlice<Alloc>("allocations", { Starter: 0, Grower: 0, Finisher: 0 });

  const [shed, setShed] = useState("");
  const [form, setForm] = useState<Delivery>({ shed: "", type: "Starter", tonnes: 0, date: todayISO() });

  const dailyTonnes = useMemo(() => {
    const loads = allocations.Starter + allocations.Grower + allocations.Finisher;
    return loads * 24;
  }, [allocations]);

  function addDelivery() {
    if (!form.shed || !form.tonnes || form.tonnes <= 0) return;
    setDeliveries((prev) => [...(prev || []), { ...form }]);
    setForm({ shed: "", type: "Starter", tonnes: 0, date: todayISO() });
  }

  function removeDelivery(idx: number) {
    setDeliveries((prev) => (prev || []).filter((_, i) => i !== idx));
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="mb-4 flex items-center gap-3">
        {!loading && (
          <span
            className={`text-xs px-2 py-1 rounded border ${
              synced ? "text-green-700 border-green-200 bg-green-50" : "text-amber-700 border-amber-200 bg-amber-50"
            }`}
          >
            {synced ? "Synced" : "Saving…"}
          </span>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Allocations */}
        <section className="p-4 rounded-2xl border bg-white">
          <h2 className="text-lg font-medium mb-3">Allocations (loads per hour)</h2>
          {(["Starter", "Grower", "Finisher"] as const).map((t) => (
            <div key={t} className="flex items-center gap-3 mb-2">
              <label className="w-24">{t}</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={allocations[t]}
                onChange={(e) => setAlloc({ ...allocations, [t]: Number(e.target.value) })}
                className="border rounded px-2 py-1 w-32"
              />
            </div>
          ))}
          <div className="text-sm text-slate-600 mt-2">≈ {dailyTonnes.toFixed(2)} tonnes/day</div>
        </section>

        {/* Deliveries */}
        <section className="p-4 rounded-2xl border bg-white">
          <h2 className="text-lg font-medium mb-3">Add delivery</h2>
          <div className="flex flex-wrap items-center gap-3">
            <select value={form.shed} onChange={(e) => setForm({ ...form, shed: e.target.value })} className="border rounded px-2 py-1">
              <option value="">Select shed…</option>
              {sheds.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })} className="border rounded px-2 py-1">
              {(["Starter", "Grower", "Finisher", "Booster"] as const).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="number" min={0} step={0.01} value={form.tonnes} onChange={(e) => setForm({ ...form, tonnes: Number(e.target.value) })} className="border rounded px-2 py-1 w-32" />
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border rounded px-2 py-1" />
            <button onClick={addDelivery} className="px-3 py-2 rounded bg-slate-900 text-white">Add</button>
          </div>

          <table className="w-full mt-4 text-sm border-separate border-spacing-y-1">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="p-2">Date</th>
                <th className="p-2">Shed</th>
                <th className="p-2">Type</th>
                <th className="p-2">Tonnes</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {(deliveries || []).map((d, i) => (
                <tr key={i} className="bg-white rounded">
                  <td className="p-3">{d.date}</td>
                  <td className="p-3">{d.shed}</td>
                  <td className="p-3">{d.type}</td>
                  <td className="p-3">{d.tonnes.toFixed(2)}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => removeDelivery(i)} className="text-red-600 hover:underline">remove</button>
                  </td>
                </tr>
              ))}
              {!deliveries?.length && <tr><td className="p-6 text-slate-500" colSpan={5}>No deliveries yet.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
