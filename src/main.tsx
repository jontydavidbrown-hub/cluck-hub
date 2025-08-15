import React from "react";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";

import App from "./App";

import Dashboard from "./pages/Dashboard";
import DailyLog from "./pages/DailyLog";
import Weights from "./pages/Weights";
import FeedSilos from "./pages/FeedSilos";
import Water from "./pages/Water";
import Reminders from "./pages/Reminders";
import Setup from "./pages/Setup";
import User from "./pages/User";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-semibold">Not found</h1>
        <p>We couldn’t find that page.</p>
        <a className="underline" href="/">Go home</a>
      </div>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: "daily-log", element: <DailyLog /> },
      { path: "weights", element: <Weights /> },
      { path: "feed-silos", element: <FeedSilos /> },
      { path: "water", element: <Water /> },
      { path: "reminders", element: <Reminders /> },
      { path: "setup", element: <Setup /> },
      { path: "user", element: <User /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
