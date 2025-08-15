import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Role = "owner" | "manager" | "worker" | "viewer";
export type Farm = { id: string; name: string; ownerEmail: string; members: { email: string; role: Role }[]; createdAt?: string };

type Ctx = {
  farmId: string | null;
  setFarmId: (id: string) => void;
  farms: Farm[];
  refresh: () => Promise<void>;
  createFarm: (name: string) => Promise<Farm>;
  inviteMember: (farmId: string, email: string, role: Role) => Promise<void>;
  changeRole: (farmId: string, email: string, role: Role) => Promise<void>;
  removeMember: (farmId: string, email: string) => Promise<void>;
};

const FarmContext = createContext<Ctx>({
  farmId: null, setFarmId: () => {},
  farms: [], refresh: async () => {},
  createFarm: async () => { throw new Error("not ready"); },
  inviteMember: async () => { throw new Error("not ready"); },
  changeRole: async () => { throw new Error("not ready"); },
  removeMember: async () => { throw new Error("not ready"); },
});

export const useFarm = () => useContext(FarmContext);

export function FarmProvider({ children }: { children: React.ReactNode }) {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmId, setFarmIdState] = useState<string | null>(() => localStorage.getItem("activeFarmId"));

  const setFarmId = useCallback((id: string) => {
    localStorage.setItem("activeFarmId", id);
    setFarmIdState(id);
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/.netlify/functions/farms", { credentials: "include" });
    const j = await res.json();
    if (j?.ok) {
      setFarms(j.farms || []);
      if (!farmId && j.farms?.[0]?.id) setFarmId(j.farms[0].id);
    }
  }, [farmId, setFarmId]);

  useEffect(() => { refresh(); }, [refresh]);

  const createFarm = useCallback(async (name: string) => {
    const res = await fetch("/.netlify/functions/farms", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ name })
    });
    const j = await res.json();
    if (!j?.ok) throw new Error(j?.error || "Failed to create farm");
    setFarms(prev => [...prev, j.farm]);
    setFarmId(j.farm.id);
    return j.farm as Farm;
  }, [setFarmId]);

  const inviteMember = useCallback(async (id: string, email: string, role: Role) => {
    const res = await fetch(`/.netlify/functions/farms/${id}/members`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ email, role })
    });
    const j = await res.json();
    if (!j?.ok) throw new Error(j?.error || "Failed to invite");
    await refresh();
  }, [refresh]);

  const changeRole = useCallback(async (id: string, email: string, role: Role) => {
    const res = await fetch(`/.netlify/functions/farms/${id}/members`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ email, role })
    });
    const j = await res.json();
    if (!j?.ok) throw new Error(j?.error || "Failed to change role");
    await refresh();
  }, [refresh]);

  const removeMember = useCallback(async (id: string, email: string) => {
    const res = await fetch(`/.netlify/functions/farms/${id}/members`, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ email })
    });
    const j = await res.json();
    if (!j?.ok) throw new Error(j?.error || "Failed to remove member");
    await refresh();
  }, [refresh]);

  const value = useMemo<Ctx>(() => ({
    farmId, setFarmId,
    farms, refresh, createFarm, inviteMember, changeRole, removeMember
  }), [farmId, setFarmId, farms, refresh, createFarm, inviteMember, changeRole, removeMember]);

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}
