// src/App.tsx
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

// Optional: import your app-wide styles if they live here (usually in main.tsx)
// import "./index.css";

export default function App() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false); // if you have a collapsible sidebar; remove if unused

  return (
    <div className="app-shell" data-path={pathname} style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar / Tabs */}
      <aside
        className="sidebar"
        style={{
          width: 240,
          padding: 16,
          borderRight: "1px solid #eee",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Cluck Hub</div>
        <nav className="tabs" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/user">User</NavLink>
          {/* Add your other tabs here, e.g.: */}
          {/* <NavLink to="/setup">Setup</NavLink> */}
          {/* <NavLink to="/reports">Reports</NavLink> */}
        </nav>
        {/* If you truly use `open`, add a toggle button; otherwise remove state above */}
        {/* <button onClick={() => setOpen(o => !o)}>{open ? "Close" : "Open"} menu</button> */}
      </aside>

      {/* Main content area */}
      <main className="content" style={{ flex: 1, padding: 16 }}>
        {/* Child routes render right here */}
        <Outlet />
      </main>
    </div>
  );
}
