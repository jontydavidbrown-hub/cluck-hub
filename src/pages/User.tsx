import { useEffect } from "react";
import { useServerState } from "../lib/serverState";
import { me, logout } from "../lib/session";

export default function User() {
  const { state: user, setState: setUser } = useServerState<{ email: string } | null>("user", null);

  // On mount, sync session -> user state
  useEffect(() => {
    (async () => {
      try {
        const u = await me();
        setUser(u?.email ? u : null);
      } catch {
        setUser(null);
      }
    })();
  }, [setUser]);

  async function onSignOut() {
    try {
      await logout();
    } finally {
      // force the login lightbox to show again
      setUser(null);
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
