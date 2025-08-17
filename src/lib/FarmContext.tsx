import React, { createContext, useContext, useEffect } from "react";
import { useCloudSlice } from "./cloudSlice";

export type Farm = { id: string; name: string };

type Ctx = {
  farmId: string | null;
  setFarmId: (id: string | null) => void;
  farms: Farm[];
  setFarms: React.Dispatch<React.SetStateAction<Farm[]>>;
  createFarm: (name: string) => Promise<{ id: string; name: string }>;
};

// ⬇️ Exported so cloudSlice can read it via useContext without throwing
export const FarmCtx = createContext<Ctx | undefined>(undefined);

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function FarmProvider({ children }: { children: React.ReactNode }) {
  // Global farms list (syncs across devices)
  const [farms, setFarms] = useCloudSlice<Farm[]>("farms", [], { scope: "global" });

  // Selected farm id (also global so devices share the same selection)
  const [farmId, setFarmId] = useCloudSlice<string | null>("selectedFarmId", null, { scope: "global" });

  // Keep selection valid but DO NOT auto-create a farm
  useEffect(() => {
    if (!farms || farms.length === 0) {
      if (farmId !== null) setFarmId(null);
      return;
    }
    if (!farmId || !farms.some(f => f.id === farmId)) {
      setFarmId(farms[0].id);
    }
  }, [farms, farmId, setFarmId]);

  async function createFarm(name: string) {
    const cleaned = (name || "").trim();
    if (!cleaned) return Promise.reject(new Error("Farm name required"));
    const f = { id: newId(), name: cleaned };
    setFarms(prev => [...(prev || []), f]);
    setFarmId(f.id);
    return f;
  }

  const value: Ctx = {
    farmId,
    setFarmId,
    farms: farms || [],
    setFarms,
    createFarm,
  };

  return <FarmCtx.Provider value={value}>{children}</FarmCtx.Provider>;
}

export function useFarm() {
  const ctx = useContext(FarmCtx);
  if (!ctx) throw new Error("useFarm must be used within <FarmProvider>");
  return ctx;
}
