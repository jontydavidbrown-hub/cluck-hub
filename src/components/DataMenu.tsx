import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

export default function DataMenu() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();

  // Close on route change
  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);

  // Close on outside click / ESC
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        className="px-3 py-2 rounded hover:bg-black/5"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Data ▾
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute z-50 mt-2 w-48 rounded-md border bg-white shadow-lg p-1"
          role="menu"
        >
          <NavItem to="/morts" label="Morts" />
          <NavItem to="/weights" label="Weights" />
          <NavItem to="/feed" label="Feed Silos" />
          <NavItem to="/water" label="Water" />
          <NavItem to="/reminders" label="Reminders" />
        </div>
      )}
    </div>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "block rounded px-3 py-2 text-sm",
          isActive ? "bg-black/5 font-medium" : "hover:bg-black/5",
        ].join(" ")
      }
      role="menuitem"
    >
      {label}
    </NavLink>
  );
}
