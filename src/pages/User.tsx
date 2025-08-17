import { useEffect } from "react";
import { useServerState } from "../lib/serverState";
import { me, logout } from "../lib/session";
import { useLocation, useNavigate } from "react-router-dom";

export default function User() {
  const { state: user, setState: setUser } =
    useServerState<{ email: string } | null>("user", null);

  const navigate = useNavigate();
  const location = useLocation();

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
  }, []); // empty deps to avoid loops

  async function onSignOut() {
    try {
      await logout();
    } finally {
      setUser(null);
      // After sign out, immediately show the login lightbox
      forceShowLogin();
    }
  }

  function forceShowLogin() {
    // Ensure UI knows we're signed out
    setUser(null);

    // 1) URL switch: add ?forceLogin=1 so App.tsx lightbox shows immediately
    const params = new URLSearchParams(location.search);
    params.set("forceLogin", "1");
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });

    // 2) Fallback event if you're on an older App.tsx without the query-param check
    try {
      window.dispatchEvent(new CustomEvent("force-login"));
    } catch {}
  }

  return (
    <div className="animate-fade-slide space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">User</h1>
        <div className="mt-2 text-sm">
          <strong>Status:</strong> {user?.email ? "Signed In" : "Not Signed In"}
        </div>
      </div>

      <div className="card p-4">
        {user?.email ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Signed in as</div>
              <div className="font-medium">{user.email}</div>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded border px-4 py-2 hover:bg-slate-50"
                onClick={onSignOut}
              >
                Sign Out
              </button>
              {/* Optional: switch account quickly */}
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
            <div className="text-slate-600 text-sm">
              You are not signed in.
            </div>
            <button
              className="rounded bg-slate-900 text-white px-4 py-2"
              onClick={forceShowLogin}
            >
              Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
