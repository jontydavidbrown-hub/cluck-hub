// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import "./index.css";

import Dashboard from "./pages/Dashboard";
import Morts from "./pages/Morts";           // renamed Daily Log
import Weights from "./pages/Weights";
import Water from "./pages/Water";
import Feed from "./pages/Feed";
import Setup from "./pages/Setup";
import User from "./pages/User";
import Farms from "./pages/Farms";
import Reminders from "./pages/Reminders";
import Analytics from "./pages/Analytics";

import { FarmProvider } from "./lib/FarmContext";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },

      // Morts + Daily Log aliases
      { path: "/morts", element: <Morts /> },
      { path: "/daily-log", element: <Morts /> },
      { path: "/daily-logs", element: <Morts /> },

      { path: "/weights", element: <Weights /> },
      { path: "/water", element: <Water /> },
      { path: "/feed", element: <Feed /> },
      { path: "/setup", element: <Setup /> },
      { path: "/user", element: <User /> },
      { path: "/farms", element: <Farms /> },

      // keep these pages available
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
