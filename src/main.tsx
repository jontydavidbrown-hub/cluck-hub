import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import App from "./App";

// Pages
import Dashboard from "./pages/Dashboard";
import DailyLog from "./pages/DailyLog";
import Weights from "./pages/Weights";
import Feed from "./pages/FeedSilos";
import Water from "./pages/Water";
import Reminders from "./pages/Reminders";
import Setup from "./pages/Setup";
import Analytics from "./pages/Analytics";
import Members from "./pages/Members";
import User from "./pages/User";

import ErrorBoundary from "./pages/ErrorBoundary";

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
      <RouterProvider router={router} fallbackElement={<div style={{padding:16}}>Loading…</div>} />
    </ErrorBoundary>
  </React.StrictMode>
);
