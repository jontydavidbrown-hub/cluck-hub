// src/main.tsx (createBrowserRouter variant)
import { StrictMode } from "react"
import ReactDOM from "react-dom/client"
import { createBrowserRouter, RouterProvider } from "react-router-dom"

import App from "./App"
import User from "./pages/User"

// TODO: import your other pages here
// import Dashboard from "./pages/Dashboard"
// import Setup from "./pages/Setup"
// etc.

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    // If your App renders an <Outlet/>, use children:
    children: [
      // existing child routes:
      // { path: "", element: <Dashboard /> },
      // { path: "setup", element: <Setup /> },

      // NEW user route (child of "/")
      { path: "user", element: <User /> },
    ],
  },
  // If you have any top-level routes (not under App), keep them here.
])

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
