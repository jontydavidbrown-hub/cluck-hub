import type React from "react";
// src/components/CredentialLightbox.tsx
import { useEffect, useState } from "react";
import { me, login, signup, logout } from "../lib/session";

/**
 * Full-screen credential lightbox displayed on app load until the user logs in.
 * Mount this near the top of your root layout (above <Outlet/> or inside App).
 */
export default function CredentialLightbox() {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");
  const [authedEmail, setAuthedEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const who = await me();
        setAuthedEmail(who.email);
      } catch (e: any) {
        // ignore
      } finally {
        setReady(true);
      }
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(email, password);
      }
      const who = await me();
      setAuthedEmail(who.email);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function doLogout() {
    await logout();
    setAuthedEmail(null);
    setEmail("");
    setPassword("");
    setMode("login");
  }

  if (!ready || authedEmail) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[92%] max-w-md rounded-2xl bg-white shadow-xl p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Welcome to Cluck Hub</h2>
          <p className="text-sm text-gray-600">Sign in to continue.</p>
        </div>

        {error && (
          <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              className="border rounded px-3 py-2 w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Password</label>
            <input
              type="password"
              className="border rounded px-3 py-2 w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className={`rounded px-4 py-2 text-white ${busy ? "bg-gray-500" : "bg-black"}`}
          >
            {busy ? (mode === "login" ? "Signing in…" : "Creating…") : (mode === "login" ? "Sign in" : "Create account")}
          </button>
        </form>

        <div className="mt-3 text-sm">
          {mode === "login" ? (
            <button className="underline" onClick={() => setMode("signup")}>
              New here? Create an account
            </button>
          ) : (
            <button className="underline" onClick={() => setMode("login")}>
              Already have an account? Sign in
            </button>
          )}
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Your account is stored securely. Passwords are hashed on the server and sessions use HttpOnly cookies.
        </div>
      </div>
    </div>
  );
}
