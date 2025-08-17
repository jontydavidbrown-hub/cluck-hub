import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";

import Dashboard from "./pages/Dashboard";
import DailyLog from "./pages/DailyLog";
import Weights from "./pages/Weights";
import Water from "./pages/Water";
import Feed from "./pages/Feed";
import Setup from "./pages/Setup";
import User from "./pages/User";
import Farms from "./pages/Farms"; // Farms page (includes Members)
import { FarmProvider } from "./lib/FarmContext"; // ✅ wrap the whole app

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "/daily-log", element: <DailyLog /> }, // keep your existing path
      { path: "/weights", element: <Weights /> },
      { path: "/water", element: <Water /> },
      { path: "/feed", element: <Feed /> },
      { path: "/setup", element: <Setup /> },
      { path: "/user", element: <User /> },
      { path: "/farms", element: <Farms /> },        // new combined page
      // { path: "/members", element: <Members /> },  // removed
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* ✅ Ensure every route is inside the Farm context */}
    <FarmProvider>
      <RouterProvider router={router} />
    </FarmProvider>
  </React.StrictMode>
);
