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

function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function Weights() {
  const { state: shedsRaw } = useServerState<any>(SHEDS_KEY, []);
  const shedNames = useMemo<string[]>(() => {
    if (!Array.isArray(shedsRaw)) return [];
    return shedsRaw.map((x: any) => (typeof x === "string" ? x : x?.name)).filter(Boolean);
  }, [shedsRaw]);

  const { state: byShed, setState: setByShed, loading, synced } =
    useServerState<WeightsByShed>(WEIGHTS_KEY, {});

  const [shed, setShed] = useState<string>("");
  const [birdsPerBucket, setBirdsPerBucket] = useState<number>(10);
  const [buckets, setBuckets] = useState<Array<number | null>>([]);
  const [notes, setNotes] = useState<string>("");

  const dateRef = useRef<HTMLInputElement | null>(null);

  // Preselect shed from ?shed=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const target = params.get("shed");
    if (target && shedNames.includes(target)) {
      setShed(target);
    } else if (!shed && shedNames.length) {
      setShed(shedNames[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shedNames.join("|")]);

  function addBucket() { setBuckets([...buckets, null]); }
  function setBucket(i: number, v: number | null) {
    const next = buckets.slice(); next[i] = v; setBuckets(next);
  }
  function removeBucket(i: number) {
    const next = buckets.slice(); next.splice(i, 1); setBuckets(next);
  }

  function addRecord() {
    if (!shed || !birdsPerBucket || buckets.length === 0) return;
    const kgBuckets: number[] = buckets.map((b) => Number(b || 0));
    const rec: ShedWeights = {
      shed,
      birdsPerBucket: Number(birdsPerBucket || 0),
      buckets: kgBuckets,
      notes: notes || "",
      createdAt: new Date().toISOString(),
    };
    const next = { ...(byShed || {}) };
    const arr = next[shed] || [];
    next[shed] = [...arr, rec];
    setByShed(next);
    setBuckets([]); setNotes("");
    if (dateRef.current) dateRef.current.value = todayISO();
  }

  const flat = useMemo(() => {
    const arr: Array<ShedWeights & { index: number }> = [];
    for (const s of Object.keys(byShed || {})) {
      (byShed[s] || []).forEach((r, i) => arr.push({ ...r, index: i }));
    }
    return arr.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  }, [byShed]);

  function removeRecord(s: string, i: number) {
    const next = { ...(byShed || {}) };
    next[s] = (next[s] || []).slice();
    next[s].splice(i, 1);
    setByShed(next);
  }

  const currentStats = useMemo(() => {
    const totalKg = buckets.reduce((a, b) => a + Number(b || 0), 0);
    const totalBirds = buckets.length * birdsPerBucket;
    const avgPerBird = totalBirds ? (totalKg * 1000) / totalBirds : 0;
    return { totalKg, totalBirds, avgPerBird };
  }, [buckets, birdsPerBucket]);

  function exportPdf() {
    generateWeightsPdf(byShed || {});
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Weights</h1>
        {!loading && (
          <span className={`text-xs px-2 py-1 rounded border ${synced ? "text-green-700 border-green-200 bg-green-50" : "text-amber-700 border-amber-200 bg-amber-50"}`}>
            {synced ? "Synced" : "Saving…"}
          </span>
        )}
      </header>

      {/* Input row */}
      <div className="grid gap-3 md:grid-cols-6 bg-white p-4 border rounded-xl">
        <select value={shed} onChange={(e) => setShed(e.target.value)} className="border rounded p-2">
          {shedNames.length === 0 && <option value="">No sheds</option>}
          {shedNames.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input ref={dateRef} type="date" defaultValue={todayISO()} className="border rounded p-2" />
        <input
          placeholder="Birds per bucket"
          type="number"
          value={birdsPerBucket}
          onChange={(e) => setBirdsPerBucket(Number(e.target.value || 0))}
          className="border rounded p-2"
        />
        <div className="md:col-span-2 flex items-center gap-2">
          <button onClick={addBucket} className="rounded-lg bg-slate-900 text-white px-3 py-2">Add bucket</button>
          <button onClick={exportPdf} className="rounded-lg border px-3 py-2">Export PDF</button>
        </div>
        <input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="border rounded p-2 md:col-span-6"
        />
      </div>

      {/* Buckets list (kg) */}
      <div className="bg-white border rounded-xl p-4">
        <div className="grid gap-3 md:grid-cols-6">
          {buckets.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                placeholder={`Bucket ${i + 1} (kg)`}
                value={b ?? ""}
                onChange={(e) => setBucket(i, e.target.value === "" ? null : Number(e.target.value))}
                className="border rounded p-2 w-full"
              />
              <button aria-label="remove bucket" onClick={() => removeBucket(i)} className="text-red-600">✕</button>
            </div>
          ))}
          {!buckets.length && <div className="text-slate-500">No buckets yet. Add some above.</div>}
        </div>
        <div className="mt-4 text-sm text-slate-600">
          <b>Total kg:</b> {currentStats.totalKg.toFixed(2)} · <b>Avg per bird (g):</b> {Math.round(currentStats.avgPerBird)}
        </div>
      </div>

      {/* Records by shed/date */}
      <div className="space-y-4">
        {Object.keys(byShed || {}).map((s) => (
          <div key={s} className="bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b font-semibold">{s}</div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="text-left">
                  <tr>
                    <th className="p-3 border-b">Created</th>
                    <th className="p-3 border-b">Birds/bucket</th>
                    <th className="p-3 border-b">Buckets (kg)</th>
                    <th className="p-3 border-b">Notes</th>
                    <th className="p-3 border-b"></th>
                  </tr>
                </thead>
                <tbody>
                  {(byShed[s] || []).map((r, i) => (
                    <tr key={i} className="border-b last:border-none">
                      <td className="p-3">{new Date(r.createdAt).toLocaleString()}</td>
                      <td className="p-3">{r.birdsPerBucket}</td>
                      <td className="p-3">{r.buckets.map((x) => x.toFixed(2)).join(", ")}</td>
                      <td className="p-3">{r.notes || "-"}</td>
                      <td className="p-3 text-right">
                        <button onClick={() => removeRecord(s, i)} className="text-red-600 hover:underline">remove</button>
                      </td>
                    </tr>
                  ))}
                  {!(byShed[s] || []).length && (
                    <tr><td className="p-6 text-slate-500" colSpan={5}>No records.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {!Object.keys(byShed || {}).length && <div className="text-slate-500">No weight records yet.</div>}
      </div>
    </div>
  );
}
