import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import "./index.css";

import Dashboard from "./pages/Dashboard";
import DailyLog from "./pages/DailyLog";
import Weights from "./pages/Weights";
import Water from "./pages/Water";
import Feed from "./pages/Feed";
import Setup from "./pages/Setup";
import User from "./pages/User";
import Farms from "./pages/Farms";
import Reminders from "./pages/Reminders"; // ✅ add
import Analytics from "./pages/Analytics"; // ✅ add
import { FarmProvider } from "./lib/FarmContext";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },

      // Daily logs: support both singular and plural
      { path: "/daily-log", element: <DailyLog /> },
      { path: "/daily-logs", element: <DailyLog /> },   // ✅ alias to avoid 404

      { path: "/weights", element: <Weights /> },
      { path: "/water", element: <Water /> },
      { path: "/feed", element: <Feed /> },
      { path: "/setup", element: <Setup /> },
      { path: "/user", element: <User /> },
      { path: "/farms", element: <Farms /> },

      // ✅ new routes so existing nav links work
      { path: "/reminders", element: <Reminders /> },
      { path: "/analytics", element: <Analytics /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FarmProvider>
      <RouterProvider router={router} />
    </FarmProvider>
  </React.StrictMode>
);
