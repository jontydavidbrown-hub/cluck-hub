// src/App.tsx
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

export default function App() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-header">
          <h1 className="logo">Cluck Hub</h1>
          <button
            className="sidebar-toggle"
            onClick={() => setOpen((prev) => !prev)}
          >
            ☰
          </button>
        </div>

        <nav className="sidebar-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `nav-item ${isActive ? "active" : ""}`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/user"
            className={({ isActive }) =>
              `nav-item ${isActive ? "active" : ""}`
            }
          >
            User
          </NavLink>
          {/* Uncomment/add your real pages here */}
          {/* <NavLink to="/setup" className="nav-item">Setup</NavLink> */}
          {/* <NavLink to="/reports" className="nav-item">Reports</NavLink> */}
          {/* <NavLink to="/jobs" className="nav-item">Jobs</NavLink> */}
        </nav>
      </aside>

      {/* Main content */}
      <main className="content">
        {/* This is where your page content will load */}
        <Outlet />
      </main>
    </div>
  );
}
