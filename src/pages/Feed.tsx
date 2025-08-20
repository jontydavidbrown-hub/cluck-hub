// src/pages/Feed.tsx
import { useMemo, useState, useEffect } from "react";
import { useCloudSlice } from "../lib/cloudSlice";

type FeedType = "starter" | "grower" | "finisher" | "booster";
const FEED_TYPES = ["starter", "grower", "finisher", "booster"] as const;

type FeedQuotas = Partial<Record<FeedType, number>>; // loads of 24t each (0 = unlimited)

type Delivery = {
  id: string;
  date: string;          // YYYY-MM-DD
  type: FeedType;
  tonnes?: number;       // exact weight (preferred)
  loads?: number;        // legacy; converted to tonnes * 24
  shedId?: string;       // optional association
};

type Shed = {
  id: string;
  name: string;
  placementDate?: string;
  placementBirds?: number;
  birdsPlaced?: number;
};

type Stocktake = {
  id: string;
  shedId: string;
  tonnes: number;
  dateTime?: string;   // ISO
  date?: string;       // legacy YYYY-MM-DD
};

const LOAD_TONNES = 24;
const todayStr = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();
const uuid =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? () => crypto.randomUUID()
    : () => Math.random().toString(36).slice(2);

function normalizeQuotas(q?: FeedQuotas | null): Required<FeedQuotas> {
  return {
    starter: Number(q?.starter ?? 0),
    grower: Number(q?.grower ?? 0),
    finisher: Number(q?.finisher ?? 0),
    booster: Number(q?.booster ?? 0),
  };
}

function deliveryTonnes(d: Delivery): number {
  if (typeof d.tonnes === "number" && Number.isFinite(d.tonnes)) return Math.max(0, d.tonnes);
  const loads = Number(d.loads) || 0;
  return Math.max(0, loads * LOAD_TONNES);
}

