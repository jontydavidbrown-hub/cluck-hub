// src/pages/Reminders.tsx
import { useMemo, useState } from "react";
import { useCloudSlice } from "../lib/cloudSlice";

type Reminder = {
  id: string;
  date?: string;   // YYYY-MM-DD
  time?: string;   // HH:MM (optional)
  text?: string;   // primary field
  title?: string;  // legacy/alt field
  notes?: string;  // optional
  done?: boolean;
};

// ------- utils -------
const toArr = (v: any) => (Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : []);
const isObj = (x: any) => x && typeof x === "object";
const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Math.random()).slice(2);

function todayYMD(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function safeDateKey(r: Partial<Reminder>): string {
  // use a sortable fallback so “no date” sorts last
  return r?.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : "9999-12-31";
}
function safeTimeKey(r: Partial<Reminder>): string {
  // HH:MM; sort missing time last
  return r?.time && /^\d{2}:\d{2}$/.test(r.time) ? r.time : "99:99";
}

export default function Reminders() {
  const [items, setItems] = useCloudSlice<Reminder[]>("reminders", []);
  const [draftDate, setDraftDate] = useState<string>(todayYMD());
  const [draftTime, setDraftTime] = useState<string>("");
  const [draftText, setDraftText] = useState<string>("");

  // Sanitize incoming array and sort safely
  const reminders = useMemo(() => {
    const base = toArr(items)
      .filter(isObj)
      .filter((r: any) => typeof r.id === "string")
      .map((r: any) => {
        const text = (r.text ?? r.title ?? "").toString();
        const date = typeof r.date === "string" ? r.date : "";
        const time = typeof r.time === "string" ? r.time : "";
        const done = Boolean(r.done);
        const id = String(r.id);
        const notes = typeof r.notes === "string" ? r.notes : undefined;
        return { id, date, time, text, notes, done } as Reminder;
      });

    // Sort by date asc, then time asc (undefined goes to end)
    base.sort((a, b) => {
      const dk = safeDateKey(a).localeCompare(safeDateKey(b));
      if (dk !== 0) return dk;
      return safeTimeKey(a).localeCompare(safeTimeKey(b));
    });

    return base;
  }, [items]);

  function addReminder() {
    const text = draftText.trim();
    if (!text) return;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(draftDate) ? draftDate : todayYMD();
    const time = draftTime && /^\d{2}:\d{2}$/.test(draftTime) ? draftTime : "";
    const next: Reminder = { id: uuid(), date, time, text, done: false };
    setItems([...(Array.isArray(items) ? items : []), next]);
    setDraftText("");
    // keep date/time as-is for faster entry
  }

  function toggleDone(id: string) {
    setItems(
      reminders.map((r) => (r.id === id ? { ...r, done: !r.done } : r))
    );
  }

  function remove(id: string) {
    if (!confirm("Remove this reminder?")) return;
    setItems(reminders.filter((r) => r.id !== id));
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reminders</h1>
      </div>

      {/* Add form */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="font-medium mb-3">Add Reminder</div>
        <div className="grid md:grid-cols-6 gap-3">
          <label className="block">
            <div className="text-sm mb-1">Date</div>
            <input
              type="date"
              className="w-full border rounded px-3 py-2"
              value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
            />
          </label>
          <label className="block">
            <div className="text-sm mb-1">Time (optional)</div>
            <input
              type="time"
              className="w-full border rounded px-3 py-2"
              value={draftTime}
              onChange={(e) => setDraftTime(e.target.value)}
            />
          </label>
          <label className="block md:col-span-3">
            <div className="text-sm mb-1">Text</div>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              placeholder="e.g., Service water lines in Shed 2"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
            />
          </label>
          <div className="flex items-end">
            <button className="rounded bg-slate-900 text-white px-4 py-2" onClick={addReminder}>
              Add
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="font-medium mb-3">Upcoming & Completed</div>

        {reminders.length === 0 ? (
          <div className="text-sm text-slate-600">No reminders yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2">Time</th>
                  <th className="py-2 pr-2">Text</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reminders.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="py-2 pr-2">{r.date || "-"}</td>
                    <td className="py-2 pr-2">{r.time || "-"}</td>
                    <td className="py-2 pr-2">{r.text || r.title || "-"}</td>
                    <td className="py-2 pr-2">
                      <span
                        className={[
                          "rounded px-2 py-0.5 text-xs",
                          r.done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
                        ].join(" ")}
                      >
                        {r.done ? "Done" : "Open"}
                      </span>
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex gap-2">
                        <button
                          className="px-2 py-1 border rounded"
                          onClick={() => toggleDone(r.id)}
                          title={r.done ? "Mark as open" : "Mark as done"}
                        >
                          {r.done ? "Undo" : "Done"}
                        </button>
                        <button
                          className="px-2 py-1 border rounded text-red-600"
                          onClick={() => remove(r.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
