// src/App.tsx
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import DataMenu from "./components/DataMenu";

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header: solid background, no blur/transparency */}
      <header className="sticky top-0 z-40 bg-white border-b">
        <div className="mx-auto max-w-6xl px-4">
          <div className="h-14 flex items-center justify-between gap-4">
            {/* Left: brand + hamburger */}
            <div className="flex items-center gap-3">
              <button
                className="sm:hidden inline-flex items-center justify-center rounded p-2 hover:bg-black/5"
                aria-label="Open menu"
                onClick={() => setMobileOpen((v) => !v)}
              >
                {/* hamburger */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>

              <Link to="/" className="font-semibold tracking-tight hover:opacity-90">
                Cluck Hub
              </Link>
            </div>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-2">
              <TopNavLink to="/">Dashboard</TopNavLink>
              <TopNavLink to="/setup">Setup</TopNavLink>
              <TopNavLink to="/farms">Farms</TopNavLink>

              {/* Data dropdown (Morts, Weights, Feed, Water, Reminders) */}
              <DataMenu />

              {/* User icon */}
              <NavLink
                to="/user"
                className={({ isActive }) =>
                  cx(
                    "px-2 py-2 rounded hover:bg-black/5 inline-flex items-center justify-center",
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
          <div className="sm:hidden border-t bg-white">
            <div className="mx-auto max-w-6xl px-4 py-2">
              <div className="flex flex-col gap-1 py-2">
                <MobileLink to="/">Dashboard</MobileLink>
                <MobileLink to="/setup">Setup</MobileLink>
                <MobileLink to="/farms">Farms</MobileLink>

                {/* Data section on mobile (list) */}
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
        <div className="mx-auto max-w-6xl px-4 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function TopNavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cx(
          "px-3 py-2 rounded hover:bg-black/5",
          isActive && "bg-black/5 font-medium"
        )
      }
      end={to === "/"}
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
          "px-3 py-2 rounded hover:bg-black/5",
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
