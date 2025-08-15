import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/daily-log", label: "Daily Log" },
  { to: "/weights", label: "Weights" },
  { to: "/feed-silos", label: "Feed & Silos" },
  { to: "/water", label: "Water" },
  { to: "/reminders", label: "Reminders" },
  { to: "/setup", label: "Setup" },
  { to: "/user", label: "User" },
];

export default function App() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [loc.pathname]);

  // Swipe gesture (mobile)
  useSwipeDrawer(open, setOpen);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 rounded-lg border"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              ☰
            </button>
            <a href="/" className="font-bold">Cluck Hub</a>
          </div>
          <nav className="hidden md:flex gap-1">
            {links.map((l) => (
              <DesktopItem key={l.to} to={l.to} label={l.label} />
            ))}
          </nav>
        </div>
      </header>

      {/* Mobile slide-in sidebar + overlay */}
      <div className={`md:hidden fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}>
        {/* overlay */}
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
        {/* drawer */}
        <aside
          className={`absolute top-0 left-0 h-full w-[260px] bg-white shadow-xl border-r
                      transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"}`}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <div className="p-4 border-b flex items-center justify-between">
            <div className="font-semibold">Menu</div>
            <button className="p-2" onClick={() => setOpen(false)} aria-label="Close menu">✕</button>
          </div>
          <nav className="p-2">
            {links.map((l) => (
              <MobileItem key={l.to} to={l.to} label={l.label} onClick={() => setOpen(false)} />
            ))}
          </nav>
        </aside>
      </div>

      {/* Page content */}
      <main className="mx-auto max-w-7xl p-4">
        <Outlet />
      </main>
    </div>
  );
}

function DesktopItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        "block px-3 py-2 rounded-lg text-sm " +
        (isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100")
      }
    >
      {label}
    </NavLink>
  );
}

function MobileItem({
  to,
  label,
  onClick,
}: {
  to: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <NavLink
      to={to}
      end
      onClick={onClick}
      className={({ isActive }) =>
        "block px-4 py-3 text-base rounded-lg " +
        (isActive ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-50")
      }
    >
      {label}
    </NavLink>
  );
}

/** Minimal swipe detection for the drawer on mobile */
function useSwipeDrawer(open: boolean, setOpen: (v: boolean) => void) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const tracking = useRef<"open" | "close" | null>(null);

  useEffect(() => {
    function isMobile() {
      return window.innerWidth < 768; // Tailwind's md breakpoint
    }

    function onTouchStart(e: TouchEvent) {
      if (!isMobile()) return;
      const t = e.touches[0];
      startX.current = t.clientX;
      startY.current = t.clientY;

      // If closed, track only if swipe starts from left edge (<=24px)
      if (!open && t.clientX <= 24) {
        tracking.current = "open";
      }
      // If open, track a left swipe anywhere
      else if (open) {
        tracking.current = "close";
      } else {
        tracking.current = null;
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (!isMobile() || !tracking.current || startX.current == null || startY.current == null) return;
      const t = e.touches[0];
      const dx = t.clientX - startX.current;
      const dy = t.clientY - startY.current;
      // ignore mostly vertical swipes
      if (Math.abs(dy) > 80) return;

      if (tracking.current === "open" && dx > 50) {
        setOpen(true);
        tracking.current = null;
      }
      if (tracking.current === "close" && dx < -50) {
        setOpen(false);
        tracking.current = null;
      }
    }

    function onTouchEnd() {
      tracking.current = null;
      startX.current = null;
      startY.current = null;
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [open, setOpen]);
}
