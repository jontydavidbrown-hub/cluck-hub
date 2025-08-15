import { useMemo } from "react";
import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, normalizeSettings, type AppSettings } from "./defaults";

export type ServerState = {
  settings: AppSettings;
  user?: { email: string } | null;
  farmId?: string | null;
  [key: string]: any;
};

const STORAGE_KEY = "cluckhub:state:v1";

let state: ServerState = safeLoad();

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  for (const l of Array.from(listeners)) l();
}

function safeLoad(): ServerState {
  try {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.settings = normalizeSettings(parsed.settings);
        return parsed;
      }
    }
  } catch {}
  return { settings: { ...DEFAULT_SETTINGS } };
}

function persist(next: ServerState) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  } catch {}
}

export function getState(): ServerState {
  if (!state.settings) state.settings = { ...DEFAULT_SETTINGS };
  else state.settings = normalizeSettings(state.settings);
  return state;
}

export function setState(patch: Partial<ServerState> | ((s: ServerState) => Partial<ServerState>)) {
  const base = getState();
  const delta = typeof patch === "function" ? patch(base) : patch;
  const next: ServerState = {
    ...base,
    ...delta,
    settings: normalizeSettings({ ...(base.settings || {}), ...(delta as any)?.settings }),
  };
  state = next;
  persist(state);
  emit();
}

export function subscribe(cb: Listener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useServerState<T>(selector: (s: ServerState) => T): T {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => getState(),
    () => getState()
  );
  const s: ServerState = useMemo(
    () => ({ ...snapshot, settings: normalizeSettings(snapshot.settings) }),
    [snapshot]
  );
  return selector(s);
}

export const getSettings = () => getState().settings;
export const setSettings = (patch: Partial<AppSettings>) =>
  setState((s) => ({ settings: { ...normalizeSettings(s.settings), ...patch } }));

(() => {
  state.settings = normalizeSettings(state.settings);
})();
