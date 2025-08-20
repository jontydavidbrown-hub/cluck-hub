// src/pages/Feed.tsx
import { useMemo, useState } from "react";
import { useCloudSlice } from "../lib/cloudSlice";

type FeedType = "starter" | "grower" | "finisher";
const FEED_TYPES = ["starter", "grower", "finisher"] as const;

type FeedQuotas = Partial<Record<FeedType, number>>; // from Setup (loads of 24t each)

type Delivery = {
  id: string;
  date: string;          // YYYY-MM-DD
  type: FeedType;
  tonnes?: number;       // exact weight entered (preferred)
  loads?: number;        // legacy integer loads; converted to tonnes * 24
};

type Shed = {
  id: string;
  name: string;
  placementDate?: string;
  placementBirds?: number;
  birdsPlaced?: number;
};

// Stocktake entries (per shed, exact tonnes on hand)
// Support legacy items which may have only `date`; new ones use `dateTime`.
type Stocktake = {
  id: string;
  shedId: string;
  tonnes: number;
  dateTime?: string; // ISO string
  date?: string;     // legacy YYYY-MM-DD
};

const LOAD_TONNES = 24;
const todayStr = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();
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
  if (typeof d.tonnes === "number" && Number.isFinite(d.tonnes)) return Math.max(0, d.tonnes);
  const loads = Number(d.loads) || 0;
  return Math.max(0, loads * LOAD_TONNES);
}

