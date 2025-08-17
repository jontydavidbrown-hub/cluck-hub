import { useEffect, useMemo, useState } from "react";
import { useServerState } from "../lib/serverState";
import { me, logout } from "../lib/session";
import { useLocation, useNavigate } from "react-router-dom";
import { useFarm } from "../lib/FarmContext";
import { useCloudSlice } from "../lib/cloudSlice";

export default function User() {
  const { state: user, setState: setUser } =
    useServerState<{ email: string } | null>("user", null);

  // Keep using your FarmContext for existing behavior (createFarm, etc.)
  const { farms = [], farmId, setFarmId, createFarm } = useFarm() as any;

  // 🔁 New: global cloud-backed mirrors to ensure cross-device sync
  const [globalFarms, setGlobalFarms] = useCloudSlice<any[]>("farms", [], { scope: "global" });
  const [globalSelectedFarmId, setGlobalSelectedFarmId] =
    useCloudSlice<string | null>("selectedFarmId", null, { scope: "global" });

  const navigate = useNavigate();
  const location = useLocation();

  // Prefer the global list for display/sync (fallback to context if empty)
  const farmsForUI: any[] = (globalFarms && globalFarms.length > 0) ? globalFarms : (farms || []);

  // Keep local list stable by name
  const farmsSorted = useMemo(
    () => [...(farmsForUI || [])].sort((a, b) => (a?.name || "").localeCompare(b?.name || "")),
    [farmsForUI]
  );

  // Sync user on mount once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await me();
        if (!cancelled) setUser(u?.email ? u : null);
      } catch {
        if (!cancelled) setUser(null);
      }
    })();
    return () => { cancelled = true; };
  }, []); // run once

  async function onSignOut() {
    try {
      await logout();
    } finally {
      setUser(null);
      forceShowLogin();
    }
  }

  function forceShowLogin() {
    setUser(null);
    const params = new URLSearchParams(location.search);
    params.set("forceLogin", "1");
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    try { window.dispatchEvent(new CustomEvent("force-login")); } catch {}
  }

  // --- New Farm creation local state ---
  const [newName, setNewName] = useState("");

  async function onCreateFarm() {
    const name = newName.trim();
    if (!name) return;
    try {
      // Keep your existing behavior
      await createFarm?.(name);

      // Nudge global list so it syncs across devices immediately.
      // (If your provider updates the global "farms" itself, this is harmless.)
      setGlobalFarms(prev => [...(prev || []), { id: Date.now().toString(36), name }]);

      setNewName("");
    } catch (e) {
      console.error("createFarm failed", e);
    }
  }

  // 🔗 Keep selected farm in sync both ways (context ↔ global)
  useEffect(() => {
    if (farmId !== globalSelectedFarmId) {
      // Prefer the explicit user selection if present
      const next = farmId ?? globalSelectedFarmId ?? null;
      setGlobalSelectedFarmId(next);
      if (next !== farmId) setFarmId?.(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId, globalSelectedFarmId]);

  const currentSelected =
    (globalSelectedFarmId ?? farmId ?? (farmsSorted[0]?.id ?? "")) as string;

  return (
    <div className="animate-fade-slide space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">User</h1>
        <div className="mt-2 text-sm">
          <strong>Status:</strong> {user?.email ? "Signed In" : "Not Signed In"}
        </div>
      </div>

      {/* Auth card */}
      <div className="card p-4">
        {user?.email ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-slate-500">Signed in as</div>
              <div className="font-medium">{user.email}</div>
            </div>
            <div className="flex gap-2">
              <button className="rounded border px-4 py-2 hover:bg-slate-50" onClick={onSignOut}>
                Sign Out
              </button>
              <button
                className="rounded border px-4 py-2 hover:bg-slate-50"
                onClick={() => { setUser(null); forceShowLogin(); }}
              >
                Sign In as different user
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-slate-600 text-sm">You are not signed in.</div>
            <button className="rounded bg-slate-900 text-white px-4 py-2" onClick={forceShowLogin}>
              Sign In
            </button>
          </div>
        )}
      </div>

      {/* Farm management (moved here from header) */}
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
    </div>
  );
}
