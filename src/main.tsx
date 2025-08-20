// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import App from "./App";
import Dashboard from "./pages/Dashboard";
import Morts from "./pages/Morts";
import Weights from "./pages/Weights";
import Feed from "./pages/Feed";
import Water from "./pages/Water";
import Pickups from "./pages/Pickups";
import Reminders from "./pages/Reminders";
import Setup from "./pages/Setup";
import Farms from "./pages/Farms";
import User from "./pages/User";

import { FarmProvider } from "./lib/FarmContext";
import "./index.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "morts", element: <Morts /> },
      { path: "weights", element: <Weights /> },
      { path: "feed", element: <Feed /> },
      { path: "water", element: <Water /> },
      { path: "pickups", element: <Pickups /> },
      { path: "reminders", element: <Reminders /> },
      { path: "setup", element: <Setup /> },
      // Keep the capital F to match your existing link
      { path: "Farms", element: <Farms /> },
      { path: "user", element: <User /> },
      { path: "*", element: <div className="p-4">404 Not Found</div> },
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
