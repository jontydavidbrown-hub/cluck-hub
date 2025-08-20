// src/pages/Dashboard.tsx
import { useMemo, useState, useEffect } from "react";
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
shed?: string;         // may be shed name (legacy)
shedId?: string;       // preferred
mortalities?: number;  // legacy "morts"
morts?: number;        // current "morts"
culls?: number;        // legacy combined culls
cullRunts?: number;
cullLegs?: number;
cullNonStart?: number;
cullOther?: number;
};

// Feed: deliveries + stocktakes
type FeedType = "starter" | "grower" | "finisher" | "booster";
type Delivery = {
id: string;
date: string;     // YYYY-MM-DD
type: FeedType;
tonnes?: number;  // preferred
loads?: number;   // legacy
shedId?: string;
};
type Stocktake = {
id: string;
shedId: string;
tonnes: number;
dateTime?: string; // ISO
date?: string;     // legacy YYYY-MM-DD
};

type SiloCaps = Record<string, number>; // shedId -> capacity tonnes

// NEW: pickups slice
type Pickup = { id: string; date: string; shedId: string; birds: number };

const T_PER_KG = 0.001;
const LOAD_TONNES = 24;
const MINUTES_PER_DAY = 1440;
const ONE_MIN_MS = 60_000;

// Approx daily feed per bird (grams) by age; piecewise linear
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
function parseISOish(s?: string): Date | null {
if (!s) return null;
const d = new Date(s);
return isNaN(+d) ? null : d;
}
function parseYMD(s?: string): Date | null {
if (!s) return null;
const d = new Date(s + "T00:00:00");
return isNaN(+d) ? null : d;
}
function deliveryTonnes(d: Delivery): number {
if (typeof d.tonnes === "number" && Number.isFinite(d.tonnes)) return Math.max(0, d.tonnes);
const loads = Number(d.loads) || 0;
return Math.max(0, loads * LOAD_TONNES);
}

