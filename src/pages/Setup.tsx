// src/pages/Setup.tsx
import { useMemo, useState } from "react";
import { useCloudSlice } from "../lib/cloudSlice";

type Settings = {
  batchLengthDays?: number; // e.g., 42
};

type Shed = {
  id: string;
  name: string;
  placementDate?: string;       // YYYY-MM-DD
  placementBirds?: number;      // legacy support
  birdsPlaced?: number;         // current field
};

type FeedQuotas = {
  starter: number;   // 24t loads
  grower: number;    // 24t loads
  finisher: number;  // 24t loads
  booster: number;   // 24t loads (0 = unlimited/as needed)
};

type SiloCaps = Record<string, number>; // shedId -> capacity tonnes

// Helpers
const clampNonNeg = (v: any) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : 0);
const uuid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2));

export default function Setup() {
  // Cloud-synced slices (scoped by farm via useCloudSlice implementation)
  const [settings, setSettings] = useCloudSlice<Settings>("settings", { batchLengthDays: 42 });
  const [sheds, setSheds] = useCloudSlice<Shed[]>("sheds", []);
  const [feedQuotas, setFeedQuotas] = useCloudSlice<FeedQuotas>("feedQuotas", {
    starter: 4,
    grower: 8,
    finisher: 12,
    booster: 0,
  });
  const [siloCaps, setSiloCaps] = useCloudSlice<SiloCaps>("siloCapacities", {}); // NEW

  const [justSaved, setJustSaved] = useState<null | string>(null);

  const shedsSorted = useMemo(
    () => [...(sheds || [])].sort((a, b) => (a?.name || "").localeCompare(b?.name || "")),
    [sheds]
  );

  function addShed() {
    const next: Shed = { id: uuid(), name: "", placementDate: "", birdsPlaced: undefined };
    setSheds([...(sheds || []), next]);
  }

  function updateShed<K extends keyof Shed>(id: string, key: K, value: Shed[K]) {
    setSheds((prev) => (prev || []).map((s) => (s.id === id ? { ...s, [key]: value } : s)));
  }

  function removeShed(id: string) {
    if (!confirm("Remove this shed?")) return;
    setSheds((prev) => (prev || []).filter((s) => s.id !== id));
    // also prune capacity entry for removed shed
    setSiloCaps((prev) => {
      const next = { ...(prev || {}) };
      delete next[id];
      return next;
    });
  }

  function saveNow() {
    // Force a push by setting to shallow-copied values
    setSheds([...(sheds || [])]);
    setSettings({ ...(settings || {}) });
    setFeedQuotas({ ...(feedQuotas || { starter: 0, grower: 0, finisher: 0, booster: 0 }) });
    setSiloCaps({ ...(siloCaps || {}) }); // NEW
    setJustSaved("Saved ✓");
    window.setTimeout(() => setJustSaved(null), 1500);
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Setup</h1>
        <div className="flex items-center gap-2">
          {justSaved && <span className="text-sm text-emerald-600">{justSaved}</span>}
          <button className="rounded bg-slate-900 text-white px-4 py-2" onClick={saveNow}>
            Save
          </button>
        </div>
      </div>

      {/* Batch Settings */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="font-medium mb-3">Batch Settings</div>
        <div className="grid md:grid-cols-3 gap-3">
          <label className="block">
            <div className="text-sm mb-1">Batch Length (days)</div>
            <input
              type="number"
              min={1}
              className="w-full border rounded px-3 py-2 placeholder-transparent"
              placeholder="e.g. 51"
              value={
                typeof settings.batchLengthDays === "number" && settings.batchLengthDays > 0
                  ? settings.batchLengthDays
                  : ""
              }
              onChange={(e) =>
                setSettings({
                  ...settings,
                  batchLengthDays: Math.max(1, Number(e.target.value || 1)),
                })
              }
            />
          </label>
        </div>
      </div>

      {/* Sheds */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium">Sheds</div>
          <button className="rounded border px-3 py-1 hover:bg-slate-50" onClick={addShed}>
            Add Shed
          </button>
        </div>

        {shedsSorted.length === 0 ? (
          <div className="text-sm text-slate-600">No sheds yet. Click “Add Shed”.</div>
        ) : (
          <div className="space-y-3">
            {shedsSorted.map((s) => (
              <div key={s.id} className="grid md:grid-cols-12 gap-3 items-end p-3 rounded-xl border">
                {/* Shed name */}
                <label className="md:col-span-4 block">
                  <div className="text-sm mb-1">Shed</div>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2 placeholder-transparent"
                    placeholder="e.g., Shed 1"
                    value={s.name ?? ""}
                    onChange={(e) => updateShed(s.id, "name", e.target.value)}
                  />
                </label>

                {/* Placement date */}
                <label className="md:col-span-4 block">
                  <div className="text-sm mb-1">Placement Date</div>
                  <input
                    type="date"
                    className="w-full border rounded px-3 py-2 placeholder-transparent"
                    value={s.placementDate ?? ""}
                    onChange={(e) => updateShed(s.id, "placementDate", e.target.value)}
                  />
                </label>

                {/* Placement birds */}
                <label className="md:col-span-3 block">
                  <div className="text-sm mb-1">Placement Birds</div>
                  <input
                    type="number"
                    min={0}
                    className="w-full border rounded px-3 py-2 placeholder-transparent"
                    placeholder="0"
                    value={
                      s.birdsPlaced !== undefined
                        ? s.birdsPlaced
                        : s.placementBirds !== undefined
                        ? s.placementBirds
                        : ""
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      updateShed(
                        s.id,
                        "birdsPlaced",
                        v === "" ? undefined : Math.max(0, Number(v))
                      );
                    }}
                  />
                </label>

                {/* Remove */}
                <div className="md:col-span-1">
                  <button
                    className="w-full rounded border px-3 py-2 text-red-600 hover:bg-red-50"
                    onClick={() => removeShed(s.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feed Quotas (24t loads) */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="font-medium mb-3">Feed Quotas (24t loads)</div>

        <div className="grid md:grid-cols-4 gap-3">
          <label className="block">
            <div className="text-sm mb-1">Starter</div>
            <input
              type="number"
              min={0}
              className="w-full border rounded px-3 py-2 placeholder-transparent"
              placeholder="0"
              value={Number.isFinite(feedQuotas.starter) ? feedQuotas.starter : ""}
              onChange={(e) =>
                setFeedQuotas({
                  ...feedQuotas,
                  starter: clampNonNeg(e.target.value || 0),
                })
              }
            />
          </label>

          <label className="block">
            <div className="text-sm mb-1">Grower</div>
            <input
              type="number"
              min={0}
              className="w-full border rounded px-3 py-2 placeholder-transparent"
              placeholder="0"
              value={Number.isFinite(feedQuotas.grower) ? feedQuotas.grower : ""}
              onChange={(e) =>
                setFeedQuotas({
                  ...feedQuotas,
                  grower: clampNonNeg(e.target.value || 0),
                })
              }
            />
          </label>

          <label className="block">
            <div className="text-sm mb-1">Finisher</div>
            <input
              type="number"
              min={0}
              className="w-full border rounded px-3 py-2 placeholder-transparent"
              placeholder="0"
              value={Number.isFinite(feedQuotas.finisher) ? feedQuotas.finisher : ""}
              onChange={(e) =>
                setFeedQuotas({
                  ...feedQuotas,
                  finisher: clampNonNeg(e.target.value || 0),
                })
              }
            />
          </label>

          <label className="block">
            <div className="text-sm mb-1">Booster</div>
            <input
              type="number"
              min={0}
              className="w-full border rounded px-3 py-2 placeholder-transparent"
              placeholder="0"
              value={Number.isFinite(feedQuotas.booster) ? feedQuotas.booster : ""}
              onChange={(e) =>
                setFeedQuotas({
                  ...feedQuotas,
                  booster: clampNonNeg(e.target.value || 0), // 0 = unlimited
                })
              }
            />
          </label>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          Enter the planned number of <strong>24t loads</strong> for each feed type. Set{" "}
          <strong>Booster</strong> to <strong>0</strong> if it’s unlimited/as needed.
        </p>
      </div>

      {/* NEW: Silo Capacities (per shed, tonnes) */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="font-medium mb-3">Silo Capacities (tonnes)</div>

        {shedsSorted.length === 0 ? (
          <div className="text-sm text-slate-600">No sheds yet. Add sheds above first.</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-3">
            {shedsSorted.map((s) => (
              <label key={s.id} className="block">
                <div className="text-sm mb-1">
                  {s.name || `Shed ${String(s.id).slice(0, 4)}`}
                </div>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  className="w-full border rounded px-3 py-2 placeholder-transparent"
                  placeholder="e.g. 36"
                  value={
                    Number.isFinite((siloCaps || {})[s.id])
                      ? (siloCaps as SiloCaps)[s.id]
                      : ""
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    setSiloCaps((prev) => {
                      const next: SiloCaps = { ...(prev || {}) };
                      if (v === "") {
                        delete next[s.id];
                      } else {
                        next[s.id] = Math.max(0, Number(v));
                      }
                      return next;
                    });
                  }}
                />
              </label>
            ))}
          </div>
        )}

        <p className="mt-2 text-xs text-slate-500">
          Set each shed’s silo capacity (in tonnes). The dashboard will use this to show the{" "}
          <strong>% of capacity remaining</strong> based on stocktakes, deliveries, and estimated consumption.
        </p>
      </div>
    </div>
  );
}
