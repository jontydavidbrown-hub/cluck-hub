import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css"; // <-- ensures Tailwind/global styles load

import App from "./App";
import { FarmProvider } from "./lib/FarmContext";
import ErrorBoundary from "./lib/ErrorBoundary";

// --- Pages (make sure these paths/cases match your files) ---
import Dashboard from "./pages/Dashboard";
import DailyLog from "./pages/DailyLog";
import Weights from "./pages/Weights";
import Feed from "./pages/Feed";          // if your file is FeedSilos.tsx, change this import
import Water from "./pages/Water";
import Reminders from "./pages/Reminders";
import Setup from "./pages/Setup";
import Analytics from "./pages/Analytics";
import Members from "./pages/Members";
import User from "./pages/User";
// ------------------------------------------------------------

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "daily", element: <DailyLog /> },
      { path: "weights", element: <Weights /> },
      { path: "feed", element: <Feed /> },
      { path: "water", element: <Water /> },
      { path: "reminders", element: <Reminders /> },
      { path: "setup", element: <Setup /> },
      { path: "analytics", element: <Analytics /> },
      { path: "members", element: <Members /> },
      { path: "user", element: <User /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <FarmProvider>
        <RouterProvider
          router={router}
          fallbackElement={<div style={{ padding: 16 }}>Loading…</div>}
        />
      </FarmProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
