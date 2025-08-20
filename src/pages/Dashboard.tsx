// src/pages/Dashboard.tsx
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCloudSlice } from "../lib/cloudSlice";

type Settings = { batchLengthDays?: number };
type Shed = {
  id: string;
  name: string;
  placementDate?: string;   // YYYY-MM-DD
  placementBirds?: number;  // legacy
  birdsPlaced?: number;     // current
};

// Morts rows (supports both legacy Daily Log and new Morts schema)
type MortsRow = {
  id: string;
  date: string;          // YYYY-MM-DD
  shed?: string;         // may be shed name
  shedId?: string;       // optional if newer pages saved id
  mortalities?: number;  // legacy "morts"
  morts?: number;        // current "morts"
  culls?: number;        // legacy combined culls
  cullRunts?: number;
  cullLegs?: number;
  cullNonStart?: number;
  cullOther?: number;
};

const T_PER_KG = 0.001;

// Approx daily feed per bird (grams) by age; coarse curve with piecewise linear fill
function feedPerBirdG(age: number): number {
  const pts = [
    [1, 15], [7, 28], [14, 50], [21, 80], [28, 110], [35, 130], [42, 150],
  ] as const;
  if (age <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [d2, g2] = pts[i];
    const [d1, g1] = pts[i - 1];
    if (age <= d2) {
      const t = (age - d1) / (d2 - d1);
      return g1 + t * (g2 - g1);
    }
  }
  // Flat after last point
  return pts[pts.length - 1][1];
}

function daysSince(iso?: string): number {
  if (!iso) return 0;
  const d0 = new Date(iso + "T00:00:00");
  const d1 = new Date();
  const diff = Math.floor((+d1 - +d0) / 86400000);
  return Math.max(0, diff);
}

function num(v: any): number { return Number.isFinite(Number(v)) ? Number(v) : 0; }

