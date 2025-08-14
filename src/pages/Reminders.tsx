import { useEffect, useMemo, useState, useRef } from "react";
import { getJSON, setJSON } from "../lib/storage";

// --- Types
type ReminderType = "fixed" | "dayAge";

type Reminder = {
  id: string;
  title: string;
  type: ReminderType;
  // fixed
  when?: string; // ISO
  // dayAge
  shed?: string; // which shed
  offsetDays?: number; // day age offset from placement
  timeOfDay?: string; // "HH:MM"
  // common
  notify?: boolean;
  done?: boolean;
};

type Placements = Record<string, string>; // shed -> ISO date string (placement date)

const STORAGE_KEY = "reminders";
const PLACEMENTS_KEY = "placements";
const SHEDS_KEY = "sheds";

export default function Reminders() {
  const [reminders, setReminders] = useState<Reminder[]>(
    getJSON<Reminder[]>(STORAGE_KEY, defaultSeed())
  );
  const sheds = getJSON<string[]>(SHEDS_KEY, []);
  const placements = getJSON<Placements>(PLACEMENTS_KEY, {});
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [flash, setFlash] = useState<string>("");

  // Persist whenever it changes
  useEffect(() => {
    setJSON(STORAGE_KEY, reminders);
  }, [reminders]);

  // Poll every minute to trigger in-app notifications if enabled and due
  useEffect(() => {
    const t = setInterval(() => maybeNotifyDue(reminders, placements), 60000);
    return () => clearInterval(t);
  }, [reminders, placements]);

  function requestPermission() {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then(setPermission);
  }

  const upcoming = useMemo(() => {
    const items = reminders
      .map((r) => ({ r, due: computeDueDate(r, placements) }))
      .filter((it) => !!it.due)
      .sort((a, b) => (a.due!.getTime() - b.due!.getTime()));
    return items;
  }, [reminders, placements]);

  // form state
  const [mode, setMode] = useState<ReminderType>("dayAge");
  const [title, setTitle] = useState("");
  const [shed, setShed] = useState(sheds[0] || "");
  const [offsetDays, setOffsetDays] = useState<number | "">("");
  const [timeOfDay, setTimeOfDay] = useState("09:00");
  const [when, setWhen] = useState<string>(() => toLocalDatetimeInput(new Date()));
  const titleRef = useRef<HTMLInputElement|null>(null);

  useEffect(() => {
    if (!shed && sheds.length) setShed(sheds[0]);
  }, [sheds, shed]);

  const canAdd = useMemo(() => {
    if (mode === "fixed") return !!when;
    // dayAge
    return !!shed && placements[shed] && offsetDays !== "" && Number.isFinite(Number(offsetDays));
  }, [mode, when, shed, placements, offsetDays]);

  function addReminder() {
    if (!canAdd) {
      setFlash("Please fill all fields (and set a placement date in Setup for the selected shed).");
      setTimeout(() => setFlash(""), 3000);
      return;
    }
    const id = cryptoRandom();
    const base = { id, title: title.trim() || defaultTitle(mode), notify: true } as Reminder;
    let r: Reminder;
    if (mode === "fixed") {
      r = { ...base, type: "fixed", when };
    } else {
      r = {
        ...base,
        type: "dayAge",
        shed,
        offsetDays: Number(offsetDays),
        timeOfDay: timeOfDay || "09:00",
      };
    }
    setReminders((prev) => [...prev, r]);
    setTitle("");
    // reset only the field that makes sense
    if (mode === "dayAge") {
      setOffsetDays("");
      // keep shed/timeOfDay as convenience
    } else {
      setWhen(toLocalDatetimeInput(new Date()));
    }
    setFlash("Reminder added ✓");
    setTimeout(() => setFlash(""), 1500);
    // focus back on title for quick entry
    titleRef.current?.focus();
  }

  function toggleDone(id: string) {
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, done: !r.done } : r)));
  }
  function remove(id: string) {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }
  function toggleNotify(id: string, val: boolean) {
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, notify: val } : r)));
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reminders</h1>
        <button
          className="border rounded px-3 py-2"
          onClick={permission === "granted" ? undefined : requestPermission}
          disabled={permission === "granted"}
          title={permission === "granted" ? "Notifications enabled" : "Enable notifications"}
        >
          {permission === "granted" ? "Notifications on ✓" : "Enable notifications"}
        </button>
      </div>

      {flash && <div className="text-sm text-green-700">{flash}</div>}

      {/* Add new */}
      <div className="border rounded p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-sm">Type:</label>
          <select
            className="border rounded px-3 py-2"
            value={mode}
            onChange={(e) => setMode(e.target.value as ReminderType)}
          >
            <option value="dayAge">Day‑age offset</option>
            <option value="fixed">Fixed date/time</option>
          </select>

          <input
            ref={titleRef}
            className="border rounded px-3 py-2 flex-1 min-w-[200px]"
            placeholder={mode === "dayAge" ? "e.g. Litter top‑up" : "e.g. Vet visit"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>

        {mode === "dayAge" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Shed</label>
              <select
                className="border rounded px-3 py-2 w-full"
                value={shed}
                onChange={(e) => setShed(e.target.value)}
              >
                {sheds.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {!placements[shed] && (
                <p className="text-xs text-red-600">
                  Placement date missing. Set it in Setup.
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Bird Age (From Placement)</label>
              <input
                type="number"
                className="border rounded px-3 py-2 w-full"
                value={offsetDays}
                placeholder="e.g. 7"
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  const v = e.target.value;
                  setOffsetDays(v === "" ? "" : Number(v));
                }}
                min={0}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Time</label>
              <input
                type="time"
                className="border rounded px-3 py-2 w-full"
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Date &amp; time</label>
              <input
                type="datetime-local"
                className="border rounded px-3 py-2 w-full"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            className={`rounded px-4 py-2 text-white ${canAdd ? "bg-black" : "bg-gray-400 cursor-not-allowed"}`}
            onClick={addReminder}
            disabled={!canAdd}
          >
            + Add reminder
          </button>
        </div>
      </div>

      {/* Upcoming list */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Upcoming</h2>
        {upcoming.length === 0 && (
          <div className="text-sm text-gray-600">No reminders yet.</div>
        )}
        <div className="space-y-2">
          {upcoming.map(({ r, due }) => (
            <div key={r.id} className="border rounded p-3 flex items-center gap-3">
              <input
                type="checkbox"
                checked={!!r.done}
                onChange={() => toggleDone(r.id)}
                title="Mark done"
              />
              <div className="flex-1">
                <div className="font-medium">{r.title || "(No title)"}</div>
                <div className="text-xs text-gray-600">
                  {r.type === "fixed" ? (
                    <>Due: {formatDate(due!)} (fixed)</>
                  ) : (
                    <>
                      Due: {formatDate(due!)} (day‑age {r.offsetDays} on shed {r.shed})
                    </>
                  )}
                </div>
              </div>
              <label className="text-xs flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={!!r.notify}
                  onChange={(e) => toggleNotify(r.id, e.target.checked)}
                />
                Notify
              </label>
              <button className="border rounded px-2 py-1" onClick={() => remove(r.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Note: Notifications are best‑effort while the app is open. For reliable off‑device
        scheduling, add these to your calendar too.
      </p>
    </div>
  );
}

// --- helpers

function defaultSeed(): Reminder[] {
  return [
    {
      id: cryptoRandom(),
      title: "Weekly shed check",
      type: "fixed",
      when: toLocalDatetimeInput(nextLocalTime("09:00", 1)),
      notify: true,
    },
  ];
}

function computeDueDate(r: Reminder, placements: Placements): Date | null {
  if (r.type === "fixed") {
    return r.when ? new Date(r.when) : null;
  }
  if (!r.shed || typeof r.offsetDays !== "number" || !r.timeOfDay) return null;
  const placementIso = placements[r.shed];
  if (!placementIso) return null;

  const placement = new Date(placementIso);
  const due = new Date(placement);
  due.setDate(due.getDate() + (r.offsetDays || 0));
  const [hh, mm] = r.timeOfDay.split(":").map((s) => parseInt(s || "0", 10));
  due.setHours(hh || 0, mm || 0, 0, 0);
  return due;
}

function maybeNotifyDue(reminders: Reminder[], placements: Placements) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const now = Date.now();
  for (const r of reminders) {
    if (!r.notify || r.done) continue;
    const due = computeDueDate(r, placements);
    if (!due) continue;
    const diff = due.getTime() - now;
    // Trigger within ±59s window
    if (Math.abs(diff) < 59000) {
      try {
        new Notification("Cluck Hub Reminder", {
          body: r.title || "Reminder due",
          tag: r.id,
          renotify: false,
        });
      } catch {}
    }
  }
}

function cryptoRandom() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

function nextLocalTime(hhmm: string, daysAhead = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const [hh, mm] = hhmm.split(":").map((s) => parseInt(s || "0", 10));
  d.setHours(hh || 9, mm || 0, 0, 0);
  return d;
}

function toLocalDatetimeInput(d: Date) {
  // Returns "YYYY-MM-DDTHH:MM" in local time
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function formatDate(d: Date) {
  return d.toLocaleString();
}
