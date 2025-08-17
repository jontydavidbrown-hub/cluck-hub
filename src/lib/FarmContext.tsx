import React, { createContext, useContext, useEffect } from "react";
import { useCloudSlice } from "./lib/cloudSlice";

export type Farm = { id: string; name: string };

type Ctx = {
  farmId: string | null;
  setFarmId: (id: string | null) => void;
  farms: Farm[];
  setFarms: React.Dispatch<React.SetStateAction<Farm[]>>;
};

const FarmCtx = createContext<Ctx | undefined>(undefined);

export function FarmProvider({ children }: { children: React.ReactNode }) {
  // Global farms list (shared across devices)
  const [farms, setFarms] = useCloudSlice<Farm[]>("farms", [], { scope: "global" });

  // Selected farm id (also global so devices share the same selection if you want)
  const [farmId, setFarmId] = useCloudSlice<string | null>("selectedFarmId", null, { scope: "global" });

  // Keep selection valid but don't auto-create any farm
  useEffect(() => {
    if (!farms || farms.length === 0) {
      if (farmId !== null) setFarmId(null);
      return;
    }
    if (!farmId || !farms.some(f => f.id === farmId)) {
      setFarmId(farms[0].id);
    }
  }, [farms, farmId, setFarmId]);

  const value: Ctx = { farmId, setFarmId, farms: farms || [], setFarms };
  return <FarmCtx.Provider value={value}>{children}</FarmCtx.Provider>;
}

export function useFarm() {
  const ctx = useContext(FarmCtx);
  if (!ctx) throw new Error("useFarm must be used within <FarmProvider>");
  return ctx;
}
