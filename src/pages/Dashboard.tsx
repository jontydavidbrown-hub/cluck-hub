import { useMemo } from "react";
import { useCloudSlice } from "../lib/cloudSlice";

type Shed = {
  id: string;
  name: string;
  placementDate?: string;
  placementBirds?: number;
  birdsPlaced?: number;
};

export default function Dashboard() {
  // Read the same slice Setup writes to
  const [sheds] = useCloudSlice<Shed[]>("sheds", []);

  const stats = useMemo(() => {
    const list = sheds || [];
    const count = list.length;

    const birdsTotal = list.reduce((n, s) => {
      const v = Number(s.birdsPlaced ?? s.placementBirds) || 0;
      return n + v;
    }, 0);

    // Most recent non-empty placement date
    const dates = list
      .map((s) => s.placementDate || "")
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    const latestPlacement = dates.length ? dates[dates.length - 1] : null;

    return { count, birdsTotal, latestPlacement };
  }, [sheds]);

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* Summary tiles */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-xs text-slate-500">Sheds</div>
          <div className="text-2xl font-semibold">{stats.count}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500">Birds placed (total)</div>
          <div className="text-2xl font-semibold">{stats.birdsTotal}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500">Latest placement date</div>
          <div className="text-2xl font-semibold">{stats.latestPlacement ?? "—"}</div>
        </div>
      </div>

      {/* Sheds list */}
      <div className="card p-4">
        <div className="font-medium mb-3">Sheds</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">Shed</th>
                <th className="py-2 pr-2">Placement date</th>
                <th className="py-2 pr-2">Placement birds</th>
              </tr>
            </thead>
            <tbody>
              {(sheds || []).map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="py-2 pr-2">{s.name || "—"}</td>
                  <td className="py-2 pr-2">{s.placementDate || "—"}</td>
                  <td className="py-2 pr-2">{s.birdsPlaced ?? s.placementBirds ?? "—"}</td>
                </tr>
              ))}
              {(!sheds || sheds.length === 0) && (
                <tr>
                  <td className="py-6 text-gray-500" colSpan={3}>No sheds yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
