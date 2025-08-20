// src/components/FeedStocktakeButton.tsx
import { useMemo, useState } from "react";
import { useCloudSlice } from "../lib/cloudSlice";

type FeedType = "Starter" | "Grower" | "Finisher";
type SiloRow = { id: string; name: string; type: FeedType; capacityT?: number; levelT?: number; notes?: string };

// New-shape stocktake we write into feedStocktakes
type ShedEntry = { shed: string; tons: number };
type NewStocktake = {
  id: string;
  date: string;        // yyyy-mm-dd
  feedType: FeedType;  // derived from the selected shed's silo.type
  totalTons: number;   // sum of sheds[].tons
  sheds: ShedEntry[];  // we merge multiple sheds for the same day+type here
};

// For backward compatibility (in case older records exist)
type OldStocktake = {
  id?: string;
  date: string;
  starterT?: number;
  growerT?: number;
  finisherT?: number;
};

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

export default function FeedStocktakeButton() {
  // Silos (used to populate the shed dropdown)
  const [silos] = useCloudSlice<SiloRow[]>("feedSilos", []);
  // Stocktakes (we’ll append/merge here)
  const [stocktakes, setStocktakes] = useCloudSlice<Array<NewStocktake | OldStocktake>>("feedStocktakes", []);

  const [open, setOpen] = useState(false);
  const [shedId, setShedId] = useState<string>("");
  const [tons, setTons] = useState<string>("");

  const sortedSilos = useMemo(
    () => [...(silos || [])].sort((a, b) => a.name.localeCompare(b.name)),
    [silos]
  );

  const selectedShed = useMemo(
    () => sortedSilos.find(s => s.id === shedId) || null,
    [sortedSilos, shedId]
  );

  const canOpen = (sortedSilos || []).length > 0;

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
          sheds: Array.isArray(n.sheds) ? n.sheds.map(s => ({ shed: String(s.shed || ""), tons: clampNum(s.tons) })) : [],
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

    // Normalize existing records to new shape
    const existingNew = normalizeAllNewShape(stocktakes);
    const idx = existingNew.findIndex(st => st.date === today && st.feedType === feedType);

    if (idx >= 0) {
      // Merge into existing same-day, same-type record
      const copy = [...existingNew];
      const st = { ...copy[idx] };
      const sheds = Array.isArray(st.sheds) ? [...st.sheds] : [];
      const sIdx = sheds.findIndex(s => s.shed === shedName);
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
      // Create a new record with just this shed
      const st: NewStocktake = {
        id: newId(),
        date: today,
        feedType,
        totalTons: value,
        sheds: [{ shed: shedName, tons: value }],
      };
      setStocktakes(prev => [...(normalizeAllNewShape(prev || [])), st]);
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

      {/* Lightbox */}
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
