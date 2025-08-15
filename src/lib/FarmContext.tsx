import React, { createContext, useContext, useMemo, PropsWithChildren } from "react";
import { useServerState, getState, setState, setSettings } from "./serverState";
import type { AppSettings } from "./defaults";

type FarmContextValue = {
  user: { email: string } | null | undefined;
  farmId: string | null | undefined;
  setFarmId: (id: string | null) => void;
  /** Always normalized defaults (batchLengthDays, timezone, waterUnits). */
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  /** Raw access to global state if needed by pages. */
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
      settings: state.settings, // already normalized by the hook
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

/** Convenience getter for non-React code (e.g., helpers/utilities). */
export function getFarmState() {
  return getState();
}
