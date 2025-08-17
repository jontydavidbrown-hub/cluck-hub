import { useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar, Legend } from "recharts";
import { useCloudSlice } from "../lib/cloudSlice";
import { useFarm } from "../lib/FarmContext";

type DailyRow = { date: string; shed?: string; mortalities?: number; culls?: number; notes?: string };
type WaterRow = { date: string; ppm: number; notes?: string };
type Delivery = { date: string; type: string; tonnes?: number; kg?: number };
type Shed = { id: string; name: string; placementDate?: string };

function sortByDate<T extends { date: string }>(arr: T[]) { return [...arr].sort((a, b) => a.date.localeCompare(b.date)); }

export default function Analytics() {
  const { farmId } = useFarm();
  const [dailyLog] = useCloudSlice<DailyRow[]>("dailyLog", []);
  const [waterLogs] = useCloudSlice<WaterRow[]>("waterLogs", []);
  const [deliveries] = useCloudSlice<Delivery[]>("deliveries", []);
  const [shedsRaw] = useCloudSlice<any>("sheds", []);
  const sheds: Shed[] = Array.isArray(shedsRaw)
    ? shedsRaw.map((x: any) => (typeof x === "string" ? { id: x, name: x } : x)).filter(Boolean)
    : [];

  const shedNames = sheds.map(s => s.name);

  const dailyByShed = useMemo(() => {
    const map: Record<string, { date: string; mortalities: number; culls: number }[]> = {};
    for (const row of dailyLog || []) {
      const key = row.shed || "Unknown";
      if (!map[key]) map[key] = [];
      map[key].push({ date: row.date, mortalities: row.mortalities || 0, culls: row.culls || 0 });
    }
    Object.keys(map).forEach(k => (map[k] = sortByDate(map[k])));
    return map;
  }, [dailyLog]);

  const chlorineSeries = useMemo(() => sortByDate(waterLogs || []), [waterLogs]);

  const feedByType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of deliveries || []) {
      const key = d.type || "Unknown";
      map[key] = (map[key] || 0) + (d.tonnes || d.kg || 0);
    }
    return Object.entries(map).map(([type, total]) => ({ type, total }));
  }, [deliveries]);

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Analytics</h1>

      <section className="p-4 rounded-2xl border bg-white">
        <h2 className="text-lg font-medium mb-3">Daily mortalities per shed</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={sortByDate(dailyLog || [])}
            margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" /><YAxis /><Tooltip />
            {shedNames.map((name) => (
              <Line key={name} type="monotone" dataKey={(d: any) => (d.shed === name ? d.mortalities || 0 : 0)} name={name} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="p-4 rounded-2xl border bg-white">
        <h2 className="text-lg font-medium mb-3">Feed deliveries by type</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={feedByType}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="type" /><YAxis /><Tooltip /><Legend />
            <Bar dataKey="total" />
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
    </div>
  );
}
