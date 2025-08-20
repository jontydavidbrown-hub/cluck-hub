// src/pages/Feed.tsx
import { useMemo, useState } from "react";
import { useCloudSlice } from "../lib/cloudSlice";

type FeedType = "starter" | "grower" | "finisher";
const FEED_TYPES = ["starter", "grower", "finisher"] as const;

type FeedQuotas = Partial<Record<FeedType, number>>; // from Setup (loads of 24t each)

// Deliveries now store exact tonnes; legacy "loads" still supported (auto-converted)
type Delivery = {
  id: string;
  date: string;          // YYYY-MM-DD
  type: FeedType;
  tonnes?: number;       // exact weight entered (preferred)
  loads?: number;        // legacy integer loads; converted to tonnes * 24
};

const LOAD_TONNES = 24;
const todayStr = () => new Date().toISOString().slice(0, 10);
const uuid =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? () => crypto.randomUUID()
    : () => Math.random().toString(36).slice(2);

// Normalize quotas to safe numbers (0 when unset)
function normalizeQuotas(q?: FeedQuotas | null): Required<FeedQuotas> {
  return {
    starter: Number(q?.starter ?? 0),
    grower: Number(q?.grower ?? 0),
    finisher: Number(q?.finisher ?? 0),
  };
}

function deliveryTonnes(d: Delivery): number {
  if (typeof d.tonnes === "number" && Number.isFinite(d.tonnes)) {
    return Math.max(0, d.tonnes);
  }
  const loads = Number(d.loads) || 0;
  return Math.max(0, loads * LOAD_TONNES);
}

