// src/App.tsx
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useMemo, useEffect, useRef, useState } from "react";
import { useFarm } from "./lib/FarmContext";
import { useServerState } from "./lib/serverState";
import { login, signup, me } from "./lib/session";

function LoginLightboxInline() {
  const { state: user, setState: setUser } = useServerState<{ email: string } | null>("user", null);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null); const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const failsafe = setTimeout(() => { if (!cancelled) setChecked(true); }, 1500); // show anyway after 1.5s
    (async () => {
      try {
        const u = await me();                      // must return null on 401
        if (!cancelled) setUser(u?.email ? u : null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setChecked(true);
        clearTimeout(failsafe);
      }
    })();
    return () => { cancelled = true; clearTimeout(failsafe); };
  }, []); // run once

  const emailOk = /\S+@\S+\.\S+/.test(email);
  const passOk = password.length >= 6;
  function showError(msg: string, focus: "email" | "password" = "password") {
    setError(msg);
    requestAnimationFrame(() => (focus === "password" ? passwordRef : emailRef).current?.focus());
  }

  async function doLogin() {
    if (!emailOk || !passOk) return showError("Email and password (6+ chars) required", !emailOk ? "email" : "password");
    setBusy(true); setError(null);
    try {
      await login(email, password);
      const u = await me();
      setUser(u?.email ? u : null);
      setEmail(""); setPassword("");
    } catch (e: any) { showError(e?.message || "Invalid email or password"); }
    finally { setBusy(false); }
  }
  async function doSignup() {
    if (!emailOk || !passOk) return showError("Email and password (6+ chars) required", !emailOk ? "email" : "password");
    setBusy(true); setError(null);
    try {
      await signup(email, password);
      const u = await me();
      setUser(u?.email ? u : null);
      setEmail(""); setPassword("");
    } catch (e: any) {
      const msg = String(e?.message || "");
      showError(/already exists/i.test(msg) ? "Account already exists — please Log in instead." : msg || "Sign up failed", /exists/i.test(msg) ? "email" : "password");
    } finally { setBusy(false); }
  }

  // URL override: add ?forceLogin=1 to always show modal (debug)
  const force = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("forceLogin") === "1";
  const visible = (checked || force) && !user?.email;
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="card w-full max-w-md p-6 animate-fade-slide" onClick={(e) => e.stopPropagation()}>
        <h1 className="text-xl font-semibold mb-1">Log in</h1>
        <p className="text-sm text-slate-600 mb-4">Please sign in to continue.</p>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); doLogin(); }}>
          <label className="block">
            <div className="text-xs font-medium mb-1 text-slate-700">Email</div>
            <input ref={emailRef} type="email" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="username" />
          </label>
          <label className="block">
            <div className="text-xs font-medium mb-1 text-slate-700">Password</div>
            <input ref={passwordRef} type="password" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          </label>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" className="rounded border px-4 py-2 disabled:opacity-60" disabled={busy || !emailOk || !passOk} onClick={doSignup}>Sign up</button>
            <button type="submit" className="rounded bg-slate-900 text-white px-4 py-2 disabled:opacity-60" disabled={busy || !emailOk || !passOk}>Log in</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Hardened selector: filters null/invalid farms and ensures a valid value is always selected
function HeaderFarmSelector() {
  const { farms = [], farmId, setFarmId } = useFarm() as any;

  const list = Array.isArray(farms)
    ? farms.filter((f: any) => f && typeof f === "object" && typeof f.id === "string")
    : [];

  if (list.length === 0) return null;

  const current = list.find((f: any) => f.id === farmId)?.id ?? list[0].id;

  return (
    <div className="flex items-center gap-2">
      <select
        className="border rounded-lg px-2 py-1 bg-white/80 backdrop-blur-sm shadow-sm"
        value={current}
        onChange={(e) => setFarmId?.(e.target.value)}
      >
        {list.map((f: any) => (
          <option key={f.id} value={f.id}>
            {f.name || "Farm " + String(f.id).slice(0, 4)}
          </option>
        ))}
      </select>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <div className="size-8 rounded-xl bg-gradient-to-br from-emerald-400 to-lime-500 shadow-inner" />
      <span className="font-semibold tracking-tight text-slate-900">Cluck Hub</span>
    </div>
  );
}

