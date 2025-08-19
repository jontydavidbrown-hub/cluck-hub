// src/pages/Feed.tsx
import { useMemo } from "react";
import { useFarm } from "../lib/FarmContext";

/**
 * NOTE:
 * - This is a LEAF PAGE (no layout, no <Outlet/>, no header/sidebar/login).
 * - Your global layout lives in src/App.tsx and will wrap this page automatically.
 * - Keep/restore any FEED-SPECIFIC widgets inside the <section> below.
 */

type Farm = { id: string | number; name?: string };

export default function Feed() {
  // Pull farm context (shape may vary; we guard for safety)
  const { farms = [], farmId } = (useFarm() as any) ?? {};

  // Derive the currently selected farm.
  // Handles string/number mismatches and falls back to the first farm (same as your header selector UX).
  const currentFarm: Farm | null = useMemo(() => {
    if (!Array.isArray(farms) || farms.length === 0) return null;
    const match = farms.find((f: Farm) => String(f?.id) === String(farmId));
    return (match ?? farms[0]) || null;
  }, [farms, farmId]);

  const farmLabel =
    currentFarm?.name ||
    (currentFarm?.id != null ? `Farm ${String(currentFarm.id).slice(0, 4)}` : "");

  return (
    <div className="space-y-4">
      {/* Page title (tab already says "Feed" in your App.tsx nav) */}
      <h1 className="text-xl font-semibold">Feed</h1>

      {/* Current farm context */}
      <p className="text-sm text-slate-600">
        {currentFarm ? `Current farm: ${farmLabel}` : "Select a farm to manage feed."}
      </p>

      {/* ===========================
          FEED-SPECIFIC CONTENT AREA
          ===========================
          Put all your existing Feed tools/widgets back here:
          - Silo level tracking
          - Intake logs
          - Reorder calculator
          - Any charts, tables, forms
          None of this will re-introduce the nested layout.
      */}
      <section className="card p-4 space-y-4">
        {/* Example placeholder; replace with your real widgets */}
        <div className="space-y-1">
          <h2 className="font-medium">Feed tools</h2>
          <p className="text-slate-700 text-sm">
            Add your existing feed widgets here (this page no longer includes a layout or &lt;Outlet /&gt;).
          </p>
        </div>

        {/* If you had components previously defined in Feed.tsx that you still want,
           paste them here (or import them) and render them. */}
        {/* <SiloLevels farm={currentFarm} /> */}
        {/* <FeedIntakeLog farmId={currentFarm?.id} /> */}
        {/* <ReorderCalculator farm={currentFarm} /> */}
      </section>
    </div>
  );
}
