// src/App.tsx
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// Reusable top-nav item with animated underline (matches your original vibe)
function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cx(
          "group relative px-3 py-2 rounded transition-all",
          "hover:bg-black/5 active:scale-[0.98]",
          isActive && "bg-black/5 font-medium"
        )
      }
      end={to === "/"}
    >
      <span className="relative">
        {children}
        <span className="pointer-events-none absolute -bottom-0.5 left-0 right-0 mx-auto h-0.5 w-0 rounded-full bg-slate-900/30 transition-all duration-200 group-hover:w-full" />
      </span>
    </NavLink>
  );
}

export default function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false); // desktop dropdown
  const location = useLocation();

  // Close menus on route change
  useEffect(() => {
    setMobileOpen(false);
    setDataOpen(false);
  }, [location.pathname, location.search]);

  // Close Data dropdown on outside click / ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDataOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-dvh flex flex-col relative">
      {/* Gradient background behind app (restores the colored backdrop) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br from-indigo-100 via-white to-emerald-100"
      />

      {/* Header: translucent + blur with subtle border/shadow */}
      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-b border-black/10 shadow-sm">
        <div className="mx-auto max-w-6xl px-4">
          <div className="h-14 flex items-center justify-between gap-4">
            {/* Left: brand + hamburger */}
            <div className="flex items-center gap-3">
              <button
                className="sm:hidden inline-flex items-center justify-center rounded p-2 transition hover:bg-black/5 active:scale-[0.98]"
                aria-label="Open menu"
                onClick={() => setMobileOpen((v) => !v)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>

              <Link to="/" className="font-semibold tracking-tight hover:opacity-90 transition">
                Cluck Hub
              </Link>
            </div>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-1">
              <NavItem to="/">Dashboard</NavItem>
              <NavItem to="/setup">Setup</NavItem>
              <NavItem to="/farms">Farms</NavItem>

              {/* Data dropdown (Morts, Weights, Feed Silos, Water, Reminders) */}
              <div className="relative">
                <button
                  type="button"
                  className={cx(
                    "group relative px-3 py-2 rounded transition-all",
                    "hover:bg-black/5 active:scale-[0.98] inline-flex items-center gap-1"
                  )}
                  onClick={() => setDataOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={dataOpen}
                >
                  <span className="relative">
                    Data
                    <span className="pointer-events-none absolute -bottom-0.5 left-0 right-0 mx-auto h-0.5 w-0 rounded-full bg-slate-900/30 transition-all duration-200 group-hover:w-full" />
                  </span>
                  <svg className={cx("h-4 w-4 transition-transform", dataOpen && "rotate-180")} viewBox="0 0 20 20" fill="currentColor">
                    <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" />
                  </svg>
                </button>

                {dataOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-48 rounded-md border bg-white shadow-lg p-1 z-50"
                    onMouseLeave={() => setDataOpen(false)}
                  >
                    <MenuItem to="/morts" onClick={() => setDataOpen(false)}>Morts</MenuItem>
                    <MenuItem to="/weights" onClick={() => setDataOpen(false)}>Weights</MenuItem>
                    <MenuItem to="/feed" onClick={() => setDataOpen(false)}>Feed Silos</MenuItem>
                    <MenuItem to="/water" onClick={() => setDataOpen(false)}>Water</MenuItem>
                    <MenuItem to="/reminders" onClick={() => setDataOpen(false)}>Reminders</MenuItem>
                  </div>
                )}
              </div>

              {/* User icon */}
              <NavLink
                to="/user"
                className={({ isActive }) =>
                  cx(
                    "px-2 py-2 rounded inline-flex items-center justify-center transition-all",
                    "hover:bg-black/5 active:scale-[0.98]",
                    isActive && "bg-black/5"
                  )
                }
                aria-label="User"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                     fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M12 2.25a4.5 4.5 0 0 0-4.5 4.5v.75a4.5 4.5 0 1 0 9 0v-.75A4.5 4.5 0 0 0 12 2.25Zm-7.5 15a5.25 5.25 0 0 1 5.25-5.25h6.5A5.25 5.25 0 0 1 21 17.25v.5a3 3 0 0 1-3 3H7.5a3 3 0 0 1-3-3v-.5Z" clipRule="evenodd" />
                </svg>
                <span className="sr-only">User</span>
              </NavLink>
            </nav>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="sm:hidden border-t bg-white/90 backdrop-blur animate-fade-slide">
            <div className="mx-auto max-w-6xl px-4 py-2">
              <div className="flex flex-col gap-1 py-2">
                <MobileLink to="/">Dashboard</MobileLink>
                <MobileLink to="/setup">Setup</MobileLink>
                <MobileLink to="/farms">Farms</MobileLink>
                <div className="mt-2">
                  <div className="px-2 py-1 text-xs uppercase tracking-wide text-slate-500">Data</div>
                  <div className="mt-1 flex flex-col">
                    <MobileLink to="/morts">Morts</MobileLink>
                    <MobileLink to="/weights">Weights</MobileLink>
                    <MobileLink to="/feed">Feed Silos</MobileLink>
                    <MobileLink to="/water">Water</MobileLink>
                    <MobileLink to="/reminders">Reminders</MobileLink>
                  </div>
                </div>
                <MobileLink to="/user" icon>
                  <span className="inline-flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                         fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M12 2.25a4.5 4.5 0 0 0-4.5 4.5v.75a4.5 4.5 0 1 0 9 0v-.75A4.5 4.5 0 0 0 12 2.25Zm-7.5 15a5.25 5.25 0 0 1 5.25-5.25h6.5A5.25 5.25 0 0 1 21 17.25v.5a3 3 0 0 1-3 3H7.5a3 3 0 0 1-3-3v-.5Z" clipRule="evenodd" />
                    </svg>
                    <span>User</span>
                  </span>
                </MobileLink>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6 animate-fade-slide">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function MenuItem({
  to,
  onClick,
  children,
}: {
  to: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cx(
          "block rounded px-3 py-2 text-sm transition",
          isActive ? "bg-black/5 font-medium" : "hover:bg-black/5"
        )
      }
      role="menuitem"
    >
      {children}
    </NavLink>
  );
}

function MobileLink({
  to,
  children,
  icon,
}: {
  to: string;
  children?: React.ReactNode;
  icon?: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cx(
          "px-3 py-2 rounded transition-all",
          "hover:bg-black/5 active:scale-[0.99]",
          isActive && "bg-black/5 font-medium",
          icon && "inline-flex items-center gap-2"
        )
      }
      end={to === "/"}
    >
      {children ?? to}
    </NavLink>
  );
}
