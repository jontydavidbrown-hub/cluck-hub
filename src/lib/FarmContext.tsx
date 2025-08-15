import React, { createContext, useContext, useMemo, PropsWithChildren } from "react";
import { useServerState, getState, setState, setSettings } from "./serverState";
import type { AppSettings } from "./defaults";

type Member = { email: string; role: "owner" | "manager" | "worker" | "viewer" };
type Farm = { id: string; name: string; members: Member[] };

type FarmContextValue = {
  user: { email: string } | null | undefined;
  farmId: string | null | undefined;
  setFarmId: (id: string | null) => void;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  state: any;
  setState: typeof setState;

  // farm management expected by pages
  farms: Farm[];
  createFarm: (name: string) => Promise<Farm>;
  inviteMember: (farmId: string, email: string, role: Member["role"]) => Promise<void>;
  changeRole: (farmId: string, email: string, role: Member["role"]) => Promise<void>;
  removeMember: (farmId: string, email: string) => Promise<void>;
  refresh: () => void;
};

const FarmContext = createContext<FarmContextValue | undefined>(undefined);

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function FarmProvider({ children }: PropsWithChildren) {
  const [state] = useServerState();

  const value = useMemo<FarmContextValue>(() => {
    const s = getState();

    // Ensure farms exist so .map() never explodes
    const farms: Farm[] = Array.isArray(s.farms) ? s.farms : [
      { id: "default", name: "My Farm", members: [] },
    ];
    if (!Array.isArray(s.farms)) {
      setState({ farms, farmId: farms[0].id });
    }

    async function createFarm(name: string): Promise<Farm> {
      const next: Farm = { id: uid(), name, members: [] };
      const curr = getState();
      setState({ farms: [...(curr.farms || []), next], farmId: next.id });
      return next;
    }

    async function inviteMember(fid: string, email: string, role: Member["role"]) {
      const curr = getState();
      const updated = (curr.farms || []).map((f: Farm) =>
        f.id === fid ? { ...f, members: [...(f.members || []), { email, role }] } : f
      );
      setState({ farms: updated });
    }

    async function changeRole(fid: string, email: string, role: Member["role"]) {
      const curr = getState();
      const updated = (curr.farms || []).map((f: Farm) =>
        f.id === fid
          ? { ...f, members: (f.members || []).map(m => m.email === email ? { ...m, role } : m) }
          : f
      );
      setState({ farms: updated });
    }

    async function removeMember(fid: string, email: string) {
      const curr = getState();
      const updated = (curr.farms || []).map((f: Farm) =>
        f.id === fid ? { ...f, members: (f.members || []).filter(m => m.email !== email) } : f
      );
      setState({ farms: updated });
    }

    return {
      user: s.user ?? null,
      farmId: s.farmId ?? (farms[0]?.id ?? null),
      setFarmId: (id) => setState({ farmId: id }),
      settings: s.settings,
      updateSettings: (patch) => setSettings(patch),
      state,
      setState,

      farms,
      createFarm,
      inviteMember,
      changeRole,
      removeMember,
      refresh: () => setState((x) => ({ ...x })), // no-op trigger to refresh subscribers
    };
  }, [state]);

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarm() {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error("useFarm must be used within <FarmProvider>");
  return ctx;
}

export function getFarmState() {
  return getState();
}
