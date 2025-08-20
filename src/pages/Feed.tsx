// src/pages/Feed.tsx
import { useMemo, useState } from "react";
import { useCloudSlice } from "../lib/cloudSlice";
import { estimateShedFeedKgToday } from "../lib/rossFeed";

/**
 * Types
 */
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
  // structured morts/culls (compat with your other pages)
  morts?: number;
  cullRunts?: number;
  cullLegs?: number;
  cullNonStart?: number;
  cullOther?: number;
  culls?: number;
  mortalities?: number;        // morts + culls (if saved as total)
};

type FeedStocktakeRow = {
  id: string;
  date: string;         // YYYY-MM-DD
  shedId: string;
  shedName?: string;
  kgRemaining: number;  // stocktake value (actual) at "date"
};

type Settings = {
  batchLengthDays?: number;
};

/**
 * Helpers
 */
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

/**
 * Page
 */
export default function FeedPage() {
  // Data
  const [sheds] = useCloudSlice<Shed[]>("sheds", []);
  const [dailyLog] = useCloudSlice<DailyLogRow[]>("dailyLog", []);
  const [settings] = useCloudSlice<Settings>("settings", {});
  const [feedStocktake] = useCloudSlice<FeedStocktakeRow[]>("feedStocktake", []); // read-only; we emit events for writes

  const today = new Date().toISOString().slice(0, 10);
  const batchLen = Math.max(1, Number(settings.batchLengthDays ?? 42));

  // Derived data used by tiles (live birds & today's est. feed use)
  const {
    perShedLiveBirds,
    perShedAgeDays,
    latestStocktakeByShed,
    totalEstFeedKgToday,
    feedTiles,
  } = useMemo(() => {
    const rows = dailyLog || [];

    // Build mortalities per shed
    const mortalitiesByShed = new Map<string, number>();
    for (const r of rows) {
      const key = (r.shed || "").trim();
      if (!key) continue;
      const mOnly = mortsOnly(r);
      const cOnly = cullsOnly(r);
      const mortalitiesTotal =
        typeof r.mortalities === "number" ? Math.max(0, r.mortalities) : mOnly + cOnly;
      mortalitiesByShed.set(key, (mortalitiesByShed.get(key) || 0) + mortalitiesTotal);
    }

    // Latest stocktake per shedId
    const latestStocktakeByShed = new Map<string, FeedStocktakeRow>();
    for (const row of feedStocktake || []) {
      if (!row?.shedId || typeof row.kgRemaining !== "number") continue;
      const prev = latestStocktakeByShed.get(row.shedId);
      if (!prev || (row.date && prev.date && row.date > prev.date)) {
        latestStocktakeByShed.set(row.shedId, row);
      }
    }

    let totalEstFeedKgToday = 0;
    const perShedLiveBirds = new Map<string, number>();
    const perShedAgeDays = new Map<string, number>();

    const feedTiles = (sheds || [])
      .slice()
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      .map((s) => {
        const shedName = s.name || "";
        const placed = Number(s.birdsPlaced ?? s.placementBirds) || 0;

        const mortsTotal = mortalitiesByShed.get(shedName) || 0;
        const liveBirds = Math.max(0, placed - mortsTotal);

        let ageDays = 0;
        if (s.placementDate) {
          ageDays = daysBetweenUTC(s.placementDate, today);
        }

        // Today's estimated consumption for context (not shown big in tiles, but useful below)
        const feedKgToday =
          s.placementDate && liveBirds > 0
            ? estimateShedFeedKgToday(ageDays, liveBirds)
            : 0;
        totalEstFeedKgToday += feedKgToday;

        perShedLiveBirds.set(s.id, liveBirds);
        perShedAgeDays.set(s.id, ageDays);

        // Latest known actual remaining from stocktake
        const latest = latestStocktakeByShed.get(s.id) || null;

        return {
          id: s.id,
          name: shedName,
          latestKg: latest?.kgRemaining ?? null,
          latestDate: latest?.date ?? null,
        };
      });

    return {
      perShedLiveBirds,
      perShedAgeDays,
      latestStocktakeByShed,
      totalEstFeedKgToday,
      feedTiles,
    };
  }, [sheds, dailyLog, feedStocktake, batchLen, today]);

  /**
   * STOCKTAKE UI (simple & per-shed)
   */
  const [entry, setEntry] = useState<Record<string, string>>({}); // shedId -> input text
  const [saving, setSaving] = useState<Record<string, boolean>>({}); // shedId -> busy

  function onSaveStocktake(shedId: string, shedName: string) {
    const text = (entry[shedId] ?? "").trim();
    const kg = Number(text);
    if (!isFinite(kg) || kg < 0) {
      alert("Enter a valid non-negative kg amount.");
      return;
    }
    setSaving((m) => ({ ...m, [shedId]: true }));

    // Dispatch an app-wide event to persist however you prefer
    // Example: listen in your app root and write to your DB/cloud
    window.dispatchEvent(
      new CustomEvent("feed-stocktake", {
        detail: {
          shedId,
          shedName,
          kgRemaining: kg,
          date: new Date().toISOString().slice(0, 10),
        },
      })
    );

    // UX: pretend save completes quickly; clear input
    setTimeout(() => {
      setSaving((m) => ({ ...m, [shedId]: false }));
      setEntry((m) => ({ ...m, [shedId]: "" }));
    }, 300);
  }

  return (
    <div className="p-4 space-y-6">
      {/* Title */}
      <h1 className="text-2xl font-semibold">Feed</h1>

      {/* --- FEED REMAINING TILES --- */}
      {feedTiles.length === 0 ? (
        <div className="card p-6 text-slate-600">
          No sheds yet. Add one in <span className="font-medium">Setup</span>.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {feedTiles.map((t) => (
            <div key={t.id} className="card p-4 flex flex-col gap-2">
              <div className="text-lg font-semibold">{t.name || "—"}</div>
              <div className="text-xs text-slate-500">Feed remaining</div>
              <div className="text-2xl font-semibold">
                {typeof t.latestKg === "number"
                  ? `${t.latestKg.toLocaleString()} kg`
                  : "—"}
              </div>
              <div className="text-xs text-slate-500">
                {t.latestDate ? `as at ${t.latestDate}` : "\u00A0"}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Optional small total context (today's estimated consumption across all sheds) */}
      <div className="rounded border p-4 bg-white">
        <div className="text-xs text-slate-500">Estimated total feed use today</div>
        <div className="text-2xl font-semibold">
          {(totalEstFeedKgToday / 1000).toLocaleString(undefined, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}{" "}
          t
        </div>
      </div>

      {/* --- STOCKTAKE SECTION --- */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Stocktake</h2>
        <p className="text-slate-600 text-sm">
          Enter the actual feed remaining (<span className="font-medium">kg</span>) for each shed and hit{" "}
          <span className="font-medium">Save</span>.
        </p>

        {sheds.length === 0 ? (
          <div className="card p-6 text-slate-600">No sheds available.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sheds
              .slice()
              .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
              .map((s) => {
                const shedId = s.id;
                const shedName = s.name || "—";
                const value = entry[shedId] ?? "";
                const busy = !!saving[shedId];

                const last = (feedStocktake || [])
                  .filter((r) => r.shedId === shedId)
                  .sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0))[0];

                return (
                  <div key={shedId} className="card p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-semibold">{shedName}</div>
                      <div className="text-xs text-slate-500">
                        {last
                          ? `Last: ${last.kgRemaining.toLocaleString()} kg on ${last.date}`
                          : "No previous stocktake"}
                      </div>
                    </div>

                    <label className="text-sm text-slate-600">Feed remaining (kg)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="w-full rounded border p-2"
                      placeholder="e.g. 1250"
                      value={value}
                      onChange={(e) =>
                        setEntry((m) => ({ ...m, [shedId]: e.target.value }))
                      }
                      min={0}
                      step="0.1"
                    />

                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={busy}
                        className={`px-3 py-2 rounded border ${
                          busy ? "opacity-60 cursor-not-allowed" : "hover:bg-slate-50"
                        }`}
                        onClick={() => onSaveStocktake(shedId, shedName)}
                      >
                        {busy ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </section>
    </div>
  );
}
