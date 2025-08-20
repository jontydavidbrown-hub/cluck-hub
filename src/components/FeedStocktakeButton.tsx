// src/components/FeedStocktakeButton.tsx
import { useMemo, useState } from "react";
import { useCloudSlice } from "../lib/cloudSlice";

type Shed = { id: string; name: string };

export default function FeedStocktakeButton() {
  const [sheds] = useCloudSlice<Shed[]>("sheds", []);
  const shedOptions = useMemo(
    () => (sheds || []).map((s) => ({ id: s.id, name: s.name || "—" })),
    [sheds]
  );

  const [open, setOpen] = useState(false);
  const [shedId, setShedId] = useState<string>("");
  const [kgRemaining, setKgRemaining] = useState<string>("");

  function reset() {
    setShedId("");
    setKgRemaining("");
  }

  function onSave() {
    const shed = shedOptions.find((s) => s.id === shedId);
    const kg = Number(kgRemaining);
    if (!shed || !isFinite(kg) || kg < 0) {
      alert("Please pick a shed and enter a valid non-negative kg amount.");
      return;
    }
    window.dispatchEvent(
      new CustomEvent("feed-stocktake", {
        detail: {
          shedId: shed.id,
          shedName: shed.name,
          kgRemaining: kg,
          date: new Date().toISOString().slice(0, 10),
        },
      })
    );
    setOpen(false);
    reset();
  }

  return (
    <>
      <button
        type="button"
        className="px-3 py-2 rounded border hover:bg-slate-50 focus:outline-none focus:ring focus:ring-slate-300 pointer-events-auto"
        style={{ pointerEvents: "auto" }}
        onClick={() => setOpen(true)}
      >
        Feed Stocktake
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center"
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setOpen(false);
              reset();
            }}
          />
          {/* Modal */}
          <div className="relative z-[1001] w-[95%] max-w-md rounded border bg-white p-4 shadow-lg">
            <div className="mb-3 text-lg font-semibold">Feed Stocktake</div>

            <label className="block text-sm text-slate-600 mb-1">Shed</label>
            <select
              className="mb-3 w-full rounded border p-2"
              value={shedId}
              onChange={(e) => setShedId(e.target.value)}
            >
              <option value="">Select shed…</option>
              {shedOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <label className="block text-sm text-slate-600 mb-1">
              Feed remaining (kg)
            </label>
            <input
              type="number"
              inputMode="decimal"
              className="mb-4 w-full rounded border p-2"
              placeholder="e.g. 1250"
              value={kgRemaining}
              onChange={(e) => setKgRemaining(e.target.value)}
              min={0}
              step="0.1"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1 rounded border hover:bg-slate-50"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1 rounded border bg-slate-900 text-white hover:opacity-90"
                onClick={onSave}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