function NavItem({ to, children }: { to: string; children: any }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "relative px-3 py-2 rounded-xl transition-colors",
          "hover:bg-slate-900/5",
          isActive ? "text-slate-900" : "text-slate-600",
        ].join(" ")
      }
    >
      {({ isActive }) => (
        <span className="inline-flex items-center gap-2">
          <span>{children}</span>
          <span
            className={[
              "absolute left-1/2 -translate-x-1/2 -bottom-1 h-0.5 w-6 rounded-full transition-all",
              isActive ? "bg-emerald-500 scale-100 opacity-100" : "scale-0 opacity-0",
            ].join(" ")}
          />
        </span>
      )}
    </NavLink>
  );
}

/** Mobile drawer (unchanged visuals, updated links) */
function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    try {
      if (open) {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
          document.body.style.overflow = prev;
        };
      }
    } catch {}
  }, [open]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const links = [
    { to: "/", label: "Dashboard" },
    { to: "/morts", label: "Morts" },
    { to: "/weights", label: "Weights" },
    { to: "/feed", label: "Feed" },
    { to: "/water", label: "Water" },
    { to: "/pickups", label: "Pickups" },
    { to: "/reminders", label: "Reminders" },
    { to: "/setup", label: "Setup" },
    { to: "/Farms", label: "Farms" },
    { to: "/user", label: "User" },
  ];

  return (
    <>
      <div
        className={[
          "fixed inset-0 z-[8000] bg-black/30 backdrop-blur-sm transition-opacity md:hidden",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={[
          "fixed top-0 left-0 z-[8050] h-full w-72 bg-white shadow-xl md:hidden transition-transform",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        role="dialog"
        aria-label="Mobile navigation"
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-gradient-to-br from-emerald-400 to-lime-500" />
            <span className="font-semibold">Cluck Hub</span>
          </div>
          <button className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close menu" onClick={onClose}>
            ✕
          </button>
        </div>
        <nav className="p-2">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                ["block px-3 py-2 rounded-lg", "hover:bg-slate-100 transition", isActive ? "bg-slate-100 font-medium" : "text-slate-700"].join(" ")
              }
              onClick={onClose}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}

export default function App() {
  const location = useLocation();
  const routeKey = useMemo(() => location.pathname, [location.pathname]);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-white relative">
      {/* animated soft blobs background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-20 -left-32 w-96 h-96 rounded-full bg-emerald-200/40 blur-3xl animate-blob" />
        <div className="absolute top-1/3 -right-24 w-96 h-96 rounded-full bg-lime-200/40 blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute bottom-0 left-1/3 w-[28rem] h-[28rem] rounded-full bg-amber-100/40 blur-3xl animate-blob animation-delay-4000" />
      </div>

      <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/80 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button className="md:hidden rounded-lg p-2 hover:bg-slate-100" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
                <span className="block w-5 h-0.5 bg-slate-800 mb-1"></span>
                <span className="block w-5 h-0.5 bg-slate-800 mb-1"></span>
                <span className="block w-5 h-0.5 bg-slate-800"></span>
              </button>
              <Brand />
            </div>

            <nav className="hidden md:flex items-center gap-1 text-sm">
              <NavItem to="/">Dashboard</NavItem>
              <NavItem to="/morts">Morts</NavItem>
              <NavItem to="/weights">Weights</NavItem>
              <NavItem to="/feed">Feed</NavItem>
              <NavItem to="/water">Water</NavItem>
              <NavItem to="/pickups">Pickups</NavItem>
              <NavItem to="/reminders">Reminders</NavItem>
              <NavItem to="/setup">Setup</NavItem>
              <NavItem to="/Farms">Farms</NavItem>
              <NavItem to="/user">User</NavItem>
            </nav>

            <HeaderFarmSelector />
          </div>
        </div>
      </header>

      <main className="relative">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <div key={routeKey} className="animate-fade-slide">
            <Outlet />
          </div>
        </div>
      </main>

      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <LoginLightboxInline />
    </div>
  );
}
