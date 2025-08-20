// src/pages/Dashboard.tsx
import { useMemo } from "react";
import { useCloudSlice } from "../lib/cloudSlice";
import { useNavigate } from "react-router-dom";
import { estimateShedFeedKgToday } from "../lib/rossFeed";
import FeedStocktakeLightboxButton from "../components/FeedStocktakeLightboxButton";


type Shed = {
id: string;
name: string;
placementDate?: string;      // YYYY-MM-DD
placementBirds?: number;     // legacy
birdsPlaced?: number;        // current
};

type DailyLogRow = {
id: string;
date: string;                // YYYY-MM-DD
shed?: string;
  mortalities?: number;        // morts + culls (from Morts page)
};

type Settings = {
  batchLengthDays?: number;
  // Newer, structured fields from Morts page
  morts?: number;              // natural deaths
  cullRunts?: number;
  cullLegs?: number;
  cullNonStart?: number;
  cullOther?: number;
  culls?: number;              // aggregated culls (compat)
  mortalities?: number;        // morts + culls (compat)
};

type Settings = { batchLengthDays?: number };

function daysBetweenUTC(a?: string, b?: string) {
if (!a || !b) return 0;
const A = new Date(a + "T00:00:00Z").getTime();
const B = new Date(b + "T00:00:00Z").getTime();
return Math.floor((B - A) / (1000 * 60 * 60 * 24));
}
function cullsOnly(r: Partial<DailyLogRow>) {
  if (typeof r.culls === "number") return Math.max(0, r.culls);
  const sum =
    (Number(r.cullRunts) || 0) +
    (Number(r.cullLegs) || 0) +
    (Number(r.cullNonStart) || 0) +
    (Number(r.cullOther) || 0);
  return Math.max(0, sum);
}
function mortsOnly(r: Partial<DailyLogRow>) {
  return Math.max(0, Number(r.morts) || 0);
}

