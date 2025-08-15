import React, { createContext, useContext, useMemo, PropsWithChildren } from "react";
import { useServerState, getState, setState, setSettings } from "./serverState";
import type { AppSettings } from "./defaults";

type FarmContextValue = {
  user: { email: string } | null | undefined;
  farmId: string | null | undefined;
  setFarmId: (id: string | null) => void;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  state: any;
  setState: typeof setState;
};

const FarmContext = createContext<FarmContextValue | undefined>(undefined);

export function FarmProvider({ children }: PropsWithChildren<{}>) {
  const state = useServerState((s) => s);
  const value = useMemo<FarmContextValue>(() => {
    return {
      user: state.user,
      farmId: state.farmId ?? null,
      setFarmId: (id) => setState({ farmId: id }),
      settings: state.settings,
      updateSettings: (patch) => setSettings(patch),
      state,
      setState,
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
