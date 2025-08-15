import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useServerState } from "../lib/serverState";
import { DEFAULT_SETTINGS, normalizeSettings } from "../lib/defaults";

type Shed = {
  id: string;
  name: string;
  placedDate?: string | null;
  initialCount?: number | null;
};
type Settings = { batchLengthDays: number };

function daysBetween(isoStart: string, isoEnd: string) {
  // Compare by local date (strip time to avoid TZ off-by-ones)
  const a = new Date(isoStart + "T00:00:00");
  const b = new Date(isoEnd + "T00:00:00");
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

export default function Dashboard() {
  const { state: shedsRaw } = useServerState<any>("sheds", []);
  // ✅ Always load settings with defaults and normalize before use
  const { state: settingsRaw } = useServerState<Settings>("settings", DEFAULT_SETTINGS);
  const settings = normalizeSettings(settingsRaw);

  const sheds: Shed[] = useMemo(() => {
    if (!Array.isArray(shedsRaw)) return [];
    return shedsRaw.map((x: any) =>
      typeof x === "string"
        ? { id: x, name: x, placedDate: null, initialCount: null }
        : (x as Shed)
    );
  }, [shedsRaw]);

  const batchDays = Math.max(1, Number(settings.batchLengthDays)); // never undefined now
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);

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
        {sheds.map((s) => {
          const placed = s.placedDate || todayISO; // if not set, treat as today (progress 0)
          const day = daysBetween(placed, todayISO) + 1; // show Day 1 on placement day
          const pct = Math.max(0, Math.min(100, Math.round((day / batchDays) * 100)));
          const daysLeft = Math.max(0, batchDays - day);

          return (
            <div key={s.id} className="bg-white border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-xs text-slate-500">
                    Day {Math.min(day, batchDays)} of {batchDays}
                    {s.initialCount != null && <> · Placed: {s.initialCount.toLocaleString()}</>}
                  </div>
                </div>
                <div className="text-xs text-slate-500">{daysLeft} days left</div>
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <div className="h-2 bg-slate-200 rounded">
                  <div
                    className="h-2 bg-emerald-500 rounded transition-[width] duration-300"
                    style={{ width: `${pct}%` }}
                    aria-label={`Batch progress ${pct}%`}
                  />
                </div>
                <div className="mt-1 text-xs text-slate-500">{pct}%</div>
              </div>

              {/* Actions */}
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
          );
        })}
      </div>
    </div>
  );
}
