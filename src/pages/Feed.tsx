import { useMemo, useState } from "react";
import { useCloudSlice } from "../lib/cloudSlice";

type FeedType = "Starter" | "Grower" | "Finisher";
const FEED_TYPES: FeedType[] = ["Starter", "Grower", "Finisher"];

type SiloRow = {
id: string;
name: string;
type: FeedType;
capacityT?: number;   // optional so placeholder can show
levelT?: number;      // optional so placeholder can show
notes?: string;
};

function newId() {
return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
function emptyRow(): SiloRow {
return { id: newId(), name: "", type: "Starter", capacityT: undefined, levelT: undefined, notes: "" };
}

export default function Feed() {
const [rows, setRows] = useCloudSlice<SiloRow[]>("feedSilos", []);
const [draft, setDraft] = useState<SiloRow>(emptyRow());
const [editingId, setEditingId] = useState<string | null>(null);
const [edit, setEdit] = useState<SiloRow | null>(null);

const sorted = useMemo(
() => [...rows].sort((a, b) => a.name.localeCompare(b.name)),
[rows]
);

const totals = useMemo(() => {
const cap = rows.reduce((s, r) => s + (Number(r.capacityT) || 0), 0);
const lvl = rows.reduce((s, r) => s + (Number(r.levelT) || 0), 0);
return { cap, lvl, pct: cap > 0 ? Math.round((lvl / cap) * 100) : 0 };
}, [rows]);

function clampNum(n: any) {
const v = Number(n);
return Number.isFinite(v) ? v : 0;
}

const addRow = () => {
if (!draft.name.trim()) return;
const cleaned: SiloRow = {
...draft,
id: draft.id || newId(),
capacityT: clampNum(draft.capacityT ?? 0),
levelT: Math.max(0, Math.min(clampNum(draft.levelT ?? 0), clampNum(draft.capacityT ?? 0))),
type: FEED_TYPES.includes(draft.type) ? draft.type : "Starter",
};
setRows(prev => [...(prev || []), cleaned]);
setDraft(emptyRow());
};

const startEdit = (r: SiloRow) => {
setEditingId(r.id);
setEdit({ ...r });
};

const saveEdit = () => {
if (!edit) return;
const cleaned: SiloRow = {
...edit,
name: (edit.name || "").trim(),
capacityT: clampNum(edit.capacityT ?? 0),
levelT: Math.max(0, Math.min(clampNum(edit.levelT ?? 0), clampNum(edit.capacityT ?? 0))),
type: FEED_TYPES.includes(edit.type) ? edit.type : "Starter",
};
if (!cleaned.name) return;
setRows(prev => prev.map(r => (r.id === cleaned.id ? cleaned : r)));
setEditingId(null);
setEdit(null);
};

const remove = (id: string) => {
if (!confirm("Remove this silo?")) return;
setRows(prev => prev.filter(r => r.id !== id));
};

return (
<div className="p-4 space-y-6">
<div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Feed Silos</h1>
        <h1 className="text-2xl font-semibold">Feed</h1>
<div className="text-sm text-slate-600">
Total: {totals.lvl.toFixed(1)} / {totals.cap.toFixed(1)} t ({totals.pct}%)
</div>
</div>

{/* Add form */}
<div className="p-4 border rounded-2xl bg-white">
<div className="font-medium mb-3">Add silo</div>
<div className="grid md:grid-cols-6 gap-3">
<div className="md:col-span-2">
<label className="block text-sm mb-1">Silo name</label>
<input
className="w-full border rounded px-2 py-1"
placeholder="e.g., Silo 1"
value={draft.name}
onChange={e => setDraft({ ...draft, name: e.target.value })}
/>
</div>

<div>
<label className="block text-sm mb-1">Feed type</label>
<select
className="w-full border rounded px-2 py-1"
value={draft.type}
onChange={e => setDraft({ ...draft, type: (e.target.value as FeedType) })}
>
{FEED_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
</select>
</div>

<div>
<label className="block text-sm mb-1">Capacity (t)</label>
<input
type="number" min={0} step="0.01"
className="w-full border rounded px-2 py-1 placeholder-transparent"
placeholder="0"
value={draft.capacityT ?? ""}
onChange={e => setDraft({ ...draft, capacityT: e.target.value === "" ? undefined : clampNum(e.target.value) })}
/>
</div>

<div>
<label className="block text-sm mb-1">Level (t)</label>
<input
type="number" min={0} step="0.01"
className="w-full border rounded px-2 py-1 placeholder-transparent"
placeholder="0"
value={draft.levelT ?? ""}
onChange={e => setDraft({ ...draft, levelT: e.target.value === "" ? undefined : clampNum(e.target.value) })}
/>
</div>

<div className="md:col-span-2">
<label className="block text-sm mb-1">Notes</label>
<input
className="w-full border rounded px-2 py-1"
value={draft.notes ?? ""}
onChange={e => setDraft({ ...draft, notes: e.target.value })}
/>
</div>
</div>

<div className="mt-3">
<button className="px-4 py-2 rounded bg-black text-white" onClick={addRow}>
Add
</button>
</div>
</div>

{/* Table */}
<div className="p-4 border rounded-2xl bg-white">
<div className="overflow-x-auto">
<table className="w-full text-sm">
<thead>
<tr className="text-left border-b">
<th className="py-2 pr-2">Silo</th>
<th className="py-2 pr-2">Type</th>
<th className="py-2 pr-2">Capacity (t)</th>
<th className="py-2 pr-2">Level (t)</th>
<th className="py-2 pr-2">Notes</th>
<th className="py-2 pr-2">Actions</th>
</tr>
</thead>
<tbody>
{sorted.map(r => (
<tr key={r.id} className="border-b">
<td className="py-2 pr-2">
{editingId === r.id ? (
<input
className="border rounded px-2 py-1"
value={edit?.name || ""}
onChange={e => setEdit(s => ({ ...(s as SiloRow), name: e.target.value }))}
/>
) : r.name}
</td>

<td className="py-2 pr-2">
{editingId === r.id ? (
<select
className="border rounded px-2 py-1"
value={edit?.type || "Starter"}
onChange={e => setEdit(s => ({ ...(s as SiloRow), type: e.target.value as FeedType }))}
>
{FEED_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
</select>
) : r.type}
</td>

<td className="py-2 pr-2">
{editingId === r.id ? (
<input
type="number" min={0} step="0.01"
className="border rounded px-2 py-1 placeholder-transparent"
placeholder="0"
value={edit?.capacityT ?? ""}
onChange={e => setEdit(s => ({ ...(s as SiloRow), capacityT: e.target.value === "" ? undefined : clampNum(e.target.value) }))}
/>
) : (r.capacityT != null ? r.capacityT.toFixed(2) : "—")}
</td>

<td className="py-2 pr-2">
{editingId === r.id ? (
<input
type="number" min={0} step={0.01}
className="border rounded px-2 py-1 placeholder-transparent"
placeholder="0"
value={edit?.levelT ?? ""}
onChange={e => setEdit(s => ({ ...(s as SiloRow), levelT: e.target.value === "" ? undefined : clampNum(e.target.value) }))}
/>
) : (r.levelT != null ? r.levelT.toFixed(2) : "—")}
</td>

<td className="py-2 pr-2">
{editingId === r.id ? (
<input
className="border rounded px-2 py-1"
value={edit?.notes || ""}
onChange={e => setEdit(s => ({ ...(s as SiloRow), notes: e.target.value }))}
/>
) : (r.notes || "")}
</td>

<td className="py-2 pr-2">
{editingId === r.id ? (
<div className="flex gap-2">
<button className="px-2 py-1 border rounded" onClick={saveEdit}>Save</button>
<button className="px-2 py-1 border rounded" onClick={() => { setEditingId(null); setEdit(null); }}>Cancel</button>
</div>
) : (
<div className="flex gap-2">
<button className="px-2 py-1 border rounded" onClick={() => startEdit(r)}>Edit</button>
<button className="px-2 py-1 border rounded text-red-600" onClick={() => remove(r.id)}>Remove</button>
</div>
)}
</td>
</tr>
))}
{sorted.length === 0 && (
<tr><td className="py-6 text-gray-500" colSpan={6}>No silos yet.</td></tr>
)}
</tbody>
</table>
</div>
</div>
</div>
);
}
