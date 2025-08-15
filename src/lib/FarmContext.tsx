import React, { createContext, useContext, useEffect, useMemo, useState, PropsWithChildren, useCallback } from "react";
import { useServerState, setState } from "./serverState";
import type { AppSettings } from "./defaults";

type Role = "owner"|"manager"|"worker"|"viewer";
type Member = { email: string; role: Role };
export type Farm = { id: string; name: string; members: Member[] };

type FarmContextValue = {
  farms: Farm[];
  farmId: string | null;
  setFarmId: (id: string | null) => void;
  refresh: () => Promise<void>;
  createFarm: (name: string) => Promise<void>;
  inviteMember: (farmId: string, email: string, role: Role) => Promise<void>;
  changeRole: (farmId: string, email: string, role: Role) => Promise<void>;
  removeMember: (farmId: string, email: string) => Promise<void>;
};

const FarmContext = createContext<FarmContextValue | undefined>(undefined);

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/.netlify/functions/farms${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...init,
  });
  if (!res.ok) {
    const t = await res.text().catch(()=>"" );
    throw new Error(t || res.statusText);
  }
  return res.json();
}

export function FarmProvider({ children }: PropsWithChildren<{}>) {
  const [farms, setFarms] = useServerState<Farm[]>("farms", []);
  const [farmId, setFarmIdState] = useServerState<string | null>("farmId", null);

  const setFarmId = useCallback((id: string | null) => {
    setFarmIdState(id);
  }, [setFarmIdState]);

  const refresh = useCallback(async () => {
    try {
      const data = await api("");
      const list: Farm[] = Array.isArray(data?.farms) ? data.farms : [];
      setFarms(list);
      // default selection
      if (!farmId && list.length) setFarmIdState(list[0].id);
    } catch (e) {
      // ignore on first load if unauthenticated
      console.warn("farms refresh failed:", e);
    }
  }, [farmId, setFarms, setFarmIdState]);

  useEffect(() => { refresh(); }, []);

  const createFarm = useCallback(async (name: string) => {
    const data = await api("", { method: "POST", body: JSON.stringify({ name }) });
    await refresh();
    // select the newly created farm if provided
    if (data?.farm?.id) setFarmIdState(data.farm.id);
  }, [refresh, setFarmIdState]);

  const inviteMember = useCallback(async (id: string, email: string, role: Role) => {
    await api(`/${encodeURIComponent(id)}/members`, { method: "POST", body: JSON.stringify({ email, role }) });
    await refresh();
  }, [refresh]);

  const changeRole = useCallback(async (id: string, email: string, role: Role) => {
    await api(`/${encodeURIComponent(id)}/members`, { method: "PUT", body: JSON.stringify({ email, role }) });
    await refresh();
  }, [refresh]);

  const removeMember = useCallback(async (id: string, email: string) => {
    await api(`/${encodeURIComponent(id)}/members?email=${encodeURIComponent(email)}`, { method: "DELETE" });
    await refresh();
  }, [refresh]);

  const value = useMemo<FarmContextValue>(() => ({
    farms, farmId,
    setFarmId,
    refresh, createFarm, inviteMember, changeRole, removeMember,
  }), [farms, farmId, setFarmId, refresh, createFarm, inviteMember, changeRole, removeMember]);

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarm() {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error("useFarm must be used within <FarmProvider>");
  return ctx;
}
