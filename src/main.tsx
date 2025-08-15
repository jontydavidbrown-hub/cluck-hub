import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import Dashboard from "./pages/Dashboard";
import DailyLog from "./pages/DailyLog";
import Weights from "./pages/Weights";
import FeedSilos from "./pages/FeedSilos";
import Water from "./pages/Water";
import Reminders from "./pages/Reminders";
import Setup from "./pages/Setup";
import User from "./pages/User";
import Analytics from "./pages/Analytics";
import Members from "./pages/Members";
import { FarmProvider } from "./lib/FarmContext";
import "./index.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "daily", element: <DailyLog /> },
      { path: "weights", element: <Weights /> },
      { path: "feed", element: <FeedSilos /> },
      { path: "water", element: <Water /> },
      { path: "reminders", element: <Reminders /> },
      { path: "setup", element: <Setup /> },
      { path: "analytics", element: <Analytics /> },
      { path: "members", element: <Members /> },
      { path: "user", element: <User /> }
    ]
  }
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FarmProvider>
      <RouterProvider router={router} />
    </FarmProvider>
  </React.StrictMode>
);
