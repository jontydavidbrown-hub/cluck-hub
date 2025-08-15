import { Outlet, NavLink } from "react-router-dom";
import { useFarm } from "./lib/FarmContext";

function HeaderFarmSelector() {
  const { farms = [], farmId, setFarmId, createFarm } = useFarm() as any;

  // If farms aren’t initialised yet, don’t render the selector (prevents e.map crash)
  if (!Array.isArray(farms) || farms.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <select
        className="border rounded px-2 py-1"
        value={farmId ?? (farms[0]?.id ?? "")}
        onChange={(e) => setFarmId(e.target.value)}
      >
        {farms.map((f: any) => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>
      <button
        className="text-sm underline"
        onClick={async () => {
          const name = prompt("New farm name?");
          if (name && createFarm) await createFarm(name);
        }}
      >
        + New Farm
      </button>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen grid grid-rows-[auto,1fr]">
      <header className="flex items-center justify-between p-3 border-b bg-white">
        <div className="flex items-center gap-4">
          <div className="font-bold">Cluck Hub</div>
          <nav className="hidden md:flex gap-2">
            <NavLink to="/" end className="px-3 py-2 rounded hover:bg-gray-100">Dashboard</NavLink>
            <NavLink to="/daily" className="px-3 py-2 rounded hover:bg-gray-100">Daily</NavLink>
            <NavLink to="/weights" className="px-3 py-2 rounded hover:bg-gray-100">Weights</NavLink>
            <NavLink to="/feed" className="px-3 py-2 rounded hover:bg-gray-100">Feed</NavLink>
            <NavLink to="/water" className="px-3 py-2 rounded hover:bg-gray-100">Water</NavLink>
            <NavLink to="/reminders" className="px-3 py-2 rounded hover:bg-gray-100">Reminders</NavLink>
            <NavLink to="/setup" className="px-3 py-2 rounded hover:bg-gray-100">Setup</NavLink>
            <NavLink to="/analytics" className="px-3 py-2 rounded hover:bg-gray-100">Analytics</NavLink>
            <NavLink to="/members" className="px-3 py-2 rounded hover:bg-gray-100">Members</NavLink>
            <NavLink to="/user" className="px-3 py-2 rounded hover:bg-gray-100">User</NavLink>
          </nav>
        </div>
        <HeaderFarmSelector />
      </header>
      <main className="bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
