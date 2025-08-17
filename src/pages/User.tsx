import { useEffect } from "react";
import { useCloudSlice } from "../lib/cloudSlice";
import { me, logout } from "../lib/session";

export default function User() {
  const { state: user, setState: setUser } = useCloudSlice<{ email: string } | null>("user", null);

  // ✅ Run once on mount only (prevents loops)
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
  }, []); // ← IMPORTANT

  async function onSignOut() {
    try {
      await logout();
    } finally {
      setUser(null); // force login modal to reappear
    }
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
            <button
              className="rounded border px-4 py-2 hover:bg-slate-50"
              onClick={onSignOut}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="text-slate-600 text-sm">
            You are not signed in. The login lightbox should be visible.
          </div>
        )}
      </div>
    </div>
  );
}
