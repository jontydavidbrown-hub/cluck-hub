import { useMemo, useRef } from "react";
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

// ensure normalized on boot
(() => { state.settings = normalizeSettings(state.settings); })();

export function getState(): ServerState {
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

/**
 * Overloads:
 * 1) useServerState((s) => slice) -> T
 * 2) useServerState("key", initial) -> returns an object that is ALSO iterable so array destructuring works:
 *    const { state, setState } = useServerState("k", init)
 *    const [value, setValue] = useServerState("k", init)
 */
export function useServerState<T>(selector: (s: ServerState) => T): T;
export function useServerState<T>(key: string, initialValue: T): {
  state: T;
  setState: (next: T | ((prev: T) => T)) => void;
  loading: boolean;
  synced: boolean;
} & Iterable<any>;
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
  const value = (current as any)[key] ?? initialValue;

  const setter = (next: T | ((prev: T) => T)) => {
    setState((s) => {
      const prev = (s as any)[key] ?? initialValue;
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      if (key === "settings") {
        return { settings: normalizeSettings({ ...(prev || {}), ...(resolved as any) }) } as any;
      }
      return { [key]: resolved } as any;
    });
  };

  // Object that is ALSO iterable: supports both {state,setState} and [state,setState]
  const obj: any = {
    state: value as T,
    setState: setter,
    loading: false,
    synced: true,
  };
  obj[0] = obj.state;
  obj[1] = obj.setState;
  obj.length = 2;
  obj[Symbol.iterator] = function* () {
    yield obj.state;
    yield obj.setState;
  };
  return obj;
}

export const getSettings = () => getState().settings;
export const setSettings = (patch: Partial<AppSettings>) =>
  setState((s) => ({ settings: { ...normalizeSettings(s.settings), ...patch } }));
