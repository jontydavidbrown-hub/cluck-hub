import { useMemo, useRef } from "react";
import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, normalizeSettings, type AppSettings } from "./defaults";

export type ServerState = {
  settings: AppSettings;
  user?: { email: string } | null;
  farmId?: string | null;
  // other dynamic slices: dailyLog, waterLogs, deliveries, weights, sheds, reminders, etc.
  [key: string]: any;
};

const STORAGE_KEY = "cluckhub:state:v1";

/* ------------------------------------------------------------------ */
/* Internal store with subscribe/persist                               */
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

/* Normalize settings on boot */
(() => {
  state.settings = normalizeSettings(state.settings);
})();

/* ------------------------------------------------------------------ */
/* Public store API                                                    */
/* ------------------------------------------------------------------ */
export function getState(): ServerState {
  // always ensure normalized settings
  state.settings = normalizeSettings(state.settings);
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

/* ------------------------------------------------------------------ */
/* React hooks                                                         */
/* ------------------------------------------------------------------ */

/**
 * Two forms:
 * 1) useServerState((s) => slice) -> T
 * 2) useServerState("key", initialValue) -> [T, setT]
 */
export function useServerState<T>(selector: (s: ServerState) => T): T;
export function useServerState<T>(key: string, initialValue: T): [T, (next: T | ((prev: T) => T)) => void];
export function useServerState<T>(arg1: any, arg2?: any): any {
  const isSelector = typeof arg1 === "function";
  const snapshot = useSyncExternalStore(subscribe, () => getState(), () => getState());

  // Always hand out normalized settings
  const current = useMemo(
    () => ({ ...snapshot, settings: normalizeSettings(snapshot.settings) }),
    [snapshot]
  );

  if (isSelector) {
    const selector = arg1 as (s: ServerState) => T;
    return selector(current);
  }

  const key = String(arg1) as keyof ServerState;
  const initialValue = arg2 as T;

  // initialize on first read (but don't persist until a write to avoid noisy writes)
  const value = (current as any)[key] ?? initialValue;

  // stable setter
  const setter = (next: T | ((prev: T) => T)) => {
    setState((s) => {
      const prev = (s as any)[key] ?? initialValue;
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      // special merge for settings
      if (key === "settings") {
        return { settings: normalizeSettings({ ...(prev || {}), ...(resolved as any) }) } as any;
      }
      return { [key]: resolved } as any;
    });
  };

  // return tuple like React.useState
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const tupleRef = useRef<[T, typeof setter]>([value as T, setter]);
  tupleRef.current[0] = value as T;
  return tupleRef.current;
}

export const getSettings = () => getState().settings;
export const setSettings = (patch: Partial<AppSettings>) =>
  setState((s) => ({ settings: { ...normalizeSettings(s.settings), ...patch } }));
