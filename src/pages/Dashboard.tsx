// src/pages/Dashboard.tsx
import { useMemo, useState, useEffect } from "react";
import { useCloudSlice } from "../lib/cloudSlice";

// --------------------
// Types
// --------------------
type FeedType = "Starter" | "Grower" | "Finisher";

type SiloRow = {
  id: string;
  name: string;
  type: FeedType;
  capacityT?: number;
  levelT?: number;
  notes?: string;
};

type Delivery = {
  id: string;
  date: string; // yyyy-mm-dd
  type: FeedType;
  tons: number;
  notes?: string;
};

type FeedQuote = {
  type: FeedType;
  targetT?: number;
  thresholdPct?: number;
};

// Stocktakes (we only WRITE new-shape here, but read old/new)
type ShedEntry = { shed: string; tons: number };
type NewStocktake = {
  id: string;
  date: string;        // yyyy-mm-dd
  feedType: FeedType;  // derived from the selected shed's silo.type
  totalTons: number;   // sum of sheds[].tons
  sheds: ShedEntry[];  // per-shed readings
};

type OldStocktake = {
  id?: string;
  date: string;
  starterT?: number;
  growerT?: number;
  finisherT?: number;
};

type TypeSnapshot = { date: string; total: number };

// --------------------
// Helpers
// --------------------
function newId() {
  return (
    (globalThis.crypto as any)?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}
function clampNum(n: any) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}
function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function daysBetween(aISO: string, bISO: string) {
  const a = new Date(aISO + "T00:00:00Z").getTime();
  const b = new Date(bISO + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

// --------------------
// Feed Stocktake Lightbox (inline component)
// --------------------
function FeedStocktakeLightboxButton() {
  const [silos] = useCloudSlice<SiloRow[]>("feedSilos", []);
  const [stocktakes, setStocktakes] = useCloudSlice<Array<NewStocktake | OldStocktake>>(
    "feedStocktakes",
    []
  );

  const [open, setOpen] = useState(false);
  const [shedId, setShedId] = useState<string>("");
  const [tons, setTons] = useState<string>("");

  const sortedSilos = useMemo(
    () => [...(silos || [])].sort((a, b) => a.name.localeCompare(b.name)),
    [silos]
  );
  const selectedShed = useMemo(
    () => sortedSilos.find((s) => s.id === shedId) || null,
    [sortedSilos, shedId]
  );

  const canOpen = (sortedSilos || []).length > 0;

  // Lock scroll while lightbox is open (UX nicety, like your login lightbox)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function closeAndReset() {
    setOpen(false);
    setShedId("");
    setTons("");
  }

  function convertOldToNew(st: OldStocktake): NewStocktake[] {
    const out: NewStocktake[] = [];
    if (typeof st.starterT !== "undefined") {
      out.push({
        id: newId(),
        date: st.date,
        feedType: "Starter",
        totalTons: clampNum(st.starterT),
        sheds: [{ shed: "Total", tons: clampNum(st.starterT) }],
      });
    }
    if (typeof st.growerT !== "undefined") {
      out.push({
        id: newId(),
        date: st.date,
        feedType: "Grower",
        totalTons: clampNum(st.growerT),
        sheds: [{ shed: "Total", tons: clampNum(st.growerT) }],
      });
    }
    if (typeof st.finisherT !== "undefined") {
      out.push({
        id: newId(),
        date: st.date,
        feedType: "Finisher",
        totalTons: clampNum(st.finisherT),
        sheds: [{ shed: "Total", tons: clampNum(st.finisherT) }],
      });
    }
    return out;
  }

  function normalizeAllNewShape(records: Array<NewStocktake | OldStocktake>): NewStocktake[] {
    const out: NewStocktake[] = [];
    (records || []).forEach((r) => {
      if ((r as any).feedType && typeof (r as any).totalTons !== "undefined") {
        const n = r as NewStocktake;
        out.push({
          id: n.id || newId(),
          date: n.date,
          feedType: n.feedType,
          totalTons: clampNum(n.totalTons),
          sheds: Array.isArray(n.sheds)
            ? n.sheds.map((s) => ({ shed: String(s.shed || ""), tons: clampNum(s.tons) }))
            : [],
        });
      } else {
        out.push(...convertOldToNew(r as OldStocktake));
      }
    });
    return out;
  }

  function saveStocktake() {
    if (!selectedShed) {
      alert("Please select a shed.");
      return;
    }
    const value = clampNum(tons);
    if (value <= 0) {
      alert("Enter a positive tonnage.");
      return;
    }

    const today = toISODate(new Date());
    const feedType = selectedShed.type;
    const shedName = selectedShed.name;

    // Normalize existing records (so we can merge by date+type)
    const existingNew = normalizeAllNewShape(stocktakes);
    const idx = existingNew.findIndex((st) => st.date === today && st.feedType === feedType);

    if (idx >= 0) {
      // Merge this shed into the same-day, same-type record (upsert per shed)
      const copy = [...existingNew];
      const st = { ...copy[idx] };
      const sheds = Array.isArray(st.sheds) ? [...st.sheds] : [];
      const sIdx = sheds.findIndex((s) => s.shed === shedName);
      if (sIdx >= 0) {
        sheds[sIdx] = { shed: shedName, tons: value };
      } else {
        sheds.push({ shed: shedName, tons: value });
      }
      st.sheds = sheds;
      st.totalTons = sheds.reduce((sum, s) => sum + clampNum(s.tons), 0);
      copy[idx] = st;
      setStocktakes(copy);
    } else {
      // Create a new record with this single shed
      const st: NewStocktake = {
        id: newId(),
        date: today,
        feedType,
        totalTons: value,
        sheds: [{ shed: shedName, tons: value }],
      };
      setStocktakes((prev) => [...(normalizeAllNewShape(prev || [])), st]);
    }

    closeAndReset();
  }

  return (
    <>
      <button
        className="px-4 py-2 rounded bg-black text-white disabled:opacity-60"
        disabled={!canOpen}
        onClick={() => setOpen(true)}
        title={canOpen ? "" : "Add at least one Silo in Feed to use stocktake"}
      >
        Feed Stocktake
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={closeAndReset}
        >
          <div
            className="card w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-1">Feed stocktake</h2>
            <p className="text-sm text-slate-600 mb-4">Select a shed and enter remaining feed (t).</p>

            <div className="space-y-3">
              <label className="block">
                <div className="text-xs font-medium mb-1 text-slate-700">Shed</div>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
                  value={shedId}
                  onChange={(e) => setShedId(e.target.value)}
                >
                  <option value="">Select shed…</option>
                  {sortedSilos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.type}
                    </option>
                  ))}
                </select>
              </label>

              {selectedShed && (
                <div className="text-xs text-slate-600">
                  Current feed type: <span className="font-medium">{selectedShed.type}</span>
                </div>
              )}

              <label className="block">
                <div className="text-xs font-medium mb-1 text-slate-700">Feed remaining (t)</div>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
                  value={tons}
                  onChange={(e) => setTons(e.target.value)}
                  placeholder="e.g., 12.5"
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button className="rounded border px-4 py-2" onClick={closeAndReset}>
                  Cancel
                </button>
                <button
                  className="rounded bg-slate-900 text-white px-4 py-2 disabled:opacity-60"
                  disabled={!shedId || !tons}
                  onClick={saveStocktake}
                >
                  Save stocktake
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// --------------------
// Dashboard Page
// --------------------
export default function Dashboard() {
  // READ feed slices just to show the same top tiles you asked for (optional but handy)
  const [rows] = useCloudSlice<SiloRow[]>("feedSilos", []);
  const [stocktakes] = useCloudSlice<Array<NewStocktake | OldStocktake>>("feedStocktakes", []);
  const [deliveries] = useCloudSlice<Delivery[]>("feedDeliveries", []);
  const [quotes] = useCloudSlice<FeedQuote[]>("feedQuotes", []);

  // Silo totals (live)
  const totals = useMemo(() => {
    const cap = (rows || []).reduce((s, r) => s + (Number(r.capacityT) || 0), 0);
    const lvl = (rows || []).reduce((s, r) => s + (Number(r.levelT) || 0), 0);
    return { cap, lvl, pct: cap > 0 ? Math.round((lvl / cap) * 100) : 0 };
  }, [rows]);

  const typeTotalsFromSilos = useMemo(() => {
    const byType: Record<FeedType, number> = { Starter: 0, Grower: 0, Finisher: 0 };
    (rows || []).forEach((r) => {
      byType[r.type] += clampNum(r.levelT ?? 0);
    });
    return byType;
  }, [rows]);

  // Build per-type snapshots from stocktakes (handle old/new)
  const snapshotsByType = useMemo(() => {
    const map: Record<FeedType, TypeSnapshot[]> = { Starter: [], Grower: [], Finisher: [] };
    (stocktakes || []).forEach((st: any) => {
      if (st && st.feedType && typeof st.totalTons !== "undefined") {
        const ft = st.feedType as FeedType;
        map[ft].push({ date: st.date, total: clampNum(st.totalTons) });
      } else if (st && st.date) {
        if (typeof st.starterT !== "undefined") map.Starter.push({ date: st.date, total: clampNum(st.starterT) });
        if (typeof st.growerT !== "undefined")  map.Grower.push({  date: st.date, total: clampNum(st.growerT) });
        if (typeof st.finisherT !== "undefined")map.Finisher.push({date: st.date, total: clampNum(st.finisherT) });
      }
    });
    (Object.keys(map) as FeedType[]).forEach((ft) => map[ft].sort((a, b) => a.date.localeCompare(b.date)));
    return map;
  }, [stocktakes]);

  const consumptionPerType = useMemo(() => {
    const out: Record<FeedType, number> = { Starter: 0, Grower: 0, Finisher: 0 };

    const deliveredBetween = (type: FeedType, startISO: string, endISO: string) => {
      const start = new Date(startISO + "T00:00:00Z").getTime();
      const end = new Date(endISO + "T00:00:00Z").getTime();
      return (deliveries || [])
        .filter((d) => d.type === type)
        .filter((d) => {
          const ts = new Date(d.date + "T00:00:00Z").getTime();
          return ts > start && ts <= end;
        })
        .reduce((sum, d) => sum + clampNum(d.tons), 0);
    };

    (["Starter", "Grower", "Finisher"] as FeedType[]).forEach((ft) => {
      const snaps = snapshotsByType[ft];
      if (snaps.length < 2) { out[ft] = 0; return; }
      let totalRate = 0, segments = 0;
      for (let i = 1; i < snaps.length; i++) {
        const prev = snaps[i - 1], curr = snaps[i];
        const days = Math.max(1, daysBetween(prev.date, curr.date));
        const del = deliveredBetween(ft, prev.date, curr.date);
        const consumed = Math.max(0, (prev.total + del) - curr.total);
        const rate = consumed / days;
        if (Number.isFinite(rate)) { totalRate += rate; segments++; }
      }
      out[ft] = segments ? +(totalRate / segments).toFixed(3) : 0;
    });

    return out;
  }, [snapshotsByType, deliveries]);

  const estimatedRemainingByType = useMemo(() => {
    const todayISO = toISODate(new Date());
    const latest: Record<FeedType, TypeSnapshot | null> = {
      Starter: snapshotsByType.Starter.at(-1) ?? null,
      Grower:  snapshotsByType.Grower.at(-1)  ?? null,
      Finisher:snapshotsByType.Finisher.at(-1)?? null,
    };

    const addDeliveriesSince = (type: FeedType, sinceISO?: string) =>
      (deliveries || [])
        .filter((d) => d.type === type)
        .filter((d) => (sinceISO ? d.date > sinceISO : true))
        .reduce((sum, d) => sum + clampNum(d.tons), 0);

    const cons = consumptionPerType;

    const baseStarter  = latest.Starter  ? latest.Starter.total  : typeTotalsFromSilos.Starter;
    const baseGrower   = latest.Grower   ? latest.Grower.total   : typeTotalsFromSilos.Grower;
    const baseFinisher = latest.Finisher ? latest.Finisher.total : typeTotalsFromSilos.Finisher;

    const daysStarter  = latest.Starter  ? daysBetween(latest.Starter.date,  todayISO) : 0;
    const daysGrower   = latest.Grower   ? daysBetween(latest.Grower.date,   todayISO) : 0;
    const daysFinisher = latest.Finisher ? daysBetween(latest.Finisher.date, todayISO) : 0;

    return {
      Starter:  Math.max(0, baseStarter  + addDeliveriesSince("Starter",  latest.Starter?.date)  - cons.Starter  * daysStarter),
      Grower:   Math.max(0, baseGrower   + addDeliveriesSince("Grower",   latest.Grower?.date)   - cons.Grower   * daysGrower),
      Finisher: Math.max(0, baseFinisher + addDeliveriesSince("Finisher", latest.Finisher?.date) - cons.Finisher * daysFinisher),
    } as Record<FeedType, number>;
  }, [snapshotsByType, deliveries, typeTotalsFromSilos, consumptionPerType]);

  const estimatedTotal = useMemo(
    () => estimatedRemainingByType.Starter + estimatedRemainingByType.Grower + estimatedRemainingByType.Finisher,
    [estimatedRemainingByType]
  );

  const leftToOrderByType = useMemo(() => {
    const [quotesArr] = [quotes || []];
    const map: Record<FeedType, number> = { Starter: 0, Grower: 0, Finisher: 0 };
    if (!Array.isArray(quotesArr) || quotesArr.length === 0) return map;
    const idx: Partial<Record<FeedType, FeedQuote>> = {};
    quotesArr.forEach((q) => { if (q?.type) idx[q.type] = q; });
    (["Starter", "Grower", "Finisher"] as FeedType[]).forEach((ft) => {
      const target = clampNum(idx[ft]?.targetT ?? 0);
      map[ft] = Math.max(0, target - estimatedRemainingByType[ft]);
    });
    return map;
  }, [quotes, estimatedRemainingByType]);

  return (
    <div className="p-4 space-y-6">
      {/* Header row with Stocktake button */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <FeedStocktakeLightboxButton />
      </div>

      {/* Optional: top tiles mirroring Feed page style (non-invasive) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 border rounded-2xl bg-white">
          <div className="text-xs text-slate-500">Estimated Remaining (Total)</div>
          <div className="text-2xl font-semibold">{estimatedTotal.toFixed(2)} t</div>
          <div className="text-xs text-slate-600">
            Live silo total: {(rows || []).reduce((s, r) => s + (Number(r.levelT) || 0), 0).toFixed(1)} t
          </div>
        </div>
        <div className="p-4 border rounded-2xl bg-white">
          <div className="text-xs text-slate-500">Starter Remaining</div>
          <div className="text-2xl font-semibold">{estimatedRemainingByType.Starter.toFixed(2)} t</div>
          <div className="text-xs text-slate-600">Left to order: {leftToOrderByType.Starter.toFixed(2)} t</div>
        </div>
        <div className="p-4 border rounded-2xl bg-white">
          <div className="text-xs text-slate-500">Grower Remaining</div>
          <div className="text-2xl font-semibold">{estimatedRemainingByType.Grower.toFixed(2)} t</div>
          <div className="text-xs text-slate-600">Left to order: {leftToOrderByType.Grower.toFixed(2)} t</div>
        </div>
        <div className="p-4 border rounded-2xl bg-white">
          <div className="text-xs text-slate-500">Finisher Remaining</div>
          <div className="text-2xl font-semibold">{estimatedRemainingByType.Finisher.toFixed(2)} t</div>
          <div className="text-xs text-slate-600">Left to order: {leftToOrderByType.Finisher.toFixed(2)} t</div>
        </div>
      </div>

      {/* Keep the rest of your dashboard content below as-is, or add more tiles/sections */}
      {/* ... */}
    </div>
  );
}
