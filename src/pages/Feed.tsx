// src/pages/Feed.tsx
import { useMemo } from "react";
import { useCloudSlice } from "../lib/cloudSlice";

// Quotas as configured in Setup (24t loads)
type FeedQuotas = {
  starter?: number;
  grower?: number;
  finisher?: number;
  booster?: number; // 0 can mean "as needed"
};

// Helpers — treat 0 as a valid, intentional value
function hasAnyQuota(q?: FeedQuotas | null) {
  if (!q) return false;
  return (["starter", "grower", "finisher", "booster"] as const).some((k) => {
    const v = (q as any)[k];
    return v !== undefined && v !== null && Number.isFinite(Number(v));
  });
}
function normalizeQuotas(q?: FeedQuotas | null): Required<FeedQuotas> {
  return {
    starter: Number(q?.starter ?? 0),
    grower: Number(q?.grower ?? 0),
    finisher: Number(q?.finisher ?? 0),
    booster: Number(q?.booster ?? 0),
  };
}

const LOAD_TONNES = 24;

export default function Feed() {
  // NOTE: we default to `null` here so this page does *not* seed any values;
  // quotas are authored in Setup and will sync here automatically.
  const [feedQuotas] = useCloudSlice<FeedQuotas | null>("feedQuotas", null);

  const { haveQuotas, q, totals } = useMemo(() => {
    const have = hasAnyQuota(feedQuotas);
    const qn = normalizeQuotas(feedQuotas);
    const totalLoads = qn.starter + qn.grower + qn.finisher + qn.booster;
    const totalTonnes = totalLoads * LOAD_TONNES;
    return { haveQuotas: have, q: qn, totals: { totalLoads, totalTonnes } };
  }, [feedQuotas]);

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Feed</h1>

      {!haveQuotas ? (
        <div className="card p-4 text-slate-600">
          No feed quotas configured yet. Add quotas in <span className="font-medium">Setup</span>.
        </div>
      ) : (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded border p-4 bg-white">
              <div className="text-xs text-slate-500">Total Loads</div>
              <div className="text-2xl font-semibold">{totals.totalLoads.toLocaleString()}</div>
            </div>
            <div className="rounded border p-4 bg-white">
              <div className="text-xs text-slate-500">Total Tonnes</div>
              <div className="text-2xl font-semibold">
                {totals.totalTonnes.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}{" "}
                t
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="p-4 border rounded-2xl bg-white">
            <div className="font-medium mb-3">Planned Quotas (24t loads)</div>
            <div className="grid md:grid-cols-4 gap-3 text-sm">
              <div className="rounded border p-3">
                <div className="text-xs text-slate-500">Starter</div>
                <div className="text-lg font-semibold">{q.starter}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {(q.starter * LOAD_TONNES).toLocaleString()} t
                </div>
              </div>
              <div className="rounded border p-3">
                <div className="text-xs text-slate-500">Grower</div>
                <div className="text-lg font-semibold">{q.grower}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {(q.grower * LOAD_TONNES).toLocaleString()} t
                </div>
              </div>
              <div className="rounded border p-3">
                <div className="text-xs text-slate-500">Finisher</div>
                <div className="text-lg font-semibold">{q.finisher}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {(q.finisher * LOAD_TONNES).toLocaleString()} t
                </div>
              </div>
              <div className="rounded border p-3">
                <div className="text-xs text-slate-500">Booster</div>
                <div className="text-lg font-semibold">{q.booster}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {(q.booster * LOAD_TONNES).toLocaleString()} t
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Quotas are managed in <span className="font-medium">Setup</span>. One load equals{" "}
              {LOAD_TONNES} tonnes.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