export default function Dashboard() {
const navigate = useNavigate();

// Re-render every 1 minute so silo consumption updates continuously
const [nowTick, setNowTick] = useState<number>(() => Date.now());
useEffect(() => {
const tick = () => setNowTick(Date.now());
const id = setInterval(tick, ONE_MIN_MS);
const onVis = () => { if (document.visibilityState === "visible") tick(); };
window.addEventListener("visibilitychange", onVis);
window.addEventListener("focus", tick);
tick(); // align immediately on mount
return () => {
clearInterval(id);
window.removeEventListener("visibilitychange", onVis);
window.removeEventListener("focus", tick);
};
}, []);

const [settings] = useCloudSlice<Settings>("settings", { batchLengthDays: 42 });
const [sheds] = useCloudSlice<Shed[]>("sheds", []);

// morts can be stored in either key; merge
const [mortsA] = useCloudSlice<MortsRow[]>("morts", []);
const [mortsB] = useCloudSlice<MortsRow[]>("dailyLog", []);
const mortsRows = useMemo(() => [...(mortsA || []), ...(mortsB || [])], [mortsA, mortsB]);

// NEW: pickups (birds removed for processing)
const [pickups] = useCloudSlice<Pickup[]>("pickups", []);

// feed slices for silo estimation
const [deliveries] = useCloudSlice<Delivery[]>("feedDeliveries", []);
const [stocktakes] = useCloudSlice<Stocktake[]>("feedStocktakes", []);
const [siloCaps] = useCloudSlice<SiloCaps>("siloCapacities", {});

const shedsSorted = useMemo(
() => [...(sheds || [])].sort((a, b) => (a?.name || "").localeCompare(b?.name || "")),
[sheds]
);

// Map shed -> base stats + daily consumption estimate (includes pickups in remaining birds)
const perShed = useMemo(() => {
const map = new Map<string, {
shed: Shed;
age: number;
birdsPlaced: number;
morts: number;
culls: number;
picked: number;
remaining: number;
estFeedTonnesPerDay: number;
}>();
for (const s of shedsSorted) {
const birdsPlaced = num(s.birdsPlaced ?? s.placementBirds);
const age = daysSince(s.placementDate) + 1; // 1-based day age

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

let picked = 0;
for (const p of pickups || []) {
if (p.shedId === s.id) picked += num(p.birds);
}

const remainingBirds = Math.max(0, birdsPlaced - morts - culls - picked);
const gPerBird = feedPerBirdG(age);
const estFeedTonnesPerDay = remainingBirds * gPerBird * T_PER_KG / 1000; // g -> kg -> t

map.set(s.id, {
shed: s,
age,
birdsPlaced,
morts,
culls,
picked,
remaining: remainingBirds,
estFeedTonnesPerDay
});
}
return map;
}, [shedsSorted, mortsRows, pickups]);

const totals = useMemo(() => {
let placed = 0, remaining = 0, allMorts = 0, allCulls = 0, estFeedT = 0;
for (const v of perShed.values()) {
placed += v.birdsPlaced;
remaining += v.remaining;
allMorts += v.morts;
allCulls += v.culls;
estFeedT += v.estFeedTonnesPerDay;
}
return { placed, remaining, allMorts, allCulls, estFeedT };
}, [perShed]);

const batchLen = Math.max(1, num(settings.batchLengthDays || 42));

// ---- Silo estimates per shed (remaining t + % of capacity), using minute-level consumption ----
const siloTiles = useMemo(() => {
// latest stocktake by shed
const latestST = new Map<string, Stocktake>();
for (const st of stocktakes || []) {
if (!st.shedId) continue;
const key = st.shedId;
const prev = latestST.get(key);
const a = parseISOish(st.dateTime) || parseYMD(st.date);
const b = prev ? (parseISOish(prev.dateTime) || parseYMD(prev.date)) : null;
if (!b || (a && +a > +b)) latestST.set(key, st);
}

// group deliveries by shed and sort by date
const byShed = new Map<string, Delivery[]>();
for (const d of deliveries || []) {
const k = d.shedId || "";
if (!byShed.has(k)) byShed.set(k, []);
byShed.get(k)!.push(d);
}
for (const arr of byShed.values()) {
arr.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

const rows: {
shed: Shed;
remainingT?: number;
percent?: number;
capacityT?: number;
}[] = [];

const now = new Date(nowTick);

for (const s of shedsSorted) {
const v = perShed.get(s.id);
if (!v) continue;

const capT = num((siloCaps || {})[s.id]); // capacity in tonnes (0 means unknown)
const st = latestST.get(s.id);
const deliveriesFor = byShed.get(s.id) || [];
let baseT = 0;
let baseTime: Date | null = null;
let deliveredSince = 0;

if (st) {
baseT = num(st.tonnes);
baseTime = parseISOish(st.dateTime) || parseYMD(st.date);
const stDateStr = baseTime ? baseTime.toISOString().slice(0, 10) : undefined;
for (const d of deliveriesFor) {
if (!stDateStr || (d.date || "") >= stDateStr) {
deliveredSince += deliveryTonnes(d);
}
}
} else {
for (const d of deliveriesFor) deliveredSince += deliveryTonnes(d);
if (deliveriesFor.length > 0) baseTime = parseYMD(deliveriesFor[0].date);
}

// Minute-level consumption since baseTime
let minutes = 0;
if (baseTime) {
const ms = Math.max(0, now.getTime() - baseTime.getTime());
minutes = Math.floor(ms / ONE_MIN_MS);
}
const consumptionSince = (v.estFeedTonnesPerDay || 0) * (minutes / MINUTES_PER_DAY);

const estRemaining = Math.max(0, baseT + deliveredSince - consumptionSince);

// % of capacity (if provided)
const pct = capT > 0 ? Math.max(0, Math.min(100, Math.round((estRemaining / capT) * 100))) : undefined;

rows.push({ shed: s, remainingT: estRemaining, percent: pct, capacityT: capT || undefined });
}

// limit to 4 tiles, stable order (already sorted by name)
return rows.slice(0, 4);
}, [stocktakes, deliveries, shedsSorted, perShed, siloCaps, nowTick]);

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

{/* Silo feed remaining tiles (up to 4) — capacity based, 1-minute updates */}
{siloTiles.length > 0 && (
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
{siloTiles.map(({ shed, remainingT, percent, capacityT }) => {
const pct = percent ?? 0;
const pctLabel = percent != null ? `${pct}%` : "Set capacity in Setup";
const tLabel =
remainingT != null
? capacityT
? `${remainingT.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} t / ${capacityT.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} t`
: `${remainingT.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} t`
: "—";
return (
<div key={shed.id} className="rounded border p-4 bg-white">
<div className="text-xs text-slate-500 truncate">
{shed.name || `Shed ${String(shed.id).slice(0, 4)}`} — Silo Remaining
</div>
<div className="mt-1 flex items-baseline justify-between">
<div className="text-xl font-semibold">{pctLabel}</div>
<div className="text-xs text-slate-500">{tLabel}</div>
</div>
<div className="mt-2 h-2 rounded bg-slate-100 overflow-hidden">
<div
className="h-full bg-gradient-to-r from-emerald-400 to-lime-500 transition-[width] duration-500"
style={{ width: `${percent != null ? pct : 0}%` }}
/>
</div>
</div>
);
})}
</div>
)}

{/* Per-shed tiles */}
<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
{shedsSorted.map((s) => {
const v = perShed.get(s.id)!;
const pct = Math.min(100, Math.round(((daysSince(s.placementDate) + 1) / batchLen) * 100));
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
                  <div className="text-[11px] text-slate-500">Birds Remaining</div>
                  <div className="text-sm font-medium">{v.remaining.toLocaleString()}</div>
</div>
<div className="rounded border p-2">
<div className="text-[11px] text-slate-500">Morts / Culls</div>
<div className="text-sm font-medium">
{v.morts.toLocaleString()}/{v.culls.toLocaleString()}
</div>
</div>
<div className="rounded border p-2">
<div className="text-[11px] text-slate-500">Est Feed (t/day)</div>
<div className="text-sm font-medium">
{v.estFeedTonnesPerDay.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}
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
