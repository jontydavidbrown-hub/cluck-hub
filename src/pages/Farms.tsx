import { useMemo, useState, useEffect } from "react";
import { useFarm } from "../lib/FarmContext";
import { useCloudSlice } from "../lib/cloudSlice";
import Members from "./Members";

export default function Farms() {
  const { farms = [], farmId, setFarmId, createFarm } = useFarm() as any;

  const [globalFarms, setGlobalFarms] = useCloudSlice<any[]>("farms", [], { scope: "global" });
  const [globalSelectedFarmId, setGlobalSelectedFarmId] =
    useCloudSlice<string | null>("selectedFarmId", null, { scope: "global" });

  const farmsForUI: any[] = (globalFarms && globalFarms.length > 0) ? globalFarms : (farms || []);
  const farmsSorted = useMemo(
    () => [...(farmsForUI || [])].sort((a, b) => (a?.name || "").localeCompare(b?.name || "")),
    [farmsForUI]
  );

  useEffect(() => {
    if (farmId !== globalSelectedFarmId) {
      const next = farmId ?? globalSelectedFarmId ?? null;
      setGlobalSelectedFarmId(next);
      if (next !== farmId) setFarmId?.(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId, globalSelectedFarmId]);

  const currentSelected =
    (globalSelectedFarmId ?? farmId ?? (farmsSorted[0]?.id ?? "")) as string;

  const [newName, setNewName] = useState("");
  async function onCreateFarm() {
    const name = newName.trim();
    if (!name) return;
    await createFarm?.(name);
    // ❌ removed the extra setGlobalFarms(...) nudge that caused duplicates
    setNewName("");
  }

  function onDeleteFarm(id: string) {
    const name = (farmsSorted.find(f => f.id === id)?.name || "this farm");
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setGlobalFarms(prev => {
      const list = (prev || []).filter(f => f.id !== id);
      const nextId = list[0]?.id ?? null;
      setGlobalSelectedFarmId(nextId);
      setFarmId?.(nextId);
      return list;
    });
  }

  return (
    <div className="animate-fade-slide space-y-6">
      <h1 className="text-2xl font-semibold">Farms</h1>

      <div className="card p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold">Farm Management</h2>
          {Array.isArray(farmsForUI) && farmsForUI.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">Current farm:</label>
              <select
                className="border rounded-lg px-2 py-1 bg-white/80 backdrop-blur-sm shadow-sm"
                value={currentSelected}
                onChange={(e) => {
                  const id = e.target.value;
                  setGlobalSelectedFarmId(id);
                  setFarmId?.(id);
                }}
              >
                {farmsSorted.map((f: any) => (
                  <option key={f.id} value={f.id}>
                    {f.name || "Farm " + String(f.id).slice(0, 4)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-3 rounded-xl border bg-white">
            <div className="text-sm font-medium mb-2">Your farms</div>
            <ul className="text-sm space-y-1">
              {(farmsSorted || []).map((f: any) => (
                <li key={f.id} className="flex items-center justify-between">
                  <span className={["truncate", f.id === currentSelected ? "font-semibold" : ""].join(" ")}>
                    {f.name || "Farm " + String(f.id).slice(0, 4)}
                  </span>
                  <div className="flex items-center gap-2">
                    {f.id !== currentSelected && (
                      <button
                        className="text-xs rounded border px-2 py-1 hover:bg-slate-50"
                        onClick={() => {
                          setGlobalSelectedFarmId(f.id);
                          setFarmId?.(f.id);
                        }}
                      >
                        Switch
                      </button>
                    )}
                    <button
                      className="text-xs rounded border px-2 py-1 hover:bg-red-50 text-red-600 border-red-300"
                      onClick={() => onDeleteFarm(f.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
              {(!farmsSorted || farmsSorted.length === 0) && (
                <li className="text-slate-500">No farms yet.</li>
              )}
            </ul>
          </div>

          <div className="p-3 rounded-xl border bg-white">
            <div className="text-sm font-medium mb-2">Create new farm</div>
            <div className="flex gap-2">
              <input
                className="flex-1 border rounded px-3 py-2"
                placeholder="Farm name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button className="rounded bg-slate-900 text-white px-4 py-2" onClick={onCreateFarm}>
                Create
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              New farms are shared with members you invite. You can switch farms at the top of this section.
            </p>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="text-lg font-semibold mb-2">Members</h2>
        <Members />
      </div>
    </div>
  );
}
