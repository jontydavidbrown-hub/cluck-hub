import { useEffect, useMemo, useRef, useState } from "react";
import { getJSON, setJSON, nowIso } from "../lib/storage";
import { generateWeightsPdf } from "../lib/pdf";

type ShedWeights = {
  shed: string;
  birdsPerBucket: number;
  buckets: number[]; // kg per bucket
  notes?: string;
  createdAt: string; // ISO
};

type WeightsByShed = Record<string, ShedWeights[]>;

const SHEDS_KEY = "sheds";
const WEIGHTS_KEY = "weightsByShed";

export default function Weights() {
  const sheds = getJSON<string[]>(SHEDS_KEY, []);
  const [shed, setShed] = useState(sheds[0] || "");
  const [birdsPerBucket, setBirdsPerBucket] = useState<number>(10);
  // store possibly-empty numbers as (number | null)
  const [buckets, setBuckets] = useState<Array<number | null>>([]);
  const [notes, setNotes] = useState("");

  // refs for inputs to manage focus when adding via Enter
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!shed && sheds.length) setShed(sheds[0]);
  }, [sheds, shed]);

  const totals = useMemo(() => {
    const clean = buckets.map((b) => (typeof b === "number" && !isNaN(b) ? b : 0));
    const totalKg = clean.reduce((a, b) => a + b, 0);
    const totalBirds = (birdsPerBucket || 0) * (clean.length || 0);
    const avg = totalBirds ? totalKg / totalBirds : 0;
    return { totalKg, totalBirds, avg };
  }, [buckets, birdsPerBucket]);

  function addBucket(value?: number | null) {
    setBuckets((prev) => [...prev, value ?? null]);
    // focus the newly added input on next tick
    requestAnimationFrame(() => {
      const idx = buckets.length; // new index
      inputRefs.current[idx]?.focus();
      inputRefs.current[idx]?.select();
    });
  }
  function updateBucket(i: number, vStr: string) {
    const v = vStr === "" ? null : Number(vStr);
    setBuckets((prev) => prev.map((x, idx) => (idx === i ? (isNaN(v as number) ? null : v) : x)));
  }
  function deleteBucket(i: number) {
    setBuckets((prev) => prev.filter((_, idx) => idx !== i));
    // tidy refs
    inputRefs.current.splice(i, 1);
  }
  function clearAll() {
    setBuckets([]);
    setNotes("");
  }

  function saveEntry() {
    if (!shed) return;
    const cleanBuckets = buckets.map((b) => (typeof b === "number" && !isNaN(b) ? b : 0));
    const rec: ShedWeights = {
      shed,
      birdsPerBucket,
      buckets: cleanBuckets,
      notes,
      createdAt: nowIso(),
    };
    const db = getJSON<WeightsByShed>(WEIGHTS_KEY, {});
    db[shed] = [...(db[shed] || []), rec];
    setJSON(WEIGHTS_KEY, db);
  }

  function exportPdf() {
    if (!shed) return;
    const cleanBuckets = buckets.map((b) => (typeof b === "number" && !isNaN(b) ? b : 0));
    generateWeightsPdf({
      shed,
      birdsPerBucket,
      buckets: cleanBuckets,
      notes,
      createdAt: nowIso(),
    });
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Weights</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Shed</label>
          <select
            value={shed}
            onChange={(e) => setShed(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          >
            {sheds.length === 0 && <option value="">No sheds configured</option>}
            {sheds.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Birds per bucket</label>
          <input
            type="number"
            min={0}
            value={birdsPerBucket}
            onChange={(e) => setBirdsPerBucket(parseInt(e.target.value || "0"))}
            className="border rounded px-3 py-2 w-full"
            placeholder="e.g. 10"
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => addBucket()}
            className="border rounded px-3 py-2 w-full"
          >
            + Add bucket
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="border rounded px-3 py-2"
            title="Clear inputs"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm text-gray-600">Enter each bucket's total weight (kg):</div>
        <div className="space-y-2">
          {buckets.map((kg, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                ref={(el) => (inputRefs.current[i] = el)}
                type="number"
                step="0.001"
                value={kg ?? ""}
                placeholder="kg"
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => updateBucket(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const last = i === buckets.length - 1;
                    if (last) {
                      addBucket();
                    } else {
                      inputRefs.current[i + 1]?.focus();
                      inputRefs.current[i + 1]?.select();
                    }
                  }
                }}
                className="border rounded px-3 py-2 w-full"
              />
              <button
                className="border rounded px-2 py-2"
                onClick={() => deleteBucket(i)}
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 border rounded">
          <div className="text-sm text-gray-600">Total buckets</div>
          <div className="text-xl font-semibold">{buckets.length}</div>
        </div>
        <div className="p-3 border rounded">
          <div className="text-sm text-gray-600">Total kg</div>
          <div className="text-xl font-semibold">{totals.totalKg.toFixed(3)}</div>
        </div>
        <div className="p-3 border rounded">
          <div className="text-sm text-gray-600">Avg / bird (kg)</div>
          <div className="text-xl font-semibold">
            {totals.totalBirds ? totals.avg.toFixed(4) : "-"}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Notes (optional)</label>
        <textarea
          className="border rounded px-3 py-2 w-full"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything notable about this weighing session…"
          onFocus={(e) => e.currentTarget.select()}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="bg-black text-white rounded px-4 py-2"
          onClick={exportPdf}
        >
          Export PDF
        </button>
        <button
          type="button"
          className="border rounded px-4 py-2"
          onClick={saveEntry}
        >
          Save entry
        </button>
      </div>
    </div>
  );
}
