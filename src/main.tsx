// src/main.tsx
import { StrictMode } from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import "./index.css"

import App from "./App"

// PAGES — adjust names/paths to match your files in src/pages
import Dashboard from "./pages/Dashboard"    // must exist: src/pages/Dashboard.tsx
import User from "./pages/User"              // exists: src/pages/User.tsx
// Add your other pages here (uncomment + ensure files exist):
// import Setup from "./pages/Setup"
// import Reports from "./pages/Reports"
// import Jobs from "./pages/Jobs"
// import Reminders from "./pages/Reminders"

function NotFound() {
  return <div style={{ padding: 16 }}>404 Not Found</div>
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* App is your layout (sidebar/header) and MUST render <Outlet/> inside */}
        <Route path="/" element={<App />}>
          <Route index element={<Dashboard />} />
          <Route path="user" element={<User />} />
          {/* Add child routes to match your sidebar NavLinks */}
          {/* <Route path="setup" element={<Setup />} /> */}
          {/* <Route path="reports" element={<Reports />} /> */}
          {/* <Route path="jobs" element={<Jobs />} /> */}
          {/* <Route path="reminders" element={<Reminders />} /> */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
