// src/pages/Feed.tsx
import { useFarm } from "../lib/FarmContext";

export default function Feed() {
  const { currentFarm } = useFarm() as any;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Feed Silos</h1>
      <p className="text-sm text-slate-600">
        {currentFarm ? `Current farm: ${currentFarm.name}` : "Select a farm to manage feed."}
      </p>

      {/* Working area for your Feed features — add/expand here without touching the main layout */}
      <div className="card p-4">
        <p className="text-slate-700">Feed tools and logs will appear here.</p>
      </div>
    </div>
  );
}