export default function Feed() {
  const [feedQuotas] = useCloudSlice<FeedQuotas | null>("feedQuotas", null);
  const [deliveries, setDeliveries] = useCloudSlice<Delivery[]>("feedDeliveries", []);
  const [sheds] = useCloudSlice<Shed[]>("sheds", []);
  const [stocktakes, setStocktakes] = useCloudSlice<Stocktake[]>("feedStocktakes", []);

  const q = normalizeQuotas(feedQuotas);
  const haveAnyQuota =
    (q.starter ?? 0) + (q.grower ?? 0) + (q.finisher ?? 0) + (q.booster ?? 0) > 0;

  // ------ Remaining tiles (now Tonnes primary, Loads secondary; hide unlimited = quota 0) ------
  const deliveredTonnesByType = useMemo(() => {
    const sums: Record<FeedType, number> = { starter: 0, grower: 0, finisher: 0, booster: 0 };
    for (const d of deliveries || []) {
      if (!FEED_TYPES.includes(d.type)) continue;
      sums[d.type] += deliveryTonnes(d);
    }
    return sums;
  }, [deliveries]);

  const remainingSummary = useMemo(() => {
    // show only those with finite quotas (>0)
    const showTypes = FEED_TYPES.filter((t) => (q[t] || 0) > 0);
    return showTypes.map((t) => {
      const quotaLoads = q[t] || 0;
      const quotaTonnes = quotaLoads * LOAD_TONNES;
      const usedTonnes = deliveredTonnesByType[t] || 0;
      const tonnesRemaining = quotaTonnes - usedTonnes;               // can be negative
      const loadsRemaining = tonnesRemaining / LOAD_TONNES;           // can be negative
      const title =
        t === "starter" ? "Starter" :
        t === "grower"  ? "Grower"  :
        t === "finisher"? "Finisher": "Booster";
      return { key: t, title, tonnesRemaining, loadsRemaining };
    });
  }, [q, deliveredTonnesByType]);

  // color for tonnes remaining
  function tonnesClass(v: number) {
    if (v < 0) return "text-red-600";
    if (v <= 10) return "text-emerald-600";
    return "text-slate-900";
  }

  // ------ Stocktake (single tile) ------
  const shedsSorted = useMemo(
    () => [...(sheds || [])].sort((a, b) => (a?.name || "").localeCompare(b?.name || "")),
    [sheds]
  );
  const firstShedId = shedsSorted[0]?.id ?? "";
  const [stShedId, setStShedId] = useState<string>(firstShedId);
  const [stTonnes, setStTonnes] = useState<number | "">("");

  useEffect(() => {
    if (!stShedId && firstShedId) setStShedId(firstShedId);
    if (stShedId && !shedsSorted.find((s) => s.id === stShedId) && firstShedId) {
      setStShedId(firstShedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstShedId, shedsSorted.length]);

  function addStocktake() {
    const tonnes = stTonnes === "" ? 0 : Math.max(0, Number(stTonnes));
    if (!stShedId || !(tonnes > 0)) return;
    const entry: Stocktake = { id: uuid(), shedId: stShedId, tonnes, dateTime: nowIso() };
    setStocktakes([...(stocktakes || []), entry]);
    setStTonnes("");
  }

  const stocktakeRows = useMemo(() => {
    const list = [...(stocktakes || [])];
    list.sort((a, b) => {
      const aKey = a.dateTime || (a.date ? a.date + "T00:00:00Z" : "");
      const bKey = b.dateTime || (b.date ? b.date + "T00:00:00Z" : "");
      return (bKey || "").localeCompare(aKey || "");
    });
    return list;
  }, [stocktakes]);

  // ------ Add Delivery (exact tonnes + Shed dropdown + Booster option) ------
  const [draftDate, setDraftDate] = useState<string>(todayStr());
  const [draftType, setDraftType] = useState<FeedType>("starter");
  const [draftTonnes, setDraftTonnes] = useState<number | "">("");
  const [draftShedId, setDraftShedId] = useState<string>(firstShedId);

  useEffect(() => {
    if (!draftShedId && firstShedId) setDraftShedId(firstShedId);
    if (draftShedId && !shedsSorted.find((s) => s.id === draftShedId) && firstShedId) {
      setDraftShedId(firstShedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstShedId, shedsSorted.length]);

  function addDelivery() {
    const tonnes = draftTonnes === "" ? 0 : Math.max(0, Number(draftTonnes));
    if (!draftDate || !draftType || !(tonnes > 0)) return;
    const entry: Delivery = { id: uuid(), date: draftDate, type: draftType, tonnes, shedId: draftShedId || undefined };
    setDeliveries([...(deliveries || []), entry]);
    setDraftTonnes("");
  }

  function removeDelivery(id: string) {
    if (!confirm("Remove this delivery?")) return;
    setDeliveries((prev) => (prev || []).filter((d) => d.id !== id));
  }

  // Edit delivery inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<Delivery> | null>(null);

  function startEdit(r: Delivery) {
    setEditingId(r.id);
    setEdit({
      id: r.id,
      date: r.date,
      type: r.type,
      shedId: r.shedId,
      tonnes: deliveryTonnes(r),
    });
  }
  function saveEdit() {
    if (!editingId || !edit) return;
    const tonnes = edit.tonnes == null || edit.tonnes === "" ? 0 : Math.max(0, Number(edit.tonnes));
    if (!(tonnes > 0)) return;
    setDeliveries((prev) =>
      (prev || []).map((d) =>
        d.id === editingId
          ? {
              ...d,
              date: (edit.date as string) || d.date,
              type: (edit.type as FeedType) || d.type,
              shedId: edit.shedId || undefined,
              tonnes,
              loads: undefined,
            }
          : d
      )
    );
    setEditingId(null);
    setEdit(null);
  }
  function cancelEdit() {
    setEditingId(null);
    setEdit(null);
  }

  const deliveryRows = useMemo(
    () => [...(deliveries || [])].sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    [deliveries]
  );

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Feed</h1>

      {!haveAnyQuota ? (
        <div className="card p-4 text-slate-600">
          No feed quotas configured yet. Add quotas in <span className="font-medium">Setup</span>.
        </div>
      ) : (
        <>
          {/* Remaining tiles (Tonnes primary, Loads secondary; hide quota==0) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {remainingSummary.map((r) => (
              <div key={r.key} className="rounded border p-4 bg-white">
                <div className="text-xs text-slate-500">{r.title} Remaining</div>
                <div className={`text-lg font-semibold mt-1 ${tonnesClass(r.tonnesRemaining)}`}>
                  {r.tonnesRemaining.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {Math.round(r.loadsRemaining).toLocaleString()} loads
                </div>
              </div>
            ))}
          </div>

          {/* Two-up layout on desktop: Stocktake (left) + Add Delivery (right) */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Stocktake */}
            <div className="p-4 border rounded-2xl bg-white">
              <div className="font-medium mb-3">Feed Stocktake</div>
              {(shedsSorted || []).length === 0 ? (
                <div className="text-sm text-slate-600">
                  No sheds yet. Add sheds in <span className="font-medium">Setup</span>.
                </div>
              ) : (
                <form
                  className="grid md:grid-cols-6 gap-3 items-end"
                  onSubmit={(e) => { e.preventDefault(); addStocktake(); }}
                >
                  <label className="block md:col-span-4">
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

                  <div className="md:col-span-6">
                    <button type="submit" className="rounded bg-slate-900 text-white px-4 py-2">
                      Save
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Add Delivery */}
            <div className="p-4 border rounded-2xl bg-white">
              <div className="font-medium mb-3">Add Delivery</div>
              <div className="grid md:grid-cols-8 gap-3 items-end">
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
                  <div className="text-sm mb-1">Shed</div>
                  {shedsSorted.length > 0 ? (
                    <select
                      className="w-full border rounded px-3 py-2 bg-white"
                      value={draftShedId || firstShedId}
                      onChange={(e) => setDraftShedId(e.target.value)}
                    >
                      {shedsSorted.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name || `Shed ${String(s.id).slice(0, 4)}`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input className="w-full border rounded px-3 py-2 bg-white text-slate-500" value={"No sheds — add in Setup"} readOnly />
                  )}
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

                <div className="md:col-span-4">
                  <button className="rounded bg-slate-900 text-white px-4 py-2" onClick={addDelivery}>
                    Add
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Remaining quotas update automatically. One load equals <strong>{LOAD_TONNES} tonnes</strong>.
              </p>
            </div>
          </div>

          {/* Deliveries list (with Edit) */}
          <div className="p-4 border rounded-2xl bg-white">
            <div className="font-medium mb-3">Deliveries</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2">Type</th>
                    <th className="py-2 pr-2">Shed</th>
                    <th className="py-2 pr-2">Tonnes</th>
                    <th className="py-2 pr-2">Loads (≈)</th>
                    <th className="py-2 pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryRows.map((r) => {
                    const tonnes = deliveryTonnes(r);
                    const loadsApprox = tonnes / LOAD_TONNES;
                    const shedName =
                      shedsSorted.find((s) => s.id === r.shedId)?.name ||
                      (r.shedId ? `Shed ${String(r.shedId).slice(0, 4)}` : "—");
                    const isEditing = editingId === r.id;
                    return (
                      <tr key={r.id} className="border-b">
                        <td className="py-2 pr-2">
                          {isEditing ? (
                            <input
                              type="date"
                              className="border rounded px-2 py-1"
                              value={(edit?.date as string) ?? r.date}
                              onChange={(e) => setEdit((p) => ({ ...(p || {}), date: e.target.value }))}
                            />
                          ) : (
                            r.date
                          )}
                        </td>
                        <td className="py-2 pr-2 capitalize">
                          {isEditing ? (
                            <select
                              className="border rounded px-2 py-1 bg-white"
                              value={(edit?.type as FeedType) ?? r.type}
                              onChange={(e) => setEdit((p) => ({ ...(p || {}), type: e.target.value as FeedType }))}
                            >
                              <option value="starter">Starter</option>
                              <option value="grower">Grower</option>
                              <option value="finisher">Finisher</option>
                              <option value="booster">Booster</option>
                            </select>
                          ) : (
                            r.type
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          {isEditing ? (
                            <select
                              className="border rounded px-2 py-1 bg-white"
                              value={(edit?.shedId as string) ?? r.shedId ?? ""}
                              onChange={(e) => setEdit((p) => ({ ...(p || {}), shedId: e.target.value }))}
                            >
                              <option value="">—</option>
                              {shedsSorted.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name || `Shed ${String(s.id).slice(0, 4)}`}
                                </option>
                              ))}
                            </select>
                          ) : (
                            shedName
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.1"
                              min={0}
                              className="border rounded px-2 py-1"
                              value={
                                edit?.tonnes === "" ? "" : (edit?.tonnes as number | undefined) ?? tonnes
                              }
                              onChange={(e) => {
                                const v = e.target.value;
                                setEdit((p) => ({
                                  ...(p || {}),
                                  tonnes: v === "" ? "" : Math.max(0, Number(v)),
                                }));
                              }}
                            />
                          ) : (
                            <>
                              {tonnes.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t
                            </>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          {loadsApprox.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        </td>
                        <td className="py-2 pr-2">
                          {isEditing ? (
                            <div className="flex gap-2">
                              <button className="px-2 py-1 border rounded" onClick={saveEdit}>
                                Save
                              </button>
                              <button className="px-2 py-1 border rounded" onClick={cancelEdit}>
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button className="px-2 py-1 border rounded" onClick={() => startEdit(r)}>
                                Edit
                              </button>
                              <button className="px-2 py-1 border rounded text-red-600" onClick={() => removeDelivery(r.id)}>
                                Remove
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {deliveryRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-slate-500">No deliveries yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Stocktake History at bottom */}
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
                    const shedName =
                      shedsSorted.find((s) => s.id === st.shedId)?.name ||
                      `Shed ${String(st.shedId).slice(0, 4)}`;
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
                      <td colSpan={4} className="py-6 text-slate-500">No stocktakes yet.</td>
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
