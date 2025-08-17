import { useEffect, useMemo, useRef, useState } from "react";
import { useCloudSlice } from "../lib/cloudSlice";
import { useSearchParams } from "react-router-dom";
import { pdfWeightsSession } from "../lib/pdfWeights";

type Shed = {
  id: string;
  name: string;
  placementDate?: string;
  placementBirds?: number;
  birdsPlaced?: number;
};

type Bucket = { id: string; weightKg?: number };
type WeightSession = {
  id: string;
  date: string;          // YYYY-MM-DD
  shed: string;          // shed name
  birdsPerBucket: number;
  buckets: Bucket[];
  // future: notes?
};

function newSession(date: string, shed: string): WeightSession {
  return {
    id: crypto.randomUUID(),
    date,
    shed,
    birdsPerBucket: 0,
    buckets: [{ id: crypto.randomUUID(), weightKg: undefined }],
  };
}

function clampNonNeg(n: any) {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

export default function Weights() {
  const [sheds] = useCloudSlice<Shed[]>("sheds", []);
  const [sessions, setSessions] = useCloudSlice<WeightSession[]>("weights", []);
  const [search] = useSearchParams();
  const preselectShed = search.get("shed") || "";

  // --- Draft header (date + shed) preserved exactly as before ---
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [shed, setShed] = useState<string>("");

  // Keep shed names for datalist
  const shedNames = useMemo(
    () => (sheds || []).map(s => s.name || "").filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [sheds]
  );

  // Apply URL-preselected shed once if not set yet
  useEffect(() => {
    if (preselectShed && !shed) setShed(preselectShed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectShed]);

  // Locate or create the session for (date, shed)
  const sessionIndex = useMemo(() => {
    return (sessions || []).findIndex(s => s.date === date && (s.shed || "") === (shed || ""));
  }, [sessions, date, shed]);

  const session = useMemo<WeightSession>(() => {
    if (sessionIndex >= 0) return sessions![sessionIndex];
    // not found yet — create an ephemeral one so UI shows immediately
    return newSession(date, shed);
  }, [sessions, sessionIndex, date, shed]);

  // Persist the ephemeral session when we first type anything
  function upsertSession(mutator: (s: WeightSession) => WeightSession) {
    setSessions(prev => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const idx = list.findIndex(s => s.date === date && (s.shed || "") === (shed || ""));
      if (idx >= 0) {
        list[idx] = mutator(list[idx]);
      } else {
        list.push(mutator(newSession(date, shed)));
      }
      return list;
    });
  }

  // Birds per bucket slider (0-20)
  function setBirdsPerBucket(next: number) {
    upsertSession(s => ({ ...s, birdsPerBucket: Math.max(0, Math.min(20, Math.floor(next))) }));
  }

  // --- Bucket editing ---
  const inputsRef = useRef<Map<string, HTMLInputElement | null>>(new Map());

  function setBucketWeight(bucketId: string, val: string) {
    upsertSession(s => ({
      ...s,
      buckets: s.buckets.map(b => (b.id === bucketId ? { ...b, weightKg: val === "" ? undefined : clampNonNeg(val) } : b)),
    }));
  }

  function addBucket(afterId?: string) {
    const newB: Bucket = { id: crypto.randomUUID(), weightKg: undefined };
    upsertSession(s => {
      const pos = afterId ? s.buckets.findIndex(b => b.id === afterId) : -1;
      const buckets = [...s.buckets];
      if (pos >= 0) buckets.splice(pos + 1, 0, newB);
      else buckets.push(newB);
      return { ...s, buckets };
    });
    // Focus next in the next tick
    setTimeout(() => {
      const el = inputsRef.current.get(newB.id);
      el?.focus();
    }, 0);
  }

  function removeBucket(bucketId: string) {
    upsertSession(s => {
      const buckets = s.buckets.filter(b => b.id !== bucketId);
      return { ...s, buckets: buckets.length ? buckets : [{ id: crypto.randomUUID(), weightKg: undefined }] };
    });
  }

  // --- Calculations ---
  const metrics = useMemo(() => {
    const bpb = clampNonNeg(session.birdsPerBucket);
    const weights = session.buckets.map(b => Number(b.weightKg) || 0).filter(n => n > 0);
    const totalBuckets = weights.length;
    const totalBirds = bpb * totalBuckets;
    const totalWeightKg = weights.reduce((a, n) => a + n, 0);
    const avgPerBirdKg = totalBirds > 0 ? totalWeightKg / totalBirds : 0;
    return { bpb, totalBuckets, totalBirds, totalWeightKg, avgPerBirdKg };
  }, [session]);

  async function exportPdf() {
    await pdfWeightsSession(session, { farmSheds: sheds });
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Weights</h1>

      {/* Header inputs (unchanged Date & Shed) */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm mb-1">Date</label>
            <input
              type="date"
              className="w-full border rounded px-2 py-1"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Shed</label>
            <input
              list="shed-list"
              className="w-full border rounded px-2 py-1"
              placeholder="e.g., Shed 1"
              value={shed}
              onChange={(e) => setShed(e.target.value)}
            />
            <datalist id="shed-list">
              {shedNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>

          {/* Birds per bucket slider */}
          <div>
            <label className="block text-sm mb-1">Birds Per Bucket</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={session.birdsPerBucket || 0}
                onChange={(e) => setBirdsPerBucket(Number(e.target.value))}
                className="w-full"
              />
              <div className="w-10 text-right text-sm font-medium">{session.birdsPerBucket || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Live tiles */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded border p-4 bg-white">
          <div className="text-xs text-slate-500">Total Birds</div>
          <div className="text-2xl font-semibold">{metrics.totalBirds}</div>
        </div>
        <div className="rounded border p-4 bg-white">
          <div className="text-xs text-slate-500">Average Weight</div>
          <div className="text-2xl font-semibold">
            {metrics.avgPerBirdKg > 0 ? `${metrics.avgPerBirdKg.toFixed(3)} kg/bird` : "—"}
          </div>
        </div>
      </div>

      {/* Buckets editor */}
      <div className="p-4 border rounded-2xl bg-white space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-medium">Bucket Weights</div>
          <div className="flex gap-2">
            <button className="px-3 py-1 border rounded" onClick={() => addBucket()}>
              Add Bucket
            </button>
            <button className="px-3 py-1 border rounded" onClick={exportPdf}>
              Export PDF
            </button>
          </div>
        </div>

        <div className="grid gap-2">
          {session.buckets.map((b, idx) => (
            <div key={b.id} className="flex items-center gap-3">
              <div className="w-16 text-sm text-slate-500">#{idx + 1}</div>
              <input
                ref={(el) => inputsRef.current.set(b.id, el)}
                type="number"
                min={0}
                step="0.001"
                placeholder="kg"
                className="border rounded px-3 py-2 flex-1"
                value={b.weightKg === undefined ? "" : b.weightKg}
                onChange={(e) => setBucketWeight(b.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    // if current bucket has a value, create next
                    const hasValue = (e.currentTarget.value || "").trim() !== "";
                    if (hasValue) addBucket(b.id);
                  }
                }}
              />
              <button className="px-2 py-1 border rounded text-red-600" onClick={() => removeBucket(b.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Breakdown */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="font-medium mb-3">Breakdown</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">Bucket #</th>
                <th className="py-2 pr-2">Weight (kg)</th>
                <th className="py-2 pr-2">Birds</th>
                <th className="py-2 pr-2">Avg (kg/bird)</th>
              </tr>
            </thead>
            <tbody>
              {session.buckets.map((b, i) => {
                const w = Number(b.weightKg) || 0;
                const birds = metrics.bpb;
                const avg = birds > 0 && w > 0 ? w / birds : 0;
                return (
                  <tr key={b.id} className="border-b">
                    <td className="py-2 pr-2">{i + 1}</td>
                    <td className="py-2 pr-2">{w > 0 ? w.toFixed(3) : "—"}</td>
                    <td className="py-2 pr-2">{birds}</td>
                    <td className="py-2 pr-2">{avg > 0 ? avg.toFixed(3) : "—"}</td>
                  </tr>
                );
              })}
              {session.buckets.length === 0 && (
                <tr>
                  <td className="py-6 text-gray-500" colSpan={4}>
                    No buckets yet.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="font-medium">
                <td className="py-2 pr-2" colSpan={2}>
                  Totals
                </td>
                <td className="py-2 pr-2">{metrics.totalBirds}</td>
                <td className="py-2 pr-2">
                  {metrics.avgPerBirdKg > 0 ? metrics.avgPerBirdKg.toFixed(3) : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
