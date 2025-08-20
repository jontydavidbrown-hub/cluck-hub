// src/pages/Dashboard.tsx
import { useMemo } from "react";
import { useFarm } from "../lib/FarmContext";
import { useCloudSlice } from "../lib/cloudSlice";
import { Link } from "react-router-dom";

type Shed = {
  id: string;
  name: string;
  placementDate?: string;       // YYYY-MM-DD
  birdsPlaced?: number;         // current field
  placementBirds?: number;      // legacy support
};

type MortRow = {
  id: string;
  date?: string;                // YYYY-MM-DD
  shedId?: string;
  // new fields
  morts?: number;
  cullRunts?: number;
  cullLegs?: number;
  cullNonStart?: number;
  cullsOther?: number;
  // legacy
  mortalities?: number;
  culls?: number;
};

type PickupRow = {
  id: string;
  date?: string;
  shedId?: string;
  birdsPickedUp?: number;
};

type Settings = { batchLengthDays?: number };

// ---------- helpers ----------
const toArr = (v: any) => (Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : []);
const isObj = (x: any) => x && typeof x === "object";
const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function ymdToday(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function daysBetween(startYmd?: string, endYmd?: string): number | null {
  if (!startYmd) return null;
  const s = new Date(startYmd + "T00:00:00");
  const e = endYmd ? new Date(endYmd + "T00:00:00") : new Date();
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
  const ms = e.getTime() - s.getTime();
  return Math.max(0, Math.floor(ms / (24 * 3600 * 1000)));
}

function birdsPlacedOf(s: Shed): number {
  const a = num((s as any).birdsPlaced);
  const b = num((s as any).placementBirds);
  return a || b; // prefer current, fallback to legacy
}

function mortCullFromRow(r: MortRow): { morts: number; culls: number } {
  const morts = num(r.morts ?? r.mortalities);
  const culls =
    num(r.culls) +
    num(r.cullRunts) +
    num(r.cullLegs) +
    num(r.cullNonStart) +
    num(r.cullsOther);
  return { morts, culls };
}

// Rough per-bird daily feed consumption (kg/day) by day-age — simple stepped estimate.
// (Keeps UI working offline; you can swap this with the detailed table later.)
function rossKgPerBirdPerDay(dayAge: number | null): number {
  if (dayAge == null) return 0;
  if (dayAge <= 7) return 0.02;
  if (dayAge <= 14) return 0.04;
  if (dayAge <= 21) return 0.08;
  if (dayAge <= 28) return 0.11;
  if (dayAge <= 35) return 0.13;
  return 0.14;
}

export default function Dashboard() {
  const { farmId } = useFarm() as any;

  // Cloud-synced slices (scoped by current farm inside useCloudSlice)
  const [settings] = useCloudSlice<Settings>("settings", { batchLengthDays: 42 });
  const [shedsRaw] = useCloudSlice<Shed[]>("sheds", []);
  const [mortsRaw] = useCloudSlice<MortRow[]>("morts", []);
  const [pickupsRaw] = useCloudSlice<PickupRow[]>("pickups", []);

  // Defensive normalization (prevents crashes like "...shedId..." / "...id...")
  const sheds = useMemo(
    () =>
      toArr(shedsRaw)
        .filter(isObj)
        .filter((s: any) => typeof s.id === "string")
        .map((s: any) => ({
          id: String(s.id),
          name: String(s.name ?? ""),
          placementDate: s.placementDate ?? "",
          birdsPlaced: s.birdsPlaced,
          placementBirds: s.placementBirds,
        })) as Shed[],
    [shedsRaw, farmId]
  );

  const morts = useMemo(
    () =>
      toArr(mortsRaw)
        .filter(isObj)
        .filter((r: any) => typeof r.shedId === "string") as MortRow[],
    [mortsRaw, farmId]
  );

  const pickups = useMemo(
    () =>
      toArr(pickupsRaw)
        .filter(isObj)
        .filter((r: any) => typeof r.shedId === "string") as PickupRow[],
    [pickupsRaw, farmId]
  );

  const today = ymdToday();
  const batchDays = Math.max(1, num(settings?.batchLengthDays ?? 42));

  // Per-shed aggregates
  const perShed = useMemo(() => {
    const map = new Map<
      string,
      {
        shed: Shed;
        dayAge: number | null;
        placed: number;
        mortsAll: number;
        cullsAll: number;
        mortsToday: number;
        cullsToday: number;
        pickupsAll: number;
        birdsRemaining: number;
        estFeedTonnePerDay: number; // per shed
        progressPct: number;
      }
    >();

    for (const s of sheds) {
      const placed = birdsPlacedOf(s);
      const dayAge = daysBetween(s.placementDate, today);
      const feedKg = rossKgPerBirdPerDay(dayAge) * placed; // before morts/pickups adjustment; we’ll adjust after
      const progressPct =
        dayAge == null || !batchDays ? 0 : Math.max(0, Math.min(100, (dayAge / batchDays) * 100));
      map.set(s.id, {
        shed: s,
        dayAge,
        placed,
        mortsAll: 0,
        cullsAll: 0,
        mortsToday: 0,
        cullsToday: 0,
        pickupsAll: 0,
        birdsRemaining: placed,
        estFeedTonnePerDay: feedKg / 1000, // initial, will adjust
        progressPct,
      });
    }

    for (const r of morts) {
      const bucket = map.get(String(r.shedId));
      if (!bucket) continue;
      const { morts, culls } = mortCullFromRow(r);
      bucket.mortsAll += morts;
      bucket.cullsAll += culls;
      if (r.date === today) {
        bucket.mortsToday += morts;
        bucket.cullsToday += culls;
      }
    }

    for (const p of pickups) {
      const bucket = map.get(String(p.shedId));
      if (!bucket) continue;
      bucket.pickupsAll += num(p.birdsPickedUp);
    }

    // finalize birds remaining and adjust feed estimate by remaining birds
    for (const [id, b] of map) {
      const deaths = b.mortsAll + b.cullsAll;
      b.birdsRemaining = Math.max(0, b.placed - deaths - b.pickupsAll);
      const kg = rossKgPerBirdPerDay(b.dayAge) * b.birdsRemaining;
      b.estFeedTonnePerDay = kg / 1000;
      map.set(id, b);
    }

    return Array.from(map.values());
  }, [sheds, morts, pickups, today, batchDays]);

  // Totals
  const totals = useMemo(() => {
    let placed = 0;
    let morts = 0;
    let culls = 0;
    let pickups = 0;
    let estT = 0;

    for (const b of perShed) {
      placed += b.placed;
      morts += b.mortsAll;
      culls += b.cullsAll;
      pickups += b.pickupsAll;
      estT += b.estFeedTonnePerDay;
    }
    const remaining = Math.max(0, placed - pickups - morts - culls);

    // today
    let tM = 0, tC = 0;
    for (const b of perShed) {
      tM += b.mortsToday;
      tC += b.cullsToday;
    }

    return {
      placed,
      remaining,
      morts,
      culls,
      todayM: tM,
      todayC: tC,
      estFeedT: estT, // tonnes/day
    };
  }, [perShed]);

  // ---------- UI ----------
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* Totals row (2 per row on mobile) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border bg-white">
          <div className="text-xs text-slate-500">Total Placed Birds</div>
          <div className="text-2xl font-semibold">{totals.placed.toLocaleString()}</div>
        </div>

        <div className="p-4 rounded-2xl border bg-white">
          <div className="text-xs text-slate-500">Total Remaining Birds</div>
          <div className="text-2xl font-semibold">{totals.remaining.toLocaleString()}</div>
        </div>

        <div className="p-4 rounded-2xl border bg-white">
          <div className="text-xs text-slate-500">Morts / Culls (All time)</div>
          <div className="text-2xl font-semibold">
            {totals.morts.toLocaleString()} / {totals.culls.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Today: {totals.todayM.toLocaleString()} / {totals.todayC.toLocaleString()}
          </div>
        </div>

        <div className="p-4 rounded-2xl border bg-white">
          <div className="text-xs text-slate-500">Est Feed Consumption</div>
          <div className="text-2xl font-semibold">{(Math.round(totals.estFeedT * 10) / 10).toFixed(1)} t/day</div>
        </div>
      </div>

      {/* Per-shed tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {perShed.map((b) => {
          const s = b.shed;
          return (
            <div key={s.id} className="p-4 rounded-2xl border bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{s.name || "Shed " + s.id.slice(0, 4)}</div>
                {/* progress pill */}
                <div className="text-xs text-slate-600">
                  {b.dayAge == null ? "Day age: -" : `Day age: ${b.dayAge}`}
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-lg border p-2 text-center">
                  <div className="text-[11px] text-slate-500">Birds Remaining</div>
                  <div className="font-semibold">{b.birdsRemaining.toLocaleString()}</div>
                </div>
                <div className="rounded-lg border p-2 text-center">
                  <div className="text-[11px] text-slate-500">Morts / Culls</div>
                  <div className="font-semibold">
                    {b.mortsAll.toLocaleString()} / {b.cullsAll.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-lg border p-2 text-center">
                  <div className="text-[11px] text-slate-500">Today M/C</div>
                  <div className="font-semibold">
                    {b.mortsToday} / {b.cullsToday}
                  </div>
                </div>
                <div className="rounded-lg border p-2 text-center">
                  <div className="text-[11px] text-slate-500">Est Feed / day</div>
                  <div className="font-semibold">
                    {(Math.round(b.estFeedTonnePerDay * 10) / 10).toFixed(1)} t
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-2 bg-emerald-500 transition-all"
                    style={{ width: `${b.progressPct}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Batch progress: {Math.round(b.progressPct)}%
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Link
                  to={`/weights?shed=${encodeURIComponent(s.name || "")}&shedId=${encodeURIComponent(s.id)}`}
                  className="rounded border px-3 py-1 hover:bg-slate-50"
                >
                  Add Weights
                </Link>
                <Link
                  to={`/morts?shed=${encodeURIComponent(s.name || "")}&shedId=${encodeURIComponent(s.id)}`}
                  className="rounded border px-3 py-1 hover:bg-slate-50"
                >
                  Add Morts
                </Link>
              </div>
            </div>
          );
        })}

        {perShed.length === 0 && (
          <div className="p-4 rounded-2xl border bg-white text-slate-600">
            No sheds configured yet. Add them in <Link to="/setup" className="underline">Setup</Link>.
          </div>
        )}
      </div>
    </div>
  );
}
