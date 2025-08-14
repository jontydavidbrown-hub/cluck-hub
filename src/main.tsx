// src/main.tsx
import React from "react";
import User from "./pages/User"
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";

// Root layout that renders your nested pages via <Outlet/> inside App
import App from "./App";

// Pages (use your existing files)
import Dashboard from "./pages/Dashboard";
import DailyLog from "./pages/DailyLog";
import Weights from "./pages/Weights";
import FeedSilos from "./pages/FeedSilos";
import Reminders from "./pages/Reminders";
import Setup from "./pages/Setup";

// NEW: in-app credential Lightbox (email+password)
import CredentialLightbox from "./components/CredentialLightbox";

// Wrap App so the Lightbox shows immediately on load
function RootWithLightbox() {
  return (
    <>
      <CredentialLightbox />
      <App />
    </>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootWithLightbox />,
    // Friendly error boundary instead of the default RR error page
    errorElement: (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Oops</h1>
        <p>Something went wrong or this page doesn’t exist.</p>
        <a className="underline" href="/">Go home</a>
      </div>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: "daily-log", element: <DailyLog /> },
      { path: "weights", element: <Weights /> },
      { path: "feed-silos", element: <FeedSilos /> },
      { path: "reminders", element: <Reminders /> },
      { path: "setup", element: <Setup /> },
      { path: "/user", element: <User /> },

      

      // (Optional) Catch-all for unknown routes
      {
        path: "*",
        element: (
          <div className="p-6">
            <h1 className="text-xl font-semibold">Not found</h1>
            <p>We couldn’t find that page.</p>
            <a className="underline" href="/">Go home</a>
          </div>
        ),
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