export default function Dashboard() {
const navigate = useNavigate();

const [sheds] = useCloudSlice<Shed[]>("sheds", []);
const [dailyLog] = useCloudSlice<DailyLogRow[]>("dailyLog", []);
const [settings] = useCloudSlice<Settings>("settings", {});

const today = new Date().toISOString().slice(0, 10);
const batchLen = Math.max(1, Number(settings.batchLengthDays ?? 42));

const { tiles, totals } = useMemo(() => {
const rows = dailyLog || [];

    // Sum mortalities per shed
    // Sum morts & culls per shed
const mortsByShed = new Map<string, number>();
    let totalMortsAll = 0;
    const cullsByShed = new Map<string, number>();
    let totalMortsOnlyAll = 0;
    let totalCullsOnlyAll = 0;

for (const r of rows) {
const key = (r.shed || "").trim();
if (!key) continue;
      const add = Number(r.mortalities) || 0;
      totalMortsAll += add;
      mortsByShed.set(key, (mortsByShed.get(key) || 0) + add);
      const m = mortsOnly(r);
      const c = cullsOnly(r);
      totalMortsOnlyAll += m;
      totalCullsOnlyAll += c;
      mortsByShed.set(key, (mortsByShed.get(key) || 0) + m);
      cullsByShed.set(key, (cullsByShed.get(key) || 0) + c);
}

let totalPlacedBirdsAll = 0;
let totalRemainingBirdsAll = 0;
let totalFeedKgTodayAll = 0;

const tiles = (sheds || [])
.map((s) => {
const shedName = s.name || "";
        const mortsTotal = mortsByShed.get(shedName) || 0;
        const mOnly = mortsByShed.get(shedName) || 0;
        const cOnly = cullsByShed.get(shedName) || 0;
        const mortalitiesTotal = mOnly + cOnly;

const placed = Number(s.birdsPlaced ?? s.placementBirds) || 0;
totalPlacedBirdsAll += placed;

        // progress & age
let progressPct = 0;
let ageDays = 0;
if (s.placementDate) {
ageDays = daysBetweenUTC(s.placementDate, today);
progressPct = Math.min(100, Math.max(0, Math.round((ageDays / batchLen) * 100)));
}

        const liveBirds = Math.max(0, placed - mortsTotal);
        const liveBirds = Math.max(0, placed - mortalitiesTotal);
totalRemainingBirdsAll += liveBirds;

        // estimate feed for this shed for "today"
        const feedKgToday = s.placementDate
          ? estimateShedFeedKgToday(ageDays, liveBirds)
          : 0;
        const feedKgToday = s.placementDate ? estimateShedFeedKgToday(ageDays, liveBirds) : 0;
totalFeedKgTodayAll += feedKgToday;

return {
id: s.id,
name: shedName,
placementDate: s.placementDate || "",
birdsPlaced: placed || undefined,
progressPct,
ageDays: s.placementDate ? ageDays : undefined,
          mortsTotal,
          mortsOnly: mOnly,
          cullsOnly: cOnly,
feedKgToday, // kg/day
};
})
.sort((a, b) => a.name.localeCompare(b.name));

const totals = {
totalPlacedBirdsAll,
totalRemainingBirdsAll,
      totalMortsAll,
      totalMortsOnlyAll,
      totalCullsOnlyAll,
totalFeedKgTodayAll, // kg/day
};

return { tiles, totals };
}, [sheds, dailyLog, batchLen, today]);

function goAddWeights(name: string) {
const q = new URLSearchParams({ shed: name });
navigate(`/weights?${q.toString()}`);
}

function goAddMorts(name: string) {
const q = new URLSearchParams({ shed: name, focus: "mortalities" });
navigate(`/morts?${q.toString()}`);
}

return (
<div className="p-4 space-y-6">
<h1 className="text-2xl font-semibold">Dashboard</h1>

{/* Totals bar: 2 per row on mobile, 4 per row from sm+ */}
<div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
<div className="rounded border p-4 bg-white">
<div className="text-xs text-slate-500">Total Placed Birds</div>
<div className="text-2xl font-semibold">
{totals.totalPlacedBirdsAll.toLocaleString()}
</div>
</div>
<div className="rounded border p-4 bg-white">
<div className="text-xs text-slate-500">Total Remaining Birds</div>
<div className="text-2xl font-semibold">
{totals.totalRemainingBirdsAll.toLocaleString()}
</div>
</div>
<div className="rounded border p-4 bg-white">
          <div className="text-xs text-slate-500">Total Morts</div>
          <div className="text-xs text-slate-500">Morts/Culls</div>
<div className="text-2xl font-semibold">
            {totals.totalMortsAll.toLocaleString()}
            {totals.totalMortsOnlyAll.toLocaleString()}/{totals.totalCullsOnlyAll.toLocaleString()}
</div>
</div>
<div className="rounded border p-4 bg-white">
<div className="text-xs text-slate-500">Est Feed Consumption</div>
<div className="text-2xl font-semibold">
{(totals.totalFeedKgTodayAll / 1000).toLocaleString(undefined, {
minimumFractionDigits: 1,
maximumFractionDigits: 1,
})}{" "}
t
</div>
</div>
</div>

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

              {/* Shed boxes */}
<div className="grid grid-cols-2 gap-3 text-sm">
<div className="rounded border p-2">
<div className="text-xs text-slate-500">Day Age</div>
<div className="text-lg font-semibold">
{typeof t.ageDays === "number" ? t.ageDays : "—"}
</div>
</div>

<div className="rounded border p-2">
<div className="text-xs text-slate-500">Birds placed</div>
<div className="text-lg font-semibold">{t.birdsPlaced ?? "—"}</div>
</div>

<div className="rounded border p-2">
                  <div className="text-xs text-slate-500">Morts (total)</div>
                  <div className="text-lg font-semibold">{t.mortsTotal}</div>
                  <div className="text-xs text-slate-500">Morts/Culls</div>
                  <div className="text-lg font-semibold">
                    {t.mortsOnly}/{t.cullsOnly}
                  </div>
</div>

<div className="rounded border p-2">
<div className="text-xs text-slate-500">Est. feed today</div>
<div className="text-lg font-semibold">
{t.feedKgToday > 0
? `${(t.feedKgToday / 1000).toLocaleString(undefined, {
                         minimumFractionDigits: 1,
                         maximumFractionDigits: 1,
                       })} t`
: "—"}
</div>
</div>
</div>

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
