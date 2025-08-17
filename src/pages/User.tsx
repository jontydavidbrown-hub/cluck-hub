import { useEffect, useMemo, useState } from "react";
import { useServerState } from "../lib/serverState";
import { me, logout } from "../lib/session";
import { useLocation, useNavigate } from "react-router-dom";
import { useFarm } from "../lib/FarmContext";
import { useCloudSlice } from "../lib/cloudSlice";

export default function User() {
  const { state: user, setState: setUser } =
    useServerState<{ email: string } | null>("user", null);

  const { farms = [], farmId, setFarmId, createFarm } = useFarm() as any;

  // Global cloud-backed mirrors (left in place for status consistency)
  const [globalFarms] = useCloudSlice<any[]>("farms", [], { scope: "global" });
  const [globalSelectedFarmId] =
    useCloudSlice<string | null>("selectedFarmId", null, { scope: "global" });

  const navigate = useNavigate();
  const location = useLocation();

  // Keep local list stable by name (only used if you show any farm info here later)
  const farmsForUI: any[] = (globalFarms && globalFarms.length > 0) ? globalFarms : (farms || []);
  useMemo(
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

  // Keep your sign-in UI as-is
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
    </div>
  );
}
