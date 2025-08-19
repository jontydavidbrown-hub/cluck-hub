// src/pages/Feed.tsx
import { useMemo } from "react";
import { useFarm } from "../lib/FarmContext";

type Farm = { id: string | number; name?: string };

export default function Feed() {
  const { farms = [], farmId } = (useFarm() as any) ?? {};

  // Derive currentFarm robustly:
  // - Handles string/number id mismatches
  // - Falls back to the first farm if farmId is unset
  const currentFarm: Farm | null = useMemo(() => {
    if (!Array.isArray(farms) || farms.length === 0) return null;
    const byId = farms.find((f: Farm) => String(f?.id) === String(farmId));
    return (byId ?? farms[0]) || null;
  }, [farms, farmId]);

  const farmLabel =
    currentFarm?.name || (currentFarm?.id != null ? `Farm ${String(currentFarm.id).slice(0, 4)}` : "");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Feed</h1>

      <p className="text-sm text-slate-600">
        {currentFarm ? `Current farm: ${farmLabel}` : "Select a farm to manage feed."}
      </p>

      {/* Working area: expand here without touching the main layout */}
      <section className="card p-4 space-y-3">
        <h2 className="font-medium">Feed tools</h2>
        <p className="text-slate-700">
          {/* Placeholder content — tell me what widgets you want next (e.g., silo levels, intake logs, reorder calc) */}
          Feed tools and logs will appear here.
        </p>
      </section>
    </div>
  );
}