export default function Feed() {
  // Quotas authored in Setup; do not seed here.
  const [feedQuotas] = useCloudSlice<FeedQuotas | null>("feedQuotas", null);
  // Deliveries authored here.
  const [deliveries, setDeliveries] = useCloudSlice<Delivery[]>("feedDeliveries", []);
  // Sheds (for stocktake selector)
  const [sheds] = useCloudSlice<Shed[]>("sheds", []);
  // Stocktakes (per shed total on-hand)
  const [stocktakes, setStocktakes] = useCloudSlice<Stocktake[]>("feedStocktakes", []);

  // --- Add Delivery (unchanged logic, exact tonnes) ---
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
    for (const t of FEED_TYPES) loads[t] = deliveredTonnesByType[t] / LOAD_TONNES;
    return loads;
  }, [deliveredTonnesByType]);

  // Remaining tiles
  const remaining = useMemo(() => {
    return FEED_TYPES.map((t) => {
      const quotaLoads = q[t] || 0;
      const deliveredLoads = deliveredLoadsByType[t] || 0;
      const loadsRemaining = Math.max(0, quotaLoads - deliveredLoads);
      const tonnesRemaining = loadsRemaining * LOAD_TONNES;
      const title = t === "starter" ? "Starter" : t === "grower" ? "Grower" : "Finisher";
      return { key: t, title, loadsRemaining, tonnesRemaining };
    });
  }, [q, deliveredLoadsByType]);

  function addDelivery() {
    const tonnes = draftTonnes === "" ? 0 : Math.max(0, Number(draftTonnes));
    if (!draftDate || !draftType || !(tonnes > 0)) return;
    const entry: Delivery = { id: uuid(), date: draftDate, type: draftType, tonnes };
    setDeliveries([...(deliveries || []), entry]);
    setDraftTonnes("");
  }
  function removeDelivery(id: string) {
    if (!confirm("Remove this delivery?")) return;
    setDeliveries((prev) => (prev || []).filter((d) => d.id !== id));
  }

  // --- Single-tile Stocktake ---
  const shedsSorted = useMemo(
    () => [...(sheds || [])].sort((a, b) => (a?.name || "").localeCompare(b?.name || "")),
    [sheds]
  );
  const firstShedId = shedsSorted[0]?.id ?? "";
  const [stShedId, setStShedId] = useState<string>(firstShedId);
  const [stTonnes, setStTonnes] = useState<number | "">("");

  // Keep selected shed in range if sheds change
  if (stShedId && !shedsSorted.find((s) => s.id === stShedId)) {
    // selected shed deleted; fall back
    if (firstShedId !== stShedId) setStShedId(firstShedId);
  }

  function addStocktake() {
    const tonnes = stTonnes === "" ? 0 : Math.max(0, Number(stTonnes));
    if (!stShedId || !(tonnes > 0)) return;
    const entry: Stocktake = {
      id: uuid(),
      shedId: stShedId,
      tonnes,
      dateTime: nowIso(),
    };
    setStocktakes([...(stocktakes || []), entry]);
    setStTonnes("");
  }

  // Stocktake history newest first
  const stocktakeRows = useMemo(() => {
    const list = [...(stocktakes || [])];
    list.sort((a, b) => {
      const aKey = a.dateTime || (a.date ? a.date + "T00:00:00Z" : "");
      const bKey = b.dateTime || (b.date ? b.date + "T00:00:00Z" : "");
      return (bKey || "").localeCompare(aKey || "");
    });
    return list;
  }, [stocktakes]);

  // Deliveries list newest first
  const deliveryRows = useMemo(
    () => [...(deliveries || [])].sort((a, b) => (b.date || "").localeCompare(a.date || "")),
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
                <div className="text-xs text-slate-500">{r.title} Remaining (Loads)</div>
                <div className="text-lg font-semibold mt-1">
                  {Math.max(0, r.loadsRemaining).toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
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

          {/* Single Stocktake tile */}
          <div className="p-4 border rounded-2xl bg-white">
            <div className="font-medium mb-3">Feed Stocktake</div>

            {(shedsSorted || []).length === 0 ? (
              <div className="text-sm text-slate-600">
                No sheds yet. Add sheds in <span className="font-medium">Setup</span>.
              </div>
            ) : (
              <div className="grid md:grid-cols-6 gap-3 items-end">
                <label className="block md:col-span-3">
                  <div className="text-sm mb-1">Shed</div>
                  <select
                    className="w-full border rounded px-3 py-2 bg-white"
                    value={stShedId || firstShedId}
                    onChange={(e) => setStShedId(e.target.value)}
                  >
                    {shedsSorted.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name || `Shed ${String(s.id).slice(0, 4)}`}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block md:col-span-2">
                  <div className="text-sm mb-1">Tonnes</div>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    className="w-full border rounded px-3 py-2 placeholder-transparent"
                    placeholder="e.g. 23.4"
                    value={stTonnes === "" ? "" : stTonnes}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") setStTonnes("");
                      else setStTonnes(Math.max(0, Number(v)));
                    }}
                  />
                </label>

                <div className="md:col-span-1">
                  <button className="w-full rounded bg-slate-900 text-white px-4 py-2" onClick={addStocktake}>
                    Okay
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Stocktake History */}
          <div className="p-4 border rounded-2xl bg-white">
            <div className="font-medium mb-3">Stocktake History</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2">Time</th>
                    <th className="py-2 pr-2">Shed</th>
                    <th className="py-2 pr-2">Tonnes left</th>
                  </tr>
                </thead>
                <tbody>
                  {stocktakeRows.map((st) => {
                    const when = st.dateTime || (st.date ? st.date + "T00:00:00Z" : "");
                    const d = when ? new Date(when) : null;
                    const dateStr = d ? d.toLocaleDateString() : "-";
                    const timeStr = d ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-";
                    const shedName = shedsSorted.find((s) => s.id === st.shedId)?.name || `Shed ${String(st.shedId).slice(0, 4)}`;
                    return (
                      <tr key={st.id} className="border-b">
                        <td className="py-2 pr-2">{dateStr}</td>
                        <td className="py-2 pr-2">{timeStr}</td>
                        <td className="py-2 pr-2">{shedName}</td>
                        <td className="py-2 pr-2">
                          {Number(st.tonnes || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t
                        </td>
                      </tr>
                    );
                  })}
                  {stocktakeRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-slate-500">
                        No stocktakes yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
                  {deliveryRows.map((r) => {
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
                          <button className="px-2 py-1 border rounded text-red-600" onClick={() => removeDelivery(r.id)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {deliveryRows.length === 0 && (
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
