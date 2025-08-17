import React, { createContext, useContext, PropsWithChildren } from "react";
import { useServerState } from "./serverState";

type Farm = { id: string; name?: string };
type FarmCtx = {
  farms: Farm[];
  farmId: string | null;
  setFarmId: (id: string | null) => void;
  createFarm: (name?: string) => string;
};

const Ctx = createContext<FarmCtx | undefined>(undefined);

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function FarmProvider({ children }: PropsWithChildren) {
  // ✅ starts empty; no “My Farm” seeding
  const { state: farms = [], setState: setFarms } = useServerState<Farm[]>("farms", []);
  const { state: farmId = null, setState: setFarmId } = useServerState<string | null>("farmId", null);

  const createFarm = (name?: string) => {
    const id = newId();
    const farm: Farm = { id, name: name?.trim() || "" };
    setFarms(prev => [...(prev || []), farm]);
    if (!farmId) setFarmId(id);
    return id;
  };

  const value: FarmCtx = { farms, farmId, setFarmId, createFarm };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFarm() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFarm must be used within <FarmProvider>");
  return ctx;
}

export default FarmProvider;
