// src/components/FeedStocktakeSection.tsx
import { useMemo, useState } from "react";
import { useCloudSlice } from "../lib/cloudSlice";

type Shed = { id: string; name: string };

export default function FeedStocktakeSection() {
  const [sheds] = useCloudSlice<Shed[]>("sheds", []);
  const shedList = useMemo(
    () => (sheds || []).slice().sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [sheds]
  );

  // Local UI state: shedId -> text input (kg)
  const [entry, setEntry] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  function onSave(shedId: string, shedName: string) {
    const text = (entry[shedId] ?? "").trim();
    const kg = Number(text);
    if (!isFinite(kg) || kg < 0) {
      alert("Please enter a valid non-negative kg amount.");
      return;
    }
    setSaving((m) => ({ ...m, [shedId]: true }));

    // Emit event for your app to persist (replace with your own save call if you like)
    window.dispatchEvent(
      new CustomEvent("feed-stocktake", {
        detail: {
          shedId,
          shedName,
          kgRemaining: kg,
          date: new Date().toISOString().slice(0, 10),
        },
      })
    );

    setTimeout(() => {
      setSaving((m) => ({ ...m, [shedId]: false }));
      setEntry((m) => ({ ...m, [shedId]: "" }));
    }, 250);
  }

  if (shedList.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Stocktake</h2>
        <div className="card p-6 text-slate-600">No sheds available.</div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Stocktake</h2>
      <p className="text-slate-600 text-sm">
        Enter the actual feed remaining (<span className="font-medium">kg</span>) for each shed.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shedList.map((s) => {
          const val = entry[s.id] ?? "";
          const busy = !!saving[s.id];
          return (
            <div key={s.id} className="card p-4 flex flex-col gap-3">
              <div className="text-lg font-semibold">{s.name || "—"}</div>

              <label className="text-sm text-slate-600">Feed remaining (kg)</label>
              <input
                type="number"
                inputMode="decimal"
                className="w-full rounded border p-2"
                placeholder="e.g. 1250"
                value={val}
                onChange={(e) => setEntry((m) => ({ ...m, [s.id]: e.target.value }))}
                min={0}
                step="0.1"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={busy}
                  className={`px-3 py-2 rounded border ${busy ? "opacity-60 cursor-not-allowed" : "hover:bg-slate-50"}`}
                  onClick={() => onSave(s.id, s.name || "—")}
                >
                  {busy ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
