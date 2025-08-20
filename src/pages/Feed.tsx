// src/pages/Feed.tsx
import { useMemo, useState } from "react";
import { useCloudSlice } from "../lib/cloudSlice";

type FeedType = "starter" | "grower" | "finisher" | "booster";
const FEED_TYPES = ["starter", "grower", "finisher", "booster"] as const;

type FeedQuotas = Partial<Record<FeedType, number>>; // from Setup
type Delivery = {
  id: string;
  date: string;      // YYYY-MM-DD
  type: FeedType;
  loads: number;     // 24t loads
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
    booster: Number(q?.booster ?? 0),
  };
}

export default function Feed() {
  // Do NOT seed quotas here; Setup is the source of truth.
  const [feedQuotas] = useCloudSlice<FeedQuotas | null>("feedQuotas", null);

  // Deliveries are authored here, so default to [] safely.
  const [deliveries, setDeliveries] = useCloudSlice<Delivery[]>("feedDeliveries", []);

  // Draft state for new delivery
  const [draftDate, setDraftDate] = useState<string>(todayStr());
  const [draftType, setDraftType] = useState<FeedType>("starter");
  const [draftLoads, setDraftLoads] = useState<number | "">("");

  const q = normalizeQuotas(feedQuotas);

  // Sum delivered loads by type
  const deliveredByType = useMemo(() => {
    const sums: Record<FeedType, number> = {
      starter: 0,
      grower: 0,
      finisher: 0,
      booster: 0,
    };
    for (const d of deliveries || []) {
      if (!FEED_TYPES.includes(d.type)) continue;
      const loads = Number(d.loads) || 0;
      sums[d.type] += Math.max(0, loads);
    }
    return sums;
  }, [deliveries]);

  // Remaining loads by type = max(0, quota - delivered) — unlimited if booster quota = 0
  const remainingByType = useMemo(() => {
    const rem: Partial<Record<FeedType, number | "unlimited">> = {};
    for (const t of FEED_TYPES) {
      const quota = q[t];
      const del = deliveredByType[t];
      if (t === "booster" && quota === 0) {
        rem[t] = "unlimited";
      } else {
        rem[t] = Math.max(0, (quota || 0) - (del || 0));
      }
    }
    return rem as Record<FeedType, number | "unlimited">;
  }, [q, deliveredByType]);

  // Add a delivery (loads are 24t each)
  function addDelivery() {
    const loads =
      draftLoads === "" ? 0 : Math.max(0, Math.floor(Number(draftLoads) || 0));
    if (!draftDate || !draftType || loads <= 0) return;

    const entry: Delivery = {
      id: uuid(),
      date: draftDate,
      type: draftType,
      loads,
    };
    setDeliveries([...(deliveries || []), entry]);

    // Reset loads to blank so placeholder shows again
    setDraftLoads("");
  }

  function removeDelivery(id: string) {
    if (!confirm("Remove this delivery?")) return;
    setDeliveries((prev) => (prev || []).filter((d) => d.id !== id));
  }

  // Tiles data
  const tiles = useMemo(() => {
    return FEED_TYPES.map((t) => {
      const rem = remainingByType[t];
      if (rem === "unlimited") {
        return {
          key: t,
          title: "Booster",
          subtitle: "Quota: Unlimited",
          main: "",
          tonnes: "",
        };
      }
      const loadsRemaining = Number(rem || 0);
      const tonnesRemaining = loadsRemaining * LOAD_TONNES;
      const title =
        t === "starter"
          ? "Starter"
          : t === "grower"
          ? "Grower"
          : t === "finisher"
          ? "Finisher"
          : "Booster";
      return {
        key: t,
        title,
        subtitle: "",
        main: `${loadsRemaining.toLocaleString()} loads remaining`,
        tonnes: `${tonnesRemaining.toLocaleString()} t`,
      };
    });
  }, [remainingByType]);

  // Sort deliveries newest first
  const rows = useMemo(
    () =>
      [...(deliveries || [])].sort((a, b) =>
        (b.date || "").localeCompare(a.date || "")
      ),
    [deliveries]
  );

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Feed</h1>

      {/* Remaining tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tiles.map((t) => (
          <div key={t.key} className="rounded border p-4 bg-white">
            <div className="text-xs text-slate-500">{t.title}</div>
            {t.subtitle ? (
              <div className="text-sm font-medium mt-1">{t.subtitle}</div>
            ) : (
              <>
                <div className="text-lg font-semibold mt-1">{t.main}</div>
                <div className="text-xs text-slate-500 mt-1">{t.tonnes}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add Delivery */}
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
              <option value="booster">Booster</option>
            </select>
          </label>

          <label className="block">
            <div className="text-sm mb-1">Loads (24t each)</div>
            <input
              type="number"
              min={0}
              className="w-full border rounded px-3 py-2 placeholder-transparent"
              placeholder="1"
              value={draftLoads === "" ? "" : draftLoads}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") setDraftLoads("");
                else setDraftLoads(Math.max(0, Math.floor(Number(v) || 0)));
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
          Each load counts as <strong>{LOAD_TONNES} tonnes</strong>. Remaining quotas update automatically.
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
                <th className="py-2 pr-2">Loads</th>
                <th className="py-2 pr-2">Tonnes</th>
                <th className="py-2 pr-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="py-2 pr-2">{r.date}</td>
                  <td className="py-2 pr-2 capitalize">{r.type}</td>
                  <td className="py-2 pr-2">{r.loads}</td>
                  <td className="py-2 pr-2">{(r.loads * LOAD_TONNES).toLocaleString()} t</td>
                  <td className="py-2 pr-2">
                    <button
                      className="px-2 py-1 border rounded text-red-600"
                      onClick={() => removeDelivery(r.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
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
    </div>
  );
}