export default function Dashboard() {
  const navigate = useNavigate();

  const [settings] = useCloudSlice<Settings>("settings", { batchLengthDays: 42 });
  const [sheds] = useCloudSlice<Shed[]>("sheds", []);
  // Read from both possible keys and merge (supports your older Daily Log and newer Morts page)
  const [mortsA] = useCloudSlice<MortsRow[]>("morts", []);
  const [mortsB] = useCloudSlice<MortsRow[]>("dailyLog", []);
  const mortsRows = useMemo(() => [...(mortsA || []), ...(mortsB || [])], [mortsA, mortsB]);

  const shedsSorted = useMemo(
    () => [...(sheds || [])].sort((a, b) => (a?.name || "").localeCompare(b?.name || "")),
    [sheds]
  );

  // Map shed -> totals
  const perShed = useMemo(() => {
    const map = new Map<string, {
      shed: Shed;
      age: number;
      birdsPlaced: number;
      morts: number;
      culls: number;
      remaining: number;
      estFeedTonnes: number; // per day
    }>();
    for (const s of shedsSorted) {
      const birdsPlaced = num(s.birdsPlaced ?? s.placementBirds);
      const age = daysSince(s.placementDate) + 1; // day age (1-based)
      // sum morts & culls for this shed
      let morts = 0, culls = 0;
      for (const r of mortsRows) {
        const isThis =
          (r.shedId && r.shedId === s.id) ||
          (r.shed && s.name && r.shed.trim().toLowerCase() === s.name.trim().toLowerCase());
        if (!isThis) continue;
        morts += num(r.morts ?? r.mortalities);
        const cullSum =
          (r.culls != null ? num(r.culls) : 0) +
          num(r.cullRunts) + num(r.cullLegs) + num(r.cullNonStart) + num(r.cullOther);
        culls += cullSum;
      }
      const remaining = Math.max(0, birdsPlaced - morts - culls);
      const gPerBird = feedPerBirdG(age);
      const estFeedTonnes = remaining * gPerBird * T_PER_KG / 1000; // g -> kg -> t
      map.set(s.id, { shed: s, age, birdsPlaced, morts, culls, remaining, estFeedTonnes });
    }
    return map;
  }, [shedsSorted, mortsRows]);

  const totals = useMemo(() => {
    let placed = 0, remaining = 0, allMorts = 0, allCulls = 0, estFeedT = 0;
    for (const v of perShed.values()) {
      placed += v.birdsPlaced;
      remaining += v.remaining;
      allMorts += v.morts;
      allCulls += v.culls;
      estFeedT += v.estFeedTonnes;
    }
    return { placed, remaining, allMorts, allCulls, estFeedT };
  }, [perShed]);

  const batchLen = Math.max(1, num(settings.batchLengthDays || 42));

  function goAddWeights(s: Shed) {
    const qs = new URLSearchParams();
    qs.set("preselectShed", s.id);
    qs.set("shedName", s.name || "");
    navigate(`/weights?${qs.toString()}`);
  }
  function goAddMorts(s: Shed) {
    const qs = new URLSearchParams();
    qs.set("preselectShed", s.id);
    qs.set("shedName", s.name || "");
    navigate(`/morts?${qs.toString()}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* Top totals tiles (mobile: 2 per row) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded border p-4 bg-white">
          <div className="text-xs text-slate-500">Total Placed Birds</div>
          <div className="text-xl font-semibold mt-1">{totals.placed.toLocaleString()}</div>
        </div>
        <div className="rounded border p-4 bg-white">
          <div className="text-xs text-slate-500">Total Remaining Birds</div>
          <div className="text-xl font-semibold mt-1">{totals.remaining.toLocaleString()}</div>
        </div>
        <div className="rounded border p-4 bg-white">
          {/* >>> label changed here <<< */}
          <div className="text-xs text-slate-500">Morts / Culls</div>
          <div className="text-xl font-semibold mt-1">
            {totals.allMorts.toLocaleString()}/{totals.allCulls.toLocaleString()}
          </div>
        </div>
        <div className="rounded border p-4 bg-white">
          <div className="text-xs text-slate-500">Est Feed Consumption</div>
          <div className="text-xl font-semibold mt-1">
            {totals.estFeedT.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} t / day
          </div>
        </div>
      </div>

      {/* Per-shed tiles */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shedsSorted.map((s) => {
          const v = perShed.get(s.id)!;
          const pct = Math.min(100, Math.round((v.age / batchLen) * 100));
          return (
            <div key={s.id} className="rounded border p-4 bg-white">
              <div className="flex items-center justify-between">
                <div className="font-medium truncate">{s.name || `Shed ${String(s.id).slice(0, 4)}`}</div>
                <div className="text-xs text-slate-500">{pct}%</div>
              </div>
              <div className="mt-2 h-2 rounded bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-lime-500"
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Stats row */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded border p-2">
                  <div className="text-[11px] text-slate-500">Day Age</div>
                  <div className="text-sm font-medium">{v.age}</div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-[11px] text-slate-500">Birds Placed</div>
                  <div className="text-sm font-medium">{v.birdsPlaced.toLocaleString()}</div>
                </div>
                <div className="rounded border p-2">
                  {/* >>> label changed here <<< */}
                  <div className="text-[11px] text-slate-500">Morts / Culls</div>
                  <div className="text-sm font-medium">
                    {v.morts.toLocaleString()}/{v.culls.toLocaleString()}
                  </div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-[11px] text-slate-500">Est Feed (t/day)</div>
                  <div className="text-sm font-medium">
                    {v.estFeedTonnes.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-3 flex items-center gap-2">
                <button className="px-3 py-1.5 rounded border hover:bg-slate-50" onClick={() => goAddWeights(s)}>
                  Add Weights
                </button>
                <button className="px-3 py-1.5 rounded border hover:bg-slate-50" onClick={() => goAddMorts(s)}>
                  Add Morts
                </button>
              </div>
            </div>
          );
        })}
        {shedsSorted.length === 0 && (
          <div className="text-sm text-slate-600">No sheds configured yet. Add sheds in <span className="font-medium">Setup</span>.</div>
        )}
      </div>
    </div>
  );
}