export default function Feed() {
  // Quotas authored in Setup; do not seed here.
  const [feedQuotas] = useCloudSlice<FeedQuotas | null>("feedQuotas", null);
  const [deliveries, setDeliveries] = useCloudSlice<Delivery[]>("feedDeliveries", []);

  // Draft state for new delivery (exact tonnes)
  const [draftDate, setDraftDate] = useState<string>(todayStr());
  const [draftType, setDraftType] = useState<FeedType>("starter");
  const [draftTonnes, setDraftTonnes] = useState<number | "">("");

  const q = normalizeQuotas(feedQuotas);

  // Sum delivered TONNES by type
  const deliveredTonnesByType = useMemo(() => {
    const sums: Record<FeedType, number> = { starter: 0, grower: 0, finisher: 0 };
    for (const d of deliveries || []) {
      if (!FEED_TYPES.includes(d.type)) continue;
      sums[d.type] += deliveryTonnes(d);
    }
    return sums;
  }, [deliveries]);

  // Convert to delivered LOADS by type (fractional allowed)
  const deliveredLoadsByType = useMemo(() => {
    const loads: Record<FeedType, number> = { starter: 0, grower: 0, finisher: 0 };
    for (const t of FEED_TYPES) {
      loads[t] = deliveredTonnesByType[t] / LOAD_TONNES;
    }
    return loads;
  }, [deliveredTonnesByType]);

  // Remaining loads/tonnes by type
  const remaining = useMemo(() => {
    return FEED_TYPES.map((t) => {
      const quotaLoads = q[t] || 0;
      const deliveredLoads = deliveredLoadsByType[t] || 0;
      const loadsRemaining = Math.max(0, quotaLoads - deliveredLoads);
      const tonnesRemaining = loadsRemaining * LOAD_TONNES;
      const title = t === "starter" ? "Starter" : t === "grower" ? "Grower" : "Finisher";
      return {
        key: t,
        title,
        loadsRemaining,
        tonnesRemaining,
      };
    });
  }, [q, deliveredLoadsByType]);

  // Add a delivery (exact tonnes)
  function addDelivery() {
    const tonnes =
      draftTonnes === "" ? 0 : Math.max(0, Number(draftTonnes));
    if (!draftDate || !draftType || !(tonnes > 0)) return;

    const entry: Delivery = {
      id: uuid(),
      date: draftDate,
      type: draftType,
      tonnes,
    };
    setDeliveries([...(deliveries || []), entry]);
    setDraftTonnes("");
  }

  function removeDelivery(id: string) {
    if (!confirm("Remove this delivery?")) return;
    setDeliveries((prev) => (prev || []).filter((d) => d.id !== id));
  }

  // Sort deliveries newest first
  const rows = useMemo(
    () =>
      [...(deliveries || [])].sort((a, b) =>
        (b.date || "").localeCompare(a.date || "")
      ),
    [deliveries]
  );

  const haveAnyQuota = (q.starter ?? 0) + (q.grower ?? 0) + (q.finisher ?? 0) > 0;

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Feed</h1>

      {!haveAnyQuota ? (
        <div className="card p-4 text-slate-600">
          No feed quotas configured yet. Add quotas in <span className="font-medium">Setup</span>.
        </div>
      ) : (
        <>
          {/* Remaining tiles for Starter/Grower/Finisher */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {remaining.map((r) => (
              <div key={r.key} className="rounded border p-4 bg-white">
                <div className="text-xs text-slate-500">{r.title}</div>
                <div className="text-lg font-semibold mt-1">
                  {r.loadsRemaining.toLocaleString(undefined, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}{" "}
                  loads remaining
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {r.tonnesRemaining.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}{" "}
                  t
                </div>
              </div>
            ))}
          </div>

          {/* Add Delivery (exact tonnes) */}
          <div className="p-4 border rounded-2xl bg-white">
            <div className="font-medium mb-3">Add Delivery</div>
            <div className="grid md:grid-cols-6 gap-3 items-end">
              <label className="block">
                <div className="text-sm mb-1">Date</div>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2 placeholder-transparent"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                />
              </label>

              <label className="block">
                <div className="text-sm mb-1">Feed Type</div>
                <select
                  className="w-full border rounded px-3 py-2 bg-white"
                  value={draftType}
                  onChange={(e) => setDraftType(e.target.value as FeedType)}
                >
                  <option value="starter">Starter</option>
                  <option value="grower">Grower</option>
                  <option value="finisher">Finisher</option>
                </select>
              </label>

              <label className="block">
                <div className="text-sm mb-1">Tonnes delivered</div>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  className="w-full border rounded px-3 py-2 placeholder-transparent"
                  placeholder="e.g. 23.4"
                  value={draftTonnes === "" ? "" : draftTonnes}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") setDraftTonnes("");
                    else setDraftTonnes(Math.max(0, Number(v)));
                  }}
                />
              </label>

              <div className="md:col-span-3">
                <button className="rounded bg-slate-900 text-white px-4 py-2" onClick={addDelivery}>
                  Add
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Remaining quotas update automatically. One load equals <strong>{LOAD_TONNES} tonnes</strong>.
            </p>
          </div>

          {/* Deliveries list */}
          <div className="p-4 border rounded-2xl bg-white">
            <div className="font-medium mb-3">Deliveries</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2">Type</th>
                    <th className="py-2 pr-2">Tonnes</th>
                    <th className="py-2 pr-2">Loads (≈)</th>
                    <th className="py-2 pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const tonnes = deliveryTonnes(r);
                    const loadsApprox = tonnes / LOAD_TONNES;
                    return (
                      <tr key={r.id} className="border-b">
                        <td className="py-2 pr-2">{r.date}</td>
                        <td className="py-2 pr-2 capitalize">{r.type}</td>
                        <td className="py-2 pr-2">
                          {tonnes.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t
                        </td>
                        <td className="py-2 pr-2">
                          {loadsApprox.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        </td>
                        <td className="py-2 pr-2">
                          <button
                            className="px-2 py-1 border rounded text-red-600"
                            onClick={() => removeDelivery(r.id)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-slate-500">
                        No deliveries yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
