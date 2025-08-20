// src/pages/Feed.tsx
import { useEffect, useMemo, useState } from "react";
import { useCloudSlice } from "../lib/cloudSlice";

// --------------------
// Types & constants
// --------------------
type FeedType = "Starter" | "Grower" | "Finisher";
const FEED_TYPES: FeedType[] = ["Starter", "Grower", "Finisher"];

type SiloRow = {
  id: string;
  name: string;
  type: FeedType;
  capacityT?: number; // optional so placeholder can show
  levelT?: number;    // optional so placeholder can show
  notes?: string;
};

// New stocktake shape: per-type snapshot with multiple shed entries
type ShedEntry = { shed: string; tons: number };
type Stocktake = {
  id: string;
  date: string;        // ISO string (yyyy-mm-dd)
  feedType: FeedType;  // the “current feed type” you’re on
  totalTons: number;   // sum of shed entries
  sheds: ShedEntry[];  // per-shed readings
};

type Delivery = {
  id: string;
  date: string; // ISO string
  type: FeedType;
  tons: number;
  notes?: string;
};

type PlannedOrder = {
  id: string;
  date: string; // ISO string
  type: FeedType;
  tons: number;
  reason?: string; // e.g. "Reorder threshold reached"
};

type FeedQuote = {
  type: FeedType;
  targetT?: number;      // preferred refill target tonnage
  thresholdPct?: number; // % of target where we reorder (e.g., 25)
};

// --------------------
// Small helpers
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
function last<T>(arr: T[]): T | null {
  return arr.length ? arr[arr.length - 1] : null;
}

