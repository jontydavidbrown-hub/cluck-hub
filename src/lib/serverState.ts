import { useMemo } from "react";
import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, normalizeSettings, type AppSettings } from "./defaults";

/** Minimal, forward-compatible shape. Keep everything else as `any` so existing pages keep working. */
export type ServerState = {
  settings: AppSettings;
  user?: { email: string } | null;
  farmId?: string | null;
  [key: string]: any; // other slices (logs, farms, etc.) remain untouched
};

const STORAGE_KEY = "cluckhub:state:v1";

/* ------------------------------------------------------------------ */
/* In-memory store with subscribe/useSyncExternalStore                 */
/* ------------------------------------------------------------------ */
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
        // normalize only settings; leave the rest intact
        parsed.settings = normalizeSettings(parsed.settings);
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return { settings: { ...DEFAULT_SETTINGS } };
}

function persist(next: ServerState) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    /* ignore storage errors */
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */
export function getState(): ServerState {
  // ensure settings always normalized before handing out
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
    // make sure settings are merged & normalized
    settings: normalizeSettings({ ...(base.settings || {}), ...(delta as any)?.settings }),
  };
  state = next;
  persist(state);
  emit();
}

/** Subscribe to store changes (used by the hook). */
export function subscribe(cb: Listener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** React hook to select a slice; memoized + normalized settings. */
export function useServerState<T>(selector: (s: ServerState) => T): T {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => getState(),
    () => getState()
  );
  // Always provide normalized settings to selectors
  const s: ServerState = useMemo(
    () => ({ ...snapshot, settings: normalizeSettings(snapshot.settings) }),
    [snapshot]
  );
  return selector(s);
}

/* Helpers commonly used around the app */
export const getSettings = () => getState().settings;
export const setSettings = (patch: Partial<AppSettings>) =>
  setState((s) => ({ settings: { ...normalizeSettings(s.settings), ...patch } }));

/* SSR-friendly init to guarantee settings defaults even before any component mounts */
(() => {
  state.settings = normalizeSettings(state.settings);
})();
