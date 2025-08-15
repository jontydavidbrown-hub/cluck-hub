import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useServerState } from "../lib/serverState";

type Shed = {
  id: string;
  name: string;
  placedDate?: string | null;
  initialCount?: number | null;
};

export default function Dashboard() {
  const { state: shedsRaw } = useServerState<any>("sheds", []);
  const sheds: Shed[] = useMemo(() => {
    if (!Array.isArray(shedsRaw)) return [];
    return shedsRaw.map((x: any) =>
      typeof x === "string"
        ? { id: x, name: x, placedDate: null, initialCount: null }
        : (x as Shed)
    );
  }, [shedsRaw]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {!sheds.length && (
        <div className="p-4 border rounded-xl bg-white">
          <p className="text-slate-600">
            No sheds yet. Add them in <Link className="underline" to="/setup">Setup</Link> to see tiles here.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sheds.map((s) => (
          <div key={s.id} className="bg-white border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{s.name}</div>
                <div className="text-xs text-slate-500">
                  Placed: {s.placedDate || "-"} · Initial: {s.initialCount ?? "-"}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to={`/weights?shed=${encodeURIComponent(s.name)}`}
                className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm"
              >
                Add weight
              </Link>
              <Link
                to={`/daily-log?shed=${encodeURIComponent(s.name)}`}
                className="px-3 py-2 rounded-lg border text-sm"
              >
                Add daily log
              </Link>
              <Link
                to={`/feed-silos?shed=${encodeURIComponent(s.name)}`}
                className="px-3 py-2 rounded-lg border text-sm"
              >
                Add feed
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
