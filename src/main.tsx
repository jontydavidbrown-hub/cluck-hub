// src/main.tsx
import { StrictMode } from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import "./index.css"

import App from "./App"               // your shell/landing if you use it as a page
import User from "./pages/User"       // the new page
// Import your existing pages below:
import Dashboard from "./pages/Dashboard"      // adjust path/name if different
// import Setup from "./pages/Setup"           // example

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Top-level routes */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/user" element={<User />} />
        {/* Keep your other tabs here as needed */}
        {/* <Route path="/setup" element={<Setup />} /> */}
        {/* If you want App as a separate page, keep this too: */}
        {/* <Route path="/home" element={<App />} /> */}
        <Route path="*" element={<div style={{padding:16}}>404 Not Found</div>} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
