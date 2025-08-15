import { useEffect, useMemo, useState } from "react";
import { useServerState } from "../lib/serverState";

type Shed = {
  id: string;
  name: string;
  placedDate?: string | null;   // ISO (yyyy-mm-dd)
  initialCount?: number | null; // birds placed
};

type Settings = {
  batchLengthDays: number;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function Setup() {
  // ----- Sheds (server-synced) -----
  const { state: shedsRaw, setState: setSheds, loading, synced } =
    useServerState<any>("sheds", []);

  // Migrate legacy string[] -> Shed[]
  useEffect(() => {
    if (Array.isArray(shedsRaw) && shedsRaw.some((x) => typeof x === "string")) {
      const migrated: Shed[] = (shedsRaw as string[]).map((name) => ({
        id: uid(),
        name,
        placedDate: null,
        initialCount: null,
      }));
      setSheds(migrated);
    }
  }, [shedsRaw, setSheds]);

  const sheds: Shed[] = useMemo(() => {
    if (!Array.isArray(shedsRaw)) return [];
    return shedsRaw.map((x: any) =>
      typeof x === "string"
        ? { id: uid(), name: x, placedDate: null, initialCount: null }
        : (x as Shed)
    );
  }, [shedsRaw]);

  // ----- Global settings (server-synced) -----
  const { state: settings, setState: setSettings } =
    useServerState<Settings>("settings", { batchLengthDays: 49 });

  // ----- Form state -----
  const [name, setName] = useState("");
  const [placedDate, setPlacedDate] = useState<string>(todayISO());
  const [initialCount, setInitialCount] = useState<string>("");

  function add() {
    if (!name.trim()) return;
    const next: Shed[] = [
      ...sheds,
      {
        id: uid(),
        name: name.trim(),
        placedDate: placedDate || null,
        initialCount: initialCount === "" ? null : Number(initialCount),
      },
    ];
    setSheds(next);
    setName("");
    setPlacedDate(todayISO());
    setInitialCount("");
  }

  function remove(id: string) {
    setSheds(sheds.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Setup</h1>
        {!loading && (
          <span
            className={`text-xs px-2 py-1 rounded border ${
              synced
                ? "text-green-700 border-green-200 bg-green-50"
                : "text-amber-700 border-amber-200 bg-amber-50"
            }`}
          >
            {synced ? "Synced" : "Saving…"}
          </span>
        )}
      </header>

      {/* Global batch settings */}
      <div className="bg-white border rounded-xl p-4">
        <div className="grid gap-3 md:grid-cols-3 items-end">
          <div className="md:col-span-1">
            <label className="block text-sm text-slate-500 mb-1">Batch length (days)</label>
            <input
              type="number"
              min={1}
              value={settings.batchLengthDays || 49}
              onChange={(e) =>
                setSettings({ ...settings, batchLengthDays: Math.max(1, Number(e.target.value || 1)) })
              }
              className="border rounded p-2 w-full"
            />
          </div>
          <div className="md:col-span-2 text-sm text-slate-600">
            Used to calculate progress on the dashboard (Day X of Y).
          </div>
        </div>
      </div>

      {/* Add shed */}
      <div className="grid gap-3 md:grid-cols-5 bg-white p-4 border rounded-xl">
        <input
          placeholder="Shed name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded p-2 md:col-span-2"
        />
        <input
          type="date"
          value={placedDate}
          onChange={(e) => setPlacedDate(e.target.value)}
          className="border rounded p-2"
        />
        <input
          placeholder="Number placed"
          type="number"
          value={initialCount}
          onChange={(e) => setInitialCount(e.target.value)}
          className="border rounded p-2"
        />
        <button
          onClick={add}
          className="rounded-lg bg-slate-900 text-white px-3 py-2"
        >
          Add Shed
        </button>
      </div>

      {/* Sheds list */}
      <div className="bg-white border rounded-xl divide-y">
        {sheds.map((s) => (
          <div key={s.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-slate-500">
                Placed: {s.placedDate || "-"} · Initial count: {s.initialCount ?? "-"}
              </div>
            </div>
            <button
              onClick={() => remove(s.id)}
              className="text-red-600 hover:underline"
            >
              remove
            </button>
          </div>
        ))}
        {!sheds.length && (
          <div className="p-6 text-slate-500">No sheds yet. Add one above.</div>
        )}
      </div>
    </div>
  );
}
