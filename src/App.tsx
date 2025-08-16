import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useFarm } from "./lib/FarmContext";
import { useMemo } from "react";

function HeaderFarmSelector() {
  const { farms = [], farmId, setFarmId, createFarm } = useFarm() as any;

  // Guard against uninitialised farms (prevents e.map crash)
  if (!Array.isArray(farms) || farms.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <select
        className="border rounded-lg px-2 py-1 bg-white/80 backdrop-blur-sm shadow-sm"
        value={farmId ?? (farms[0]?.id ?? "")}
        onChange={(e) => setFarmId(e.target.value)}
      >
        {farms.map((f: any) => (
          <option key={f.id} value={f.id}>
            {f.name || "Farm " + f.id.slice(0, 4)}
          </option>
        ))}
      </select>
      <button
        className="px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 bg-white/80 hover:bg-white shadow-sm transition"
        onClick={() => {
          const name = prompt("New farm name?") || undefined;
          createFarm?.(name);
        }}
      >
        + New farm
      </button>
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

export default function App() {
  const location = useLocation();
  const routeKey = useMemo(() => location.pathname, [location.pathname]);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-white relative">
      {/* Decorative soft blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-20 -left-32 w-96 h-96 rounded-full bg-emerald-200/40 blur-3xl animate-blob" />
        <div className="absolute top-1/3 -right-24 w-96 h-96 rounded-full bg-lime-200/40 blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute bottom-0 left-1/3 w-[28rem] h-[28rem] rounded-full bg-amber-100/40 blur-3xl animate-blob animation-delay-4000" />
      </div>

      <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/80 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            <Brand />
            <nav className="hidden md:flex items-center gap-1 text-sm">
              <NavItem to="/">Dashboard</NavItem>
              <NavItem to="/daily-log">Daily Log</NavItem>
              <NavItem to="/weights">Weights</NavItem>
              <NavItem to="/feed-silos">Feed Silos</NavItem>
              <NavItem to="/water">Water</NavItem>
              <NavItem to="/reminders">Reminders</NavItem>
              <NavItem to="/setup">Setup</NavItem>
              <NavItem to="/analytics">Analytics</NavItem>
              <NavItem to="/members">Members</NavItem>
              <NavItem to="/user">User</NavItem>
            </nav>
            <HeaderFarmSelector />
          </div>
        </div>
      </header>

      <main className="relative">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {/* Route transition wrapper (UI-only, no logic change) */}
          <div key={routeKey} className="animate-fade-slide">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
