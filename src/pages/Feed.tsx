// src/pages/Feed.tsx
import { useMemo, useState } from "react";
import { useCloudSlice } from "../lib/cloudSlice";
import { useFarm } from "../lib/FarmContext";
/* ========= Types ========= */

type Shed = {
  id: string;
  name: string;
};

type FeedQuotas = { starter?: number; grower?: number; finisher?: number; booster?: number };

function hasAnyQuota(q?: FeedQuotas) {
  if (!q) return false;
  return (["starter", "grower", "finisher", "booster"] as const).some((k) => {
    const v = (q as any)[k];
    // consider set if it’s a finite number (including 0)
    return v !== undefined && v !== null && Number.isFinite(Number(v));
  });
}

function normalizeQuotas(q?: FeedQuotas): Required<FeedQuotas> {
  return {
    starter: Number(q?.starter ?? 0),
    grower: Number(q?.grower ?? 0),
    finisher: Number(q?.finisher ?? 0),
    booster: Number(q?.booster ?? 0),
  };
}

type Settings = {
  // Preferred: array of feed types
  //   [{ name: "Starter", quotaKg: 4000 }, { name: "Grower", quotaKg: 8000 }, ...]
  feedTypes?: Array<{ name?: string; quotaKg?: number }>;

  // Back-compat: object map
  //   { Starter: 4000, Grower: 8000, Finisher: 6000 }
  feedQuotas?: Record<string, number>;
};

type FeedDelivery = {
  id: string;
  date: string;         // YYYY-MM-DD
  feedType?: string;    // "Starter" | "Grower" | "Finisher" | etc.
  kg?: number;          // explicit kilograms
  tonnes?: number;      // or explicit tonnes
  t?: number;           // alias for tonnes
  // optional shedId, notes, etc. are ignored for quota math
};

type FeedStocktakeRow = {
  id: string;
  date: string;         // YYYY-MM-DD
  shedId: string;
  shedName?: string;
  kgRemaining: number;
};

/* ========= Utils ========= */

function toKg(row: Partial<FeedDelivery>): number {
  const kg = Number(row.kg);
  if (isFinite(kg) && kg > 0) return kg;
  const tonnes = Number(row.tonnes ?? row.t);
  if (isFinite(tonnes) && tonnes > 0) return tonnes * 1000;
  return 0;
}

function fmtTonnes(kg: number): string {
  const t = kg / 1000;
  return t.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " t";
}

function rid() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

/* ========= Page ========= */

export default function FeedPage() {
  // Data sources
  const [settings] = useCloudSlice<Settings>("settings", {});
  const [feedDeliveries] = useCloudSlice<FeedDelivery[]>("feedDeliveries", []);
  const [sheds] = useCloudSlice<Shed[]>("sheds", []);
  const [feedStocktake, setFeedStocktake] = useCloudSlice<FeedStocktakeRow[]>("feedStocktake", []);

  const today = new Date().toISOString().slice(0, 10);

  /* ----- Build feed type quotas list (name + quotaKg) ----- */
  const quotas = useMemo(() => {
    const list: { name: string; quotaKg: number }[] = [];

    if (Array.isArray(settings.feedTypes) && settings.feedTypes.length) {
      for (const ft of settings.feedTypes) {
        const name = (ft?.name || "").trim();
        const quotaKg = Math.max(0, Number(ft?.quotaKg) || 0);
        if (name) list.push({ name, quotaKg });
      }
    } else if (settings.feedQuotas && typeof settings.feedQuotas === "object") {
      for (const key of Object.keys(settings.feedQuotas)) {
        const name = key.trim();
        const quotaKg = Math.max(0, Number(settings.feedQuotas[key]) || 0);
        if (name) list.push({ name, quotaKg });
      }
    }

    // stable, alphabetical by name
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [settings]);

  /* ----- Sum deliveries per feed type ----- */
  const deliveredByType = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of feedDeliveries || []) {
      const type = (d.feedType || "").trim();
      if (!type) continue;
      const addKg = toKg(d);
      if (addKg <= 0) continue;
      m.set(type, (m.get(type) || 0) + addKg);
    }
    return m;
  }, [feedDeliveries]);

  /* ----- Build tiles: remaining per feed type (quota − delivered) ----- */
  const feedTiles = useMemo(() => {
    return quotas.map((q) => {
      const used = deliveredByType.get(q.name) || 0;
      const remainingKg = Math.max(0, q.quotaKg - used);
      const pctUsed = q.quotaKg > 0 ? Math.min(100, Math.round((used / q.quotaKg) * 100)) : 0;
      return {
        name: q.name,
        quotaKg: q.quotaKg,
        usedKg: used,
        remainingKg,
        pctUsed,
      };
    });
  }, [quotas, deliveredByType]);

  /* ----- Stocktake UI state (per shed) ----- */
  const [entry, setEntry] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  function onSaveStocktake(shedId: string, shedName: string) {
    const text = (entry[shedId] ?? "").trim();
    const kg = Number(text);
    if (!isFinite(kg) || kg < 0) {
      alert("Enter a valid non-negative kg amount.");
      return;
    }
    setSaving((m) => ({ ...m, [shedId]: true }));

    const row: FeedStocktakeRow = {
      id: rid(),
      date: today,
      shedId,
      shedName,
      kgRemaining: kg,
    };

    // Append to the feedStocktake slice
    const next = Array.isArray(feedStocktake) ? [...feedStocktake, row] : [row];
    setFeedStocktake(next);

    // UX clear
    setTimeout(() => {
      setSaving((m) => ({ ...m, [shedId]: false }));
      setEntry((m) => ({ ...m, [shedId]: "" }));
    }, 250);
  }

  return (
    <div className="p-4 space-y-6">
      {/* Title */}
      <h1 className="text-2xl font-semibold">Feed</h1>

      {/* Feed-type quota remaining tiles */}
      {feedTiles.length === 0 ? (
        <div className="card p-6 text-slate-600">
          No feed quotas configured yet. Add quotas in <span className="font-medium">Setup</span>.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {feedTiles.map((t) => (
            <div key={t.name} className="rounded border p-4 bg-white flex flex-col gap-2">
              <div className="text-xs text-slate-500">{t.name}</div>
              <div className="text-2xl font-semibold">{fmtTonnes(t.remainingKg)}</div>
              <div className="text-xs text-slate-500">remaining</div>

              {/* small progress bar of quota used */}
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden" title={`${t.pctUsed}% of quota used`}>
                <div
                  className="h-2 bg-slate-900 transition-[width] duration-500"
                  style={{ width: `${t.pctUsed}%` }}
                  aria-label={`${t.pctUsed}% used`}
                />
              </div>
              <div className="text-[11px] text-slate-500">
                Used: {fmtTonnes(t.usedKg)} / {fmtTonnes(t.quotaKg)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stocktake section */}
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

                // find last saved stocktake for display
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
                      onChange={(e) => setEntry((m) => ({ ...m, [shedId]: e.target.value }))}
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
