import { useEffect, useRef, useState } from "react";
import { useServerState } from "../lib/serverState";
import { login, signup, me } from "../lib/session";

export default function LoginLightbox() {
  // Global user state lives in serverState under the "user" key
  const { state: user, setState: setUser } = useServerState<{ email: string } | null>("user", null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // On mount: check current session
  useEffect(() => {
    (async () => {
      try {
        const u = await me();
        setUser(u?.email ? u : null);
      } catch {
        setUser(null);
      }
      // Focus for convenience if we do show the lightbox
      setTimeout(() => emailRef.current?.focus(), 50);
    })();
  }, [setUser]);

  // Show only if not signed in
  const visible = !user?.email;
  if (!visible) return null;

  async function doLogin() {
    setBusy(true); setError(null);
    try {
      await login(email, password);
      const u = await me();
      setUser(u?.email ? u : null);
      setEmail(""); setPassword("");
    } catch (e: any) {
      setError(e?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function doSignup() {
    setBusy(true); setError(null);
    try {
      await signup(email, password);
      const u = await me();
      setUser(u?.email ? u : null);
      setEmail(""); setPassword("");
    } catch (e: any) {
      setError(e?.message || "Sign up failed");
    } finally {
      setBusy(false);
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") doLogin();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="card w-full max-w-md p-6 animate-fade-slide">
        <h1 className="text-xl font-semibold mb-1">Log in</h1>
        <p className="text-sm text-slate-600 mb-4">Please sign in to continue.</p>

        <div className="space-y-3">
          <label className="block">
            <div className="text-xs font-medium mb-1 text-slate-700">Email</div>
            <input
              ref={emailRef}
              type="email"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={onKey}
              placeholder="you@example.com"
              autoComplete="username"
            />
          </label>

          <label className="block">
            <div className="text-xs font-medium mb-1 text-slate-700">Password</div>
            <input
              type="password"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onKey}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              className="rounded border px-4 py-2 disabled:opacity-60"
              disabled={busy}
              onClick={doSignup}
            >
              Sign up
            </button>
            <button
              className="rounded bg-slate-900 text-white px-4 py-2 disabled:opacity-60"
              disabled={busy}
              onClick={doLogin}
            >
              Log in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
