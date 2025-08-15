import { useEffect, useMemo, useState } from "react";
import { useServerState } from "../lib/serverState";

type Shed = {
  id: string;
  name: string;
  placedDate?: string | null;   // ISO yyyy-mm-dd
  initialCount?: number | null; // placed birds
};

type Settings = { batchLengthDays: number };

function uid() { return Math.random().toString(36).slice(2, 10); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function Setup() {
  // sheds
  const { state: shedsRaw, setState: setSheds, loading, synced } =
    useServerState<any>("sheds", []);
  // settings (batch length already added previously)
  const { state: settings, setState: setSettings } =
    useServerState<Settings>("settings", { batchLengthDays: 49 });

  // migrate legacy string[] -> Shed[]
  useEffect(() => {
    if (Array.isArray(shedsRaw) && shedsRaw.some((x) => typeof x === "string")) {
      const migrated: Shed[] = (shedsRaw as string[]).map((name) => ({
        id: uid(), name, placedDate: null, initialCount: null
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

  // add form
  const [name, setName] = useState("");
  const [placedDate, setPlacedDate] = useState<string>(todayISO());
  const [initialCount, setInitialCount] = useState<string>("");

  // edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string>("");
  const [editCount, setEditCount] = useState<string>("");

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

  function beginEdit(s: Shed) {
    setEditingId(s.id);
    setEditDate(s.placedDate ?? "");
    setEditCount(s.initialCount != null ? String(s.initialCount) : "");
  }

  function saveEdit(id: string) {
    const next = sheds.map((s) =>
      s.id === id
        ? {
            ...s,
            placedDate: editDate || null,
            initialCount: editCount === "" ? null : Number(editCount),
          }
        : s
    );
    setSheds(next);
    cancelEdit();
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDate("");
    setEditCount("");
  }

  function remove(id: string) {
    setSheds(sheds.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Setup</h1>
        {!loading && (
          <span className={`text-xs px-2 py-1 rounded border ${synced ? "text-green-700 border-green-200 bg-green-50" : "text-amber-700 border-amber-200 bg-amber-50"}`}>
            {synced ? "Synced" : "Saving…"}
          </span>
        )}
      </header>

      {/* Batch length */}
      <div className="bg-white border rounded-xl p-4">
        <label className="block text-sm text-slate-500 mb-1">Batch length (days)</label>
        <input
          type="number"
          min={1}
          value={settings.batchLengthDays || 49}
          onChange={(e) =>
            setSettings({ ...settings, batchLengthDays: Math.max(1, Number(e.target.value || 1)) })
          }
          className="border rounded p-2 w-40"
        />
        <div className="text-xs text-slate-500 mt-2">Used for progress on Dashboard (Day X of Y).</div>
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
        <button onClick={add} className="rounded-lg bg-slate-900 text-white px-3 py-2">
          Add Shed
        </button>
      </div>

      {/* List with inline editing */}
      <div className="bg-white border rounded-xl divide-y">
        {sheds.map((s) => (
          <div key={s.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{s.name}</div>
                {editingId === s.id ? (
                  <div className="mt-2 grid gap-2 md:grid-cols-3">
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="border rounded p-2"
                    />
                    <input
                      placeholder="Number placed"
                      type="number"
                      value={editCount}
                      onChange={(e) => setEditCount(e.target.value)}
                      className="border rounded p-2"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(s.id)} className="rounded-lg bg-slate-900 text-white px-3 py-2">Save</button>
                      <button onClick={cancelEdit} className="rounded-lg border px-3 py-2">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">
                    Placed: {s.placedDate || "-"} · Initial count: {s.initialCount ?? "-"}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {editingId === s.id ? null : (
                  <button onClick={() => beginEdit(s)} className="rounded-lg border px-3 py-2 text-sm">Edit</button>
                )}
                <button onClick={() => remove(s.id)} className="rounded-lg border px-3 py-2 text-sm text-red-600">
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
        {!sheds.length && <div className="p-6 text-slate-500">No sheds yet. Add one above.</div>}
      </div>
    </div>
  );
}
