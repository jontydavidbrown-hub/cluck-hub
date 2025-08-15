import { useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar, Legend } from "recharts";
import { useServerState } from "../lib/serverState";
import { useFarm } from "../lib/FarmContext";

type DailyRow = { date: string; shed?: string; mortalities?: number; culls?: number; notes?: string };
type WaterRow = { date: string; ppm: number; notes?: string };
type Delivery = { date: string; type: string; tonnes?: number; kg?: number };
type Shed = { id: string; name: string; placementDate?: string };

function sortByDate<T extends { date: string }>(arr: T[]) { return [...arr].sort((a, b) => a.date.localeCompare(b.date)); }

export default function Analytics() {
  const { farmId } = useFarm();
  const [dailyLog] = useServerState<DailyRow[]>("dailyLog", []);
  const [waterLogs] = useServerState<WaterRow[]>("waterLogs", []);
  const [deliveries] = useServerState<Delivery[]>("deliveries", []);
  const [sheds] = useServerState<Shed[]>("sheds", []);
  const [settings] = useServerState<any>("settings", { batchLengthDays: 42 });

  const mortalitiesSeries = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const r of dailyLog) { if (!r?.date) continue;
      grouped.set(r.date, (grouped.get(r.date) || 0) + (r.mortalities || 0)); }
    return sortByDate(Array.from(grouped, ([date, mortalities]) => ({ date, mortalities })));
  }, [dailyLog]);

  const cullMortalityBars = useMemo(() => {
    const grouped = new Map<string, { date: string; mortalities: number; culls: number }>();
    for (const r of dailyLog) { if (!r?.date) continue;
      const row = grouped.get(r.date) || { date: r.date, mortalities: 0, culls: 0 };
      row.mortalities += r.mortalities || 0; row.culls += r.culls || 0; grouped.set(r.date, row); }
    return sortByDate(Array.from(grouped.values()));
  }, [dailyLog]);

  const chlorineSeries = useMemo(() => sortByDate(waterLogs.map(w => ({ date: w.date, ppm: w.ppm }))), [waterLogs]);

  const feedBars = useMemo(() => {
    const toKg = (d: Delivery) => (d.kg ?? (d.tonnes ? d.tonnes * 1000 : 0));
    const grouped = new Map<string, number>();
    for (const d of deliveries) { if (!d?.date) continue;
      grouped.set(d.date, (grouped.get(d.date) || 0) + toKg(d)); }
    return sortByDate(Array.from(grouped, ([date, kg]) => ({ date, kg })));
  }, [deliveries]);

  return (
    <div className="p-4 space-y-8">
      <h1 className="text-2xl font-semibold">Analytics</h1>

      <section className="p-4 rounded-2xl border bg-white">
        <h2 className="text-lg font-medium mb-3">Mortality over time</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={mortalitiesSeries}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" /><YAxis /><Tooltip />
            <Line type="monotone" dataKey="mortalities" />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="p-4 rounded-2xl border bg-white">
        <h2 className="text-lg font-medium mb-3">Culls vs Mortalities</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={cullMortalityBars}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" /><YAxis /><Tooltip /><Legend />
            <Bar dataKey="mortalities" stackId="a" />
            <Bar dataKey="culls" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="p-4 rounded-2xl border bg-white">
        <h2 className="text-lg font-medium mb-3">Chlorine (ppm)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chlorineSeries}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" /><YAxis /><Tooltip />
            <Line type="monotone" dataKey="ppm" />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="p-4 rounded-2xl border bg-white">
        <h2 className="text-lg font-medium mb-3">Feed delivered (kg)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={feedBars}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" /><YAxis /><Tooltip />
            <Bar dataKey="kg" />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