// --------------------
// Page component
// --------------------
export default function Feed() {
  // Existing silos slice (unchanged)
  const [rows, setRows] = useCloudSlice<SiloRow[]>("feedSilos", []);
  const [draft, setDraft] = useState<SiloRow>(emptyRow());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<SiloRow | null>(null);

  // Stocktakes (new shape), deliveries, planned orders, optional quotes
  const [stocktakes, setStocktakes] = useCloudSlice<any[]>("feedStocktakes", []); // any[] for backward-compat
  const [deliveries, setDeliveries] = useCloudSlice<Delivery[]>("feedDeliveries", []);
  const [planned, setPlanned] = useCloudSlice<PlannedOrder[]>("feedPlannedOrders", []);
  const [quotes] = useCloudSlice<FeedQuote[]>("feedQuotes", []); // read if present

  // -------- Existing totals from silos ----------
  const sorted = useMemo(
    () => [...(rows || [])].sort((a, b) => a.name.localeCompare(b.name)),
    [rows]
  );
  const totals = useMemo(() => {
    const cap = (rows || []).reduce((s, r) => s + (Number(r.capacityT) || 0), 0);
    const lvl = (rows || []).reduce((s, r) => s + (Number(r.levelT) || 0), 0);
    return { cap, lvl, pct: cap > 0 ? Math.round((lvl / cap) * 100) : 0 };
  }, [rows]);

  // Type-specific live totals from silos
  const typeTotalsFromSilos = useMemo(() => {
    const byType: Record<FeedType, number> = { Starter: 0, Grower: 0, Finisher: 0 };
    (rows || []).forEach((r) => {
      const t = clampNum(r.levelT ?? 0);
      byType[r.type] += t;
    });
    return byType;
  }, [rows]);

  // -------- Build per-type snapshots from stocktakes (supports new & old shapes) ----------
  type TypeSnapshot = { date: string; total: number };
  const snapshotsByType = useMemo(() => {
    const map: Record<FeedType, TypeSnapshot[]> = {
      Starter: [],
      Grower: [],
      Finisher: [],
    };
    (stocktakes || []).forEach((st: any) => {
      // New shape
      if (st && st.feedType && typeof st.totalTons !== "undefined") {
        const ft = st.feedType as FeedType;
        map[ft].push({ date: st.date, total: clampNum(st.totalTons) });
        return;
      }
      // Backward-compat: old shape with starterT/growerT/finisherT in one record
      if (st && st.date) {
        if (typeof st.starterT !== "undefined")
          map.Starter.push({ date: st.date, total: clampNum(st.starterT) });
        if (typeof st.growerT !== "undefined")
          map.Grower.push({ date: st.date, total: clampNum(st.growerT) });
        if (typeof st.finisherT !== "undefined")
          map.Finisher.push({ date: st.date, total: clampNum(st.finisherT) });
      }
    });
    // sort each by date asc
    (Object.keys(map) as FeedType[]).forEach((ft) =>
      map[ft].sort((a, b) => a.date.localeCompare(b.date))
    );
    return map;
  }, [stocktakes]);

  // -------- Consumption estimate from snapshots ----------
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
      if (snaps.length < 2) {
        out[ft] = 0;
        return;
      }
      let totalRate = 0;
      let segments = 0;
      for (let i = 1; i < snaps.length; i++) {
        const prev = snaps[i - 1];
        const curr = snaps[i];
        const days = Math.max(1, daysBetween(prev.date, curr.date));
        const del = deliveredBetween(ft, prev.date, curr.date);
        // consumption = (prev.total + deliveries) - curr.total
        const consumed = Math.max(0, (prev.total + del) - curr.total);
        const rate = consumed / days; // t/day
        if (Number.isFinite(rate)) {
          totalRate += rate;
          segments += 1;
        }
      }
      out[ft] = segments ? +(totalRate / segments).toFixed(3) : 0;
    });

    return out;
  }, [snapshotsByType, deliveries]);

  // -------- Estimated remaining feed today (by type) ----------
  const estimatedRemainingByType = useMemo(() => {
    const todayISO = toISODate(new Date());

    const latestByType: Record<FeedType, TypeSnapshot | null> = {
      Starter: last(snapshotsByType.Starter),
      Grower:  last(snapshotsByType.Grower),
      Finisher:last(snapshotsByType.Finisher),
    };

    const addDeliveriesSince = (type: FeedType, sinceISO?: string) =>
      (deliveries || [])
        .filter((d) => d.type === type)
        .filter((d) => (sinceISO ? d.date > sinceISO : true))
        .reduce((sum, d) => sum + clampNum(d.tons), 0);

    const cons = consumptionPerType;

    const starterBase = latestByType.Starter ? latestByType.Starter.total : typeTotalsFromSilos.Starter;
    const growerBase  = latestByType.Grower  ? latestByType.Grower.total  : typeTotalsFromSilos.Grower;
    const finisherBase= latestByType.Finisher? latestByType.Finisher.total: typeTotalsFromSilos.Finisher;

    const starterDays = latestByType.Starter ? daysBetween(latestByType.Starter.date, todayISO) : 0;
    const growerDays  = latestByType.Grower  ? daysBetween(latestByType.Grower.date,  todayISO) : 0;
    const finisherDays= latestByType.Finisher? daysBetween(latestByType.Finisher.date,todayISO) : 0;

    return {
      Starter: Math.max(0, starterBase  + addDeliveriesSince("Starter",  latestByType.Starter?.date)  - cons.Starter  * starterDays),
      Grower:  Math.max(0, growerBase   + addDeliveriesSince("Grower",   latestByType.Grower?.date)   - cons.Grower   * growerDays),
      Finisher:Math.max(0, finisherBase + addDeliveriesSince("Finisher", latestByType.Finisher?.date) - cons.Finisher * finisherDays),
    } as Record<FeedType, number>;
  }, [snapshotsByType, deliveries, typeTotalsFromSilos, consumptionPerType]);

  const estimatedTotal = useMemo(
    () => estimatedRemainingByType.Starter + estimatedRemainingByType.Grower + estimatedRemainingByType.Finisher,
    [estimatedRemainingByType]
  );

  // -------- Derived “left to order” (if quotes exist) ----------
  const leftToOrderByType = useMemo(() => {
    const map: Record<FeedType, number> = { Starter: 0, Grower: 0, Finisher: 0 };
    if (!Array.isArray(quotes) || quotes.length === 0) return map;
    const idx: Partial<Record<FeedType, FeedQuote>> = {};
    quotes.forEach((q) => {
      if (q?.type) idx[q.type] = q;
    });
    (["Starter", "Grower", "Finisher"] as FeedType[]).forEach((ft) => {
      const target = clampNum(idx[ft]?.targetT ?? 0);
      map[ft] = Math.max(0, target - estimatedRemainingByType[ft]);
    });
    return map;
  }, [quotes, estimatedRemainingByType]);

  // --------------------
  // Existing handlers
  // --------------------
  function emptyRow(): SiloRow {
    return { id: newId(), name: "", type: "Starter", capacityT: undefined, levelT: undefined, notes: "" };
  }
  const addRow = () => {
    if (!draft.name.trim()) return;
    const cleaned: SiloRow = {
      ...draft,
      id: draft.id || newId(),
      capacityT: clampNum(draft.capacityT ?? 0),
      levelT: Math.max(0, Math.min(clampNum(draft.levelT ?? 0), clampNum(draft.capacityT ?? 0))),
      type: FEED_TYPES.includes(draft.type) ? draft.type : "Starter",
    };
    setRows((prev) => [...(prev || []), cleaned]);
    setDraft(emptyRow());
  };
  const startEdit = (r: SiloRow) => {
    setEditingId(r.id);
    setEdit({ ...r });
  };
  const saveEdit = () => {
    if (!edit) return;
    const cleaned: SiloRow = {
      ...edit,
      name: (edit.name || "").trim(),
      capacityT: clampNum(edit.capacityT ?? 0),
      levelT: Math.max(0, Math.min(clampNum(edit.levelT ?? 0), clampNum(edit.capacityT ?? 0))),
      type: FEED_TYPES.includes(edit.type) ? edit.type : "Starter",
    };
    if (!cleaned.name) return;
    setRows((prev) => prev.map((r) => (r.id === cleaned.id ? cleaned : r)));
    setEditingId(null);
    setEdit(null);
  };
  const remove = (id: string) => {
    if (!confirm("Remove this silo?")) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  // --------------------
  // NEW: stocktake form (by shed, per-type; no notes)
  // --------------------
  const [stDate, setStDate] = useState<string>(() => toISODate(new Date()));
  const [stFeedType, setStFeedType] = useState<FeedType>("Starter");
  const [stSheds, setStSheds] = useState<Array<{ id: string; shed: string; tons: string }>>([
    { id: newId(), shed: "", tons: "" },
  ]);

  const addStShedRow = () => setStSheds((prev) => [...prev, { id: newId(), shed: "", tons: "" }]);
  const removeStShedRow = (id: string) => setStSheds((prev) => prev.filter((r) => r.id !== id));
  const updateStShedRow = (id: string, patch: Partial<{ shed: string; tons: string }>) =>
    setStSheds((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addStocktake = () => {
    // Clean rows
    const sheds: ShedEntry[] = stSheds
      .map((r) => ({ shed: (r.shed || "").trim(), tons: clampNum(r.tons) }))
      .filter((r) => r.tons > 0);

    if (sheds.length === 0) {
      alert("Add at least one shed with a positive tonnage.");
      return;
    }

    const totalTons = sheds.reduce((s, r) => s + r.tons, 0);

    const st: Stocktake = {
      id: newId(),
      date: stDate,
      feedType: stFeedType,
      totalTons,
      sheds,
    };

    setStocktakes((prev) => [...(prev || []), st]);
    // reset form
    setStDate(toISODate(new Date()));
    setStFeedType(stFeedType); // keep current type selected
    setStSheds([{ id: newId(), shed: "", tons: "" }]);
  };

  // --------------------
  // Delivery form (unchanged)
  // --------------------
  const [dlDate, setDlDate] = useState<string>(() => toISODate(new Date()));
  const [dlType, setDlType] = useState<FeedType>("Starter");
  const [dlTons, setDlTons] = useState<string>("");

  const addDelivery = () => {
    const tons = clampNum(dlTons);
    if (tons <= 0) { alert("Enter a delivery tonnage > 0"); return; }
    const d: Delivery = { id: newId(), date: dlDate, type: dlType, tons };
    setDeliveries((prev) => [...(prev || []), d]);
    setDlTons("");
  };

  // --------------------
  // Order planner (unchanged)
  // --------------------
  const [horizonDays, setHorizonDays] = useState<number>(28);

  const recommendations = useMemo(() => {
    const thresholds: Record<FeedType, number> = { Starter: 0, Grower: 0, Finisher: 0 };
    const targets: Record<FeedType, number> = { Starter: 0, Grower: 0, Finisher: 0 };

    const byTypeQuote: Partial<Record<FeedType, FeedQuote>> = {};
    (quotes || []).forEach((q) => (byTypeQuote[q.type] = q));

    (["Starter", "Grower", "Finisher"] as FeedType[]).forEach((ft) => {
      const q = byTypeQuote[ft];
      const target = clampNum(q?.targetT ?? 0);
      const thresholdPct = clampNum(q?.thresholdPct ?? 25);
      const base = estimatedRemainingByType[ft];
      targets[ft] = target > 0 ? target : Math.max(base, 0);
      thresholds[ft] =
        targets[ft] > 0 ? (targets[ft] * thresholdPct) / 100 : Math.max(0, base * 0.25);
    });

    const plan: PlannedOrder[] = [];
    const state: Record<FeedType, number> = {
      Starter: estimatedRemainingByType.Starter,
      Grower: estimatedRemainingByType.Grower,
      Finisher: estimatedRemainingByType.Finisher,
    };
    const cons = consumptionPerType;

    for (let d = 1; d <= horizonDays; d++) {
      (["Starter", "Grower", "Finisher"] as FeedType[]).forEach((ft) => {
        state[ft] = Math.max(0, state[ft] - cons[ft]);
        if (state[ft] <= thresholds[ft]) {
          const need = Math.max(0, targets[ft] - state[ft]);
          if (need > 0.01) {
            const date = toISODate(new Date(Date.now() + d * 24 * 60 * 60 * 1000));
            plan.push({
              id: newId(),
              date,
              type: ft,
              tons: +need.toFixed(2),
              reason: "Reorder threshold reached",
            });
            state[ft] += need; // assume arrival same day for simple plan
          }
        }
      });
    }

    return plan;
  }, [horizonDays, quotes, estimatedRemainingByType, consumptionPerType]);

  const saveRecommendations = () => {
    if (!recommendations.length) {
      alert("No recommended orders to save.");
      return;
    }
    setPlanned((prev) => [...(prev || []), ...recommendations]);
    alert("Planned orders saved.");
  };

  // --------------------
  // History (read-only) — normalize both new & old stocktake shapes
  // --------------------
  type HistoryRow = { id: string; date: string; feedType: FeedType; total: number; sheds?: ShedEntry[] };
  const stocktakeHistory: HistoryRow[] = useMemo(() => {
    const out: HistoryRow[] = [];
    (stocktakes || []).forEach((st: any) => {
      if (st && st.feedType && typeof st.totalTons !== "undefined") {
        // New shape
        out.push({
          id: st.id,
          date: st.date,
          feedType: st.feedType as FeedType,
          total: clampNum(st.totalTons),
          sheds: Array.isArray(st.sheds)
            ? st.sheds.map((s: any) => ({ shed: String(s?.shed || ""), tons: clampNum(s?.tons) }))
            : [],
        });
      } else if (st && st.date) {
        // Old shape: expand to 1 row per defined type
        if (typeof st.starterT !== "undefined")
          out.push({ id: `${st.id || newId()}-starter`, date: st.date, feedType: "Starter", total: clampNum(st.starterT) });
        if (typeof st.growerT !== "undefined")
          out.push({ id: `${st.id || newId()}-grower`,  date: st.date, feedType: "Grower",  total: clampNum(st.growerT) });
        if (typeof st.finisherT !== "undefined")
          out.push({ id: `${st.id || newId()}-finisher`,date: st.date, feedType: "Finisher",total: clampNum(st.finisherT) });
      }
    });
    out.sort((a, b) => b.date.localeCompare(a.date)); // newest first
    return out;
  }, [stocktakes]);

  // --------------------
  // RENDER
  // --------------------
  return (
    <div className="p-4 space-y-6">
      {/* ---- TOP TILES ---- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 border rounded-2xl bg-white">
          <div className="text-xs text-slate-500">Estimated Remaining (Total)</div>
          <div className="text-2xl font-semibold">{estimatedTotal.toFixed(2)} t</div>
          <div className="text-xs text-slate-600">
            Live silo total: {totals.lvl.toFixed(1)} t ({totals.pct}% of {totals.cap.toFixed(1)} t cap)
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

      {/* ---- HEADER ---- */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Feed</h1>
        <div className="text-sm text-slate-600">
          Total: {totals.lvl.toFixed(1)} / {totals.cap.toFixed(1)} t ({totals.pct}%)
        </div>
      </div>

      {/* ---- NEW: STOCKTAKE (by shed, per-type) ---- */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="font-medium mb-3">Record feed stocktake (by shed)</div>
        <div className="grid md:grid-cols-6 gap-3">
          <div>
            <label className="block text-sm mb-1">Date</label>
            <input
              type="date"
              className="w-full border rounded px-2 py-1"
              value={stDate}
              onChange={(e) => setStDate(e.target.value)}
            />
          </div>
            <div>
              <label className="block text-sm mb-1">Current feed type</label>
              <select
                className="w-full border rounded px-2 py-1"
                value={stFeedType}
                onChange={(e) => setStFeedType(e.target.value as FeedType)}
              >
                {FEED_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
        </div>

        {/* Shed rows */}
        <div className="mt-4 space-y-2">
          {stSheds.map((row, idx) => (
            <div key={row.id} className="grid md:grid-cols-6 gap-3 items-end">
              <div className="md:col-span-3">
                <label className="block text-sm mb-1">Shed name</label>
                <input
                  className="w-full border rounded px-2 py-1"
                  placeholder={idx === 0 ? "e.g., Shed 1" : ""}
                  value={row.shed}
                  onChange={(e) => updateStShedRow(row.id, { shed: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Feed in shed (t)</label>
                <input
                  type="number" min={0} step="0.01"
                  className="w-full border rounded px-2 py-1"
                  placeholder={idx === 0 ? "e.g., 12.5" : ""}
                  value={row.tons}
                  onChange={(e) => updateStShedRow(row.id, { tons: e.target.value })}
                />
              </div>
              <div className="md:col-span-1">
                <button
                  className="w-full px-3 py-2 border rounded"
                  onClick={() => removeStShedRow(row.id)}
                  disabled={stSheds.length === 1}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <div>
            <button className="mt-2 px-4 py-2 border rounded" onClick={addStShedRow}>
              + Add another shed
            </button>
          </div>
        </div>

        <div className="mt-3">
          <button className="px-4 py-2 rounded bg-black text-white" onClick={addStocktake}>
            Save stocktake
          </button>
        </div>
      </div>

      {/* ---- NEW: STOCKTAKE HISTORY (read-only) ---- */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="font-medium mb-3">Stocktake history</div>
        {stocktakeHistory.length === 0 ? (
          <div className="text-sm text-slate-600">No stocktakes recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2">Feed type</th>
                  <th className="py-2 pr-2">Total (t)</th>
                  <th className="py-2 pr-2">Per-shed breakdown</th>
                </tr>
              </thead>
              <tbody>
                {stocktakeHistory.map((r) => (
                  <tr key={r.id} className="border-b align-top">
                    <td className="py-2 pr-2">{r.date}</td>
                    <td className="py-2 pr-2">{r.feedType}</td>
                    <td className="py-2 pr-2">{r.total.toFixed(2)}</td>
                    <td className="py-2 pr-2">
                      {r.sheds && r.sheds.length > 0
                        ? r.sheds
                            .map((s) =>
                              `${s.shed || "Shed"}: ${Number(s.tons).toFixed(2)} t`
                            )
                            .join(", ")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- DELIVERY FORM (unchanged) ---- */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="font-medium mb-3">Add feed delivery</div>
        <div className="grid md:grid-cols-6 gap-3">
          <div>
            <label className="block text-sm mb-1">Date</label>
            <input
              type="date"
              className="w-full border rounded px-2 py-1"
              value={dlDate}
              onChange={(e) => setDlDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Feed type</label>
            <select
              className="w-full border rounded px-2 py-1"
              value={dlType}
              onChange={(e) => setDlType(e.target.value as FeedType)}
            >
              {FEED_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Tonnage (t)</label>
            <input
              type="number" min={0} step="0.01"
              className="w-full border rounded px-2 py-1"
              value={dlTons}
              onChange={(e) => setDlTons(e.target.value)}
              placeholder="e.g., 8.0"
            />
          </div>
        </div>
        <div className="mt-3">
          <button className="px-4 py-2 rounded bg-black text-white" onClick={addDelivery}>
            Save delivery
          </button>
        </div>
      </div>

      {/* ---- ORDER PLANNER (unchanged) ---- */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium">Recommended order plan</div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Horizon (days)</label>
            <input
              type="number" min={7} step={1}
              className="w-24 border rounded px-2 py-1"
              value={horizonDays}
              onChange={(e) => setHorizonDays(Math.max(7, parseInt(e.target.value || "28", 10)))}
            />
          </div>
        </div>

        {recommendations.length === 0 ? (
          <div className="text-sm text-slate-600">
            No orders recommended in the next {horizonDays} days (based on current estimates).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2 pr-2">Tons</th>
                  <th className="py-2 pr-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((r) => (
                  <tr key={`${r.date}-${r.type}-${r.tons}`} className="border-b">
                    <td className="py-2 pr-2">{r.date}</td>
                    <td className="py-2 pr-2">{r.type}</td>
                    <td className="py-2 pr-2">{r.tons.toFixed(2)}</td>
                    <td className="py-2 pr-2">{r.reason || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3">
          <button
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-60"
            disabled={recommendations.length === 0}
            onClick={saveRecommendations}
          >
            Save recommended orders
          </button>
        </div>
      </div>

      {/* ---- ADD SILO (unchanged) ---- */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="font-medium mb-3">Add silo</div>
        <div className="grid md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Silo name</label>
            <input
              className="w-full border rounded px-2 py-1"
              placeholder="e.g., Silo 1"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Feed type</label>
            <select
              className="w-full border rounded px-2 py-1"
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value as FeedType })}
            >
              {FEED_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Capacity (t)</label>
            <input
              type="number" min={0} step="0.01"
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              placeholder="0"
              value={draft.capacityT ?? ""}
              onChange={(e) => setDraft({ ...draft, capacityT: e.target.value === "" ? undefined : clampNum(e.target.value) })}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Level (t)</label>
            <input
              type="number" min={0} step="0.01"
              className="w-full border rounded px-2 py-1 placeholder-transparent"
              placeholder="0"
              value={draft.levelT ?? ""}
              onChange={(e) => setDraft({ ...draft, levelT: e.target.value === "" ? undefined : clampNum(e.target.value) })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Notes</label>
            <input
              className="w-full border rounded px-2 py-1"
              value={draft.notes ?? ""}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-3">
          <button className="px-4 py-2 rounded bg-black text-white" onClick={addRow}>
            Add
          </button>
        </div>
      </div>

      {/* ---- SILOS TABLE (unchanged) ---- */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">Silo</th>
                <th className="py-2 pr-2">Type</th>
                <th className="py-2 pr-2">Capacity (t)</th>
                <th className="py-2 pr-2">Level (t)</th>
                <th className="py-2 pr-2">Notes</th>
                <th className="py-2 pr-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="py-2 pr-2">
                    {editingId === r.id ? (
                      <input
                        className="border rounded px-2 py-1"
                        value={edit?.name || ""}
                        onChange={(e) => setEdit((s) => ({ ...(s as SiloRow), name: e.target.value }))}
                      />
                    ) : r.name}
                  </td>

                  <td className="py-2 pr-2">
                    {editingId === r.id ? (
                      <select
                        className="border rounded px-2 py-1"
                        value={edit?.type || "Starter"}
                        onChange={(e) => setEdit((s) => ({ ...(s as SiloRow), type: e.target.value as FeedType }))}
                      >
                        {FEED_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : r.type}
                  </td>

                  <td className="py-2 pr-2">
                    {editingId === r.id ? (
                      <input
                        type="number" min={0} step="0.01"
                        className="border rounded px-2 py-1 placeholder-transparent"
                        placeholder="0"
                        value={edit?.capacityT ?? ""}
                        onChange={(e) =>
                          setEdit((s) => ({
                            ...(s as SiloRow),
                            capacityT: e.target.value === "" ? undefined : clampNum(e.target.value),
                          }))
                        }
                      />
                    ) : (r.capacityT != null ? r.capacityT.toFixed(2) : "—")}
                  </td>

                  <td className="py-2 pr-2">
                    {editingId === r.id ? (
                      <input
                        type="number" min={0} step={0.01}
                        className="border rounded px-2 py-1 placeholder-transparent"
                        placeholder="0"
                        value={edit?.levelT ?? ""}
                        onChange={(e) =>
                          setEdit((s) => ({
                            ...(s as SiloRow),
                            levelT: e.target.value === "" ? undefined : clampNum(e.target.value),
                          }))
                        }
                      />
                    ) : (r.levelT != null ? r.levelT.toFixed(2) : "—")}
                  </td>

                  <td className="py-2 pr-2">
                    {editingId === r.id ? (
                      <input
                        className="border rounded px-2 py-1"
                        value={edit?.notes || ""}
                        onChange={(e) => setEdit((s) => ({ ...(s as SiloRow), notes: e.target.value }))}
                      />
                    ) : (r.notes || "")}
                  </td>

                  <td className="py-2 pr-2">
                    {editingId === r.id ? (
                      <div className="flex gap-2">
                        <button className="px-2 py-1 border rounded" onClick={saveEdit}>Save</button>
                        <button className="px-2 py-1 border rounded" onClick={() => { setEditingId(null); setEdit(null); }}>Cancel</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button className="px-2 py-1 border rounded" onClick={() => startEdit(r)}>Edit</button>
                        <button className="px-2 py-1 border rounded text-red-600" onClick={() => remove(r.id)}>Remove</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td className="py-6 text-gray-500" colSpan={6}>No silos yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
