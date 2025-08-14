// src/main.tsx
import { StrictMode } from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import "./index.css"

import App from "./App"
import Dashboard from "./pages/Dashboard"    // adjust path/name if different
import User from "./pages/User"              // the new page

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* App is the layout that contains your sidebar/header */}
        <Route path="/" element={<App />}>
          {/* index = "/" */}
          <Route index element={<Dashboard />} />
          {/* child routes render inside App via <Outlet /> */}
          <Route path="user" element={<User />} />
          {/* add your other tabs here, e.g.: */}
          {/* <Route path="setup" element={<Setup />} /> */}
          {/* <Route path="reports" element={<Reports />} /> */}
        </Route>

        {/* fallback */}
        <Route path="*" element={<div style={{ padding: 16 }}>404 Not Found</div>} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
