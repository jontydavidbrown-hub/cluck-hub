import { useEffect, useMemo, useRef, useState } from "react";
import { useServerState } from "../lib/serverState";
import { generateWeightsPdf } from "../lib/pdf";

type Shed = { id: string; name: string };
type ShedWeights = {
  shed: string;
  birdsPerBucket: number;
  buckets: number[];     // kg per bucket
  notes?: string;
  createdAt: string;     // ISO
};
type WeightsByShed = Record<string, ShedWeights[]>;

const SHEDS_KEY = "sheds";
const WEIGHTS_KEY = "weightsByShed";

function loadFromLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function saveToLS<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function SectionCard({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function Weights() {
  // keep a hook into server state (unchanged behavior) even though this slice uses LS
  const server = useServerState() as any;

  // Sheds and weights
  const [sheds, setSheds] = useState<Shed[]>([]);
  const [byShed, setByShed] = useState<WeightsByShed>({});

  // Form state
  const [shedId, setShedId] = useState<string>("");
  const [birdsPerBucket, setBirdsPerBucket] = useState<number>(0);
  const [bucketKg, setBucketKg] = useState<string>(""); // input field
  const [buckets, setBuckets] = useState<number[]>([]);
  const [notes, setNotes] = useState<string>("");
  const bucketInputRef = useRef<HTMLInputElement>(null);

  // Initial load
  useEffect(() => {
    setSheds(loadFromLS<Shed[]>(SHEDS_KEY, server?.sheds ?? []));
    setByShed(loadFromLS<WeightsByShed>(WEIGHTS_KEY, server?.weightsByShed ?? {}));
  }, [server?.sheds, server?.weightsByShed]);

  // Ensure a shed is selected
  useEffect(() => {
    if (!shedId && sheds.length) setShedId(sheds[0].id);
  }, [shedId, sheds]);

  // Derived stats
  const flatAll = useMemo(() => Object.values(byShed).flat(), [byShed]);
  const totalBuckets = flatAll.reduce((acc, rec) => acc + rec.buckets.length, 0);
  const totalKg = flatAll.reduce((acc, rec) => acc + rec.buckets.reduce((a, b) => a + b, 0), 0);
  const totalBirds = flatAll.reduce((acc, rec) => acc + rec.birdsPerBucket * rec.buckets.length, 0);
  const avgPerBird = totalBirds ? (totalKg / totalBirds) : 0;

  function addBucket() {
    const val = parseFloat(bucketKg);
    if (!isFinite(val) || val <= 0) return;
    setBuckets((b) => [...b, Number(val.toFixed(2))]);
    setBucketKg("");
    bucketInputRef.current?.focus();
  }
  function removeBucket(i: number) {
    setBuckets((b) => b.filter((_, idx) => idx !== i));
  }
  function resetForm() {
    setBuckets([]);
    setBucketKg("");
    setNotes("");
  }
  function saveRecord() {
    if (!shedId) return;
    if (!birdsPerBucket || birdsPerBucket <= 0) return;
    if (buckets.length === 0) return;
    const entry: ShedWeights = {
      shed: shedId,
      birdsPerBucket,
      buckets: [...buckets],
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    const next = { ...(byShed || {}) };
    if (!next[shedId]) next[shedId] = [];
    next[shedId] = [entry, ...next[shedId]];
    setByShed(next);
    saveToLS(WEIGHTS_KEY, next);
    resetForm();
  }
  function deleteRecord(shed: string, idx: number) {
    const list = [...(byShed[shed] || [])];
    list.splice(idx, 1);
    const next = { ...byShed, [shed]: list };
    setByShed(next);
    saveToLS(WEIGHTS_KEY, next);
  }

  function exportPdf() {
    try {
      generateWeightsPdf(byShed);
    } catch (e) {
      console.error("PDF export failed", e);
      alert("Failed to generate PDF.");
    }
  }

  return (
    <div className="weights-page animate-fade-slide">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Weights</h1>
          <p className="text-sm text-slate-600">Record bucket weights and compute average bird weights per shed.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportPdf}
            className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-sm shadow-sm transition"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Total buckets" value={totalBuckets} />
        <Stat label="Total kg" value={totalKg.toFixed(1)} sub="All sheds" />
        <Stat label="Total birds" value={totalBirds} />
        <Stat label="Avg kg / bird" value={avgPerBird ? avgPerBird.toFixed(3) : "0.000"} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Form */}
        <SectionCard
          title="Add weights"
          actions={
            <button
              onClick={resetForm}
              className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-sm shadow-sm transition"
            >
              Reset
            </button>
          }
        >
          <div className="grid grid-cols-1 gap-4">
            <label className="block">
              <div className="text-xs font-medium mb-1 text-slate-700">Shed</div>
              <select
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
                value={shedId}
                onChange={(e) => setShedId(e.target.value)}
              >
                {sheds.map((s) => (
                  <option key={s.id} value={s.id}>{s.name || s.id}</option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="text-xs font-medium mb-1 text-slate-700">Birds per bucket</div>
                <input
                  type="number"
                  min={1}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
                  value={birdsPerBucket || ""}
                  onChange={(e) => setBirdsPerBucket(Number(e.target.value))}
                  placeholder="e.g. 10"
                />
              </label>

              <label className="block">
                <div className="text-xs font-medium mb-1 text-slate-700">Add bucket (kg)</div>
                <div className="flex gap-2">
                  <input
                    ref={bucketInputRef}
                    type="number"
                    step="0.01"
                    min={0}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
                    value={bucketKg}
                    onChange={(e) => setBucketKg(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addBucket(); }}
                    placeholder="e.g. 12.50"
                  />
                  <button
                    type="button"
                    onClick={addBucket}
                    className="rounded-lg bg-slate-900 text-white px-4 py-2 shadow-sm hover:opacity-95 transition"
                  >
                    Add
                  </button>
                </div>
              </label>
            </div>

            {buckets.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm">
                <div className="text-xs font-medium text-slate-700 mb-2">Current buckets</div>
                <div className="flex flex-wrap gap-2">
                  {buckets.map((kg, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm"
                    >
                      {kg.toFixed(2)} kg
                      <button
                        className="text-slate-500 hover:text-red-600 transition"
                        onClick={() => removeBucket(i)}
                        aria-label="Remove bucket"
                        title="Remove"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <label className="block">
              <div className="text-xs font-medium mb-1 text-slate-700">Notes (optional)</div>
              <textarea
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm min-h-24"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any details to remember…"
              />
            </label>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={saveRecord}
                className="rounded-xl bg-emerald-600 text-white px-4 py-2 shadow-sm hover:opacity-95 transition disabled:opacity-50"
                disabled={!shedId || !birdsPerBucket || buckets.length === 0}
              >
                Save record
              </button>
            </div>
          </div>
        </SectionCard>

        {/* Per-shed tables */}
        <div className="lg:col-span-2 space-y-6">
          {sheds.map((shed) => {
            const list = (byShed[shed.id] || []);
            const shedKg = list.reduce((a, rec) => a + rec.buckets.reduce((x, y) => x + y, 0), 0);
            const shedBuckets = list.reduce((a, rec) => a + rec.buckets.length, 0);
            const shedBirds = list.reduce((a, rec) => a + (rec.birdsPerBucket * rec.buckets.length), 0);
            const shedAvg = shedBirds ? (shedKg / shedBirds) : 0;

            return (
              <SectionCard
                key={shed.id}
                title={shed.name || shed.id}
                actions={
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="px-2 py-1 rounded-full border border-slate-200 bg-white shadow-sm">Buckets: {shedBuckets}</span>
                    <span className="px-2 py-1 rounded-full border border-slate-200 bg-white shadow-sm">Kg: {shedKg.toFixed(1)}</span>
                    <span className="px-2 py-1 rounded-full border border-slate-200 bg-white shadow-sm">Avg kg/bird: {shedAvg.toFixed(3)}</span>
                  </div>
                }
              >
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-slate-600">
                      <tr className="border-b border-slate-200">
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2 px-3">Birds / bucket</th>
                        <th className="py-2 px-3">Buckets (kg)</th>
                        <th className="py-2 px-3">Avg kg / bird</th>
                        <th className="py-2 pl-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((rec, idx) => {
                        const kg = rec.buckets.reduce((a, b) => a + b, 0);
                        const birds = rec.birdsPerBucket * rec.buckets.length;
                        const avg = birds ? kg / birds : 0;
                        const date = new Date(rec.createdAt).toLocaleString();
                        return (
                          <tr key={idx} className="border-b last:border-0 border-slate-100 hover:bg-slate-50/60">
                            <td className="py-2 pr-3 whitespace-nowrap">{date}</td>
                            <td className="py-2 px-3">{rec.birdsPerBucket}</td>
                            <td className="py-2 px-3">
                              <div className="flex flex-wrap gap-1">
                                {rec.buckets.map((b, i) => (
                                  <span key={i} className="inline-block rounded-full px-2 py-0.5 border border-slate-200 bg-white shadow-sm">
                                    {b.toFixed(2)}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-2 px-3">{avg.toFixed(3)}</td>
                            <td className="py-2 pl-3 text-right">
                              <button
                                className="text-xs rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 px-2 py-1 transition"
                                onClick={() => deleteRecord(shed.id, idx)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {!list.length && (
                        <tr><td className="p-6 text-slate-500" colSpan={5}>No records.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            );
          })}

          {!Object.keys(byShed || {}).length && (
            <div className="text-slate-500">No weight records yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
