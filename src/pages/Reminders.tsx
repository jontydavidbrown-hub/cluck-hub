import { useMemo, useState } from "react";
import { useCloudSlice } from "../lib/cloudSlice";
import { useFarm } from "../lib/FarmContext";

type Reminder = {
  id: string;
  title: string;
  date: string;   // YYYY-MM-DD
  done?: boolean;
  notes?: string;
};

function emptyReminder(): Reminder {
  const today = new Date().toISOString().slice(0, 10);
  return { id: crypto.randomUUID(), title: "", date: today, done: false, notes: "" };
}

export default function Reminders() {
  const { farmId } = useFarm();
  const [items, setItems] = useCloudSlice<Reminder[]>("reminders", []);
  const [draft, setDraft] = useState<Reminder>(emptyReminder());
  const [editing, setEditing] = useState<Reminder | null>(null);

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)),
    [items]
  );

  const dueToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return sorted.filter(r => r.date.slice(0, 10) === today && !r.done);
  }, [sorted]);

  const add = () => {
    if (!draft.title) return;
    setItems([...(items || []), draft]);
    setDraft(emptyReminder());
  };

  const toggleDone = (id: string) => {
    setItems(items.map(r => (r.id === id ? { ...r, done: !r.done } : r)));
  };

  const remove = (id: string) => {
    if (!confirm("Delete this reminder?")) return;
    setItems(items.filter(r => r.id !== id));
  };

  const saveEdit = () => {
    if (!editing) return;
    if (!editing.title) return;
    setItems(items.map(r => (r.id === editing.id ? editing : r)));
    setEditing(null);
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reminders</h1>
        <a
          className="px-3 py-1 border rounded"
          href={`/.netlify/functions/ics?farmId=${farmId ?? ""}`}
        >
          Export Calendar (.ics)
        </a>
      </div>

      {dueToday.length > 0 && (
        <div className="p-3 rounded-xl border bg-yellow-50 text-sm">
          <div className="font-medium mb-1">Due today</div>
          <ul className="list-disc pl-5">
            {dueToday.map(r => <li key={r.id}>{r.title}</li>)}
          </ul>
        </div>
      )}

      {/* Add form */}
      <div className="p-4 border rounded-2xl bg-white">
        <div className="font-medium mb-3">Add reminder</div>
        <div className="grid md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Title</label>
            <input className="w-full border rounded px-2 py-1"
              placeholder="e.g., Weigh birds"
              value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm mb-1">Date</label>
            <input type="date" className="w-full border rounded px-2 py-1"
              value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm mb-1">Notes</label>
            <input className="w-full border rounded px-2 py-1"
              value={draft.notes ?? ""} onChange={e => setDraft({ ...draft, notes: e.target.value })} />
          </div>
        </div>
        <div className="mt-3">
          <button className="px-4 py-2 rounded bg-black text-white" onClick={add}>Add</button>
        </div>
      </div>

      {/* List */}
      <div className="p-4 border rounded-2xl bg-white">
        {sorted.length === 0 ? (
          <div className="text-gray-500">No reminders yet.</div>
        ) : (
          <ul className="divide-y">
            {sorted.map(r => (
              <li key={r.id} className="py-3 flex flex-col md:flex-row md:items-center gap-2">
                <div className="flex-1">
                  {editing?.id === r.id ? (
                    <div className="grid md:grid-cols-4 gap-3">
                      <input className="border rounded px-2 py-1 md:col-span-2"
                        value={editing.title} onChange={e => setEditing(s => ({ ...(s as Reminder), title: e.target.value }))} />
                      <input type="date" className="border rounded px-2 py-1"
                        value={editing.date} onChange={e => setEditing(s => ({ ...(s as Reminder), date: e.target.value }))} />
                      <input className="border rounded px-2 py-1"
                        value={editing.notes ?? ""} onChange={e => setEditing(s => ({ ...(s as Reminder), notes: e.target.value }))} />
                    </div>
                  ) : (
                    <div>
                      <div className="font-medium">{r.title}</div>
                      <div className="text-sm text-gray-600">{r.date} {r.notes ? `• ${r.notes}` : ""}</div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {editing?.id === r.id ? (
                    <>
                      <button className="px-2 py-1 border rounded" onClick={saveEdit}>Save</button>
                      <button className="px-2 py-1 border rounded" onClick={() => setEditing(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <label className="inline-flex items-center gap-1 text-sm">
                        <input type="checkbox" checked={!!r.done} onChange={() => toggleDone(r.id)} />
                        Done
                      </label>
                      <button className="px-2 py-1 border rounded" onClick={() => setEditing(r)}>Edit</button>
                      <button className="px-2 py-1 border rounded text-red-600" onClick={() => remove(r.id)}>Remove</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
