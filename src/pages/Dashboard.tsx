import { useMemo } from "react";
import { useCloudSlice } from "../lib/cloudSlice";
import { useNavigate } from "react-router-dom";

type Shed = {
  id: string;
  name: string;
  placementDate?: string;      // YYYY-MM-DD
  placementBirds?: number;
  birdsPlaced?: number;        // mirrored by Setup for compatibility
};

type DailyLogRow = {
  id: string;
  date: string;                // YYYY-MM-DD
  shed?: string;
  mortalities?: number;
  culls?: number;
  notes?: string;
};

type Settings = {
  batchLengthDays?: number;
};

function daysBetweenUTC(yyyyMmDdA?: string, yyyyMmDdB?: string) {
  if (!yyyyMmDdA || !yyyyMmDdB) return 0;
  const a = new Date(yyyyMmDdA + "T00:00:00Z").getTime();
  const b = new Date(yyyyMmDdB + "T00:00:00Z").getTime();
  const diffMs = b - a;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export default function Dashboard() {
  const navigate = useNavigate();

  // Read persisted slices
  const [sheds] = useCloudSlice<Shed[]>("sheds", []);
  const [dailyLog] = useCloudSlice<DailyLogRow[]>("dailyLog", []);
  const [settings] = useCloudSlice<Settings>("settings", {});

  const today = new Date().toISOString().slice(0, 10);
  const batchLen = Math.max(1, Number(settings.batchLengthDays ?? 42)); // sensible default if unset

  // Compute per-shed stats (morts + progress)
  const tiles = useMemo(() => {
    const rows = dailyLog || [];
    const byShedMorts = new Map<string, number>();
    for (const r of rows) {
      const key = (r.shed || "").trim();
      if (!key) continue;
      const add = Number(r.mortalities) || 0;
      byShedMorts.set(key, (byShedMorts.get(key) || 0) + add);
    }

    const list = (sheds || []).map((s) => {
      const shedName = s.name || "";
      const mortsTotal = byShedMorts.get(shedName) || 0;

      let progressPct = 0;
      if (s.placementDate) {
        const days = daysBetweenUTC(s.placementDate, today);
        progressPct = Math.min(100, Math.max(0, Math.round((days / batchLen) * 100)));
      }

      const placed = Number(s.birdsPlaced ?? s.placementBirds) || undefined;

      return {
        id: s.id,
        name: shedName,
        placementDate: s.placementDate || "",
        birdsPlaced: placed,
        progressPct,
        mortsTotal,
      };
    });

    // Keep stable order by name
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [sheds, dailyLog, batchLen, today]);

  function goAddWeights(name: string) {
    const q = new URLSearchParams({ shed: name });
    navigate(`/weights?${q.toString()}`);
  }
  function goAddMorts(name: string) {
    const q = new URLSearchParams({ shed: name, focus: "mortalities" });
    navigate(`/daily-log?${q.toString()}`);
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {tiles.length === 0 ? (
        <div className="card p-6 text-slate-600">
          No sheds yet. Add one in <span className="font-medium">Setup</span>.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiles.map((t) => (
            <div key={t.id} className="card p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">{t.name || "—"}</div>
                <div className="text-xs text-slate-500">
                  {t.placementDate ? `Placed: ${t.placementDate}` : "Unplaced"}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-2 bg-slate-900 transition-[width] duration-500"
                  style={{ width: `${t.progressPct}%` }}
                  aria-label={`Batch progress ${t.progressPct}%`}
                />
              </div>
              <div className="text-xs text-slate-600">
                Batch progress: <span className="font-medium">{t.progressPct}%</span>
              </div>

              {/* Birds placed + morts */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded border p-2">
                  <div className="text-xs text-slate-500">Birds placed</div>
                  <div className="text-lg font-semibold">{t.birdsPlaced ?? "—"}</div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-xs text-slate-500">Morts (total)</div>
                  <div className="text-lg font-semibold">{t.mortsTotal}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-1 flex gap-2">
                <button
                  className="px-3 py-1 rounded border hover:bg-slate-50"
                  onClick={() => goAddWeights(t.name)}
                >
                  Add Weights
                </button>
                <button
                  className="px-3 py-1 rounded border hover:bg-slate-50"
                  onClick={() => goAddMorts(t.name)}
                >
                  Add Morts
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
