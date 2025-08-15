import { useMemo } from "react";
import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, normalizeSettings, type AppSettings } from "./defaults";

/**
 * Keys that MUST always be arrays in the app.
 * If any of these are missing or the wrong type in localStorage,
 * we coerce them to [] so .map() is always safe.
 */
const ARRAY_KEYS = new Set([
  "sheds",
  "dailyLog",
  "waterLogs",
  "deliveries",
  "weights",
  "reminders",
  "members",
  "notes",
  "batches",
  "feed",
]);

export type ServerState = {
  settings: AppSettings;
  user?: { email: string } | null;
  farmId?: string | null;
  // allow arbitrary slices
  [key: string]: any;
};

// Bump the storage key to invalidate any corrupted old data
const STORAGE_KEY = "cluckhub:state:v2";

type Listener = () => void;
const listeners = new Set<Listener>();

let state: ServerState = loadAndSanitize();

/* ---------------- core state helpers ---------------- */

function loadAndSanitize(): ServerState {
  let s: ServerState = { settings: { ...DEFAULT_SETTINGS } };
  try {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") s = parsed;
      }
    }
  } catch {
    // ignore bad JSON
  }
  return normalizeWholeState(s);
}

function normalizeWholeState(s: ServerState): ServerState {
  const out: ServerState = { ...s };
  // settings always normalized
  out.settings = normalizeSettings(out.settings);

  // every array-key must be a real array, never undefined/string/object
  for (const k of ARRAY_KEYS) {
    const v = (out as any)[k];
    if (!Array.isArray(v)) (out as any)[k] = [];
  }
  return out;
}

function persist(next: ServerState) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // ignore quota issues
  }
}

function emit() {
  for (const l of Array.from(listeners)) l();
}

export function subscribe(cb: Listener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getState(): ServerState {
  // Always return a sanitized, normalized snapshot
  state = normalizeWholeState(state);
  return state;
}

export function setState(
  patch: Partial<ServerState> | ((s: ServerState) => Partial<ServerState>)
) {
  const base = getState();
  const delta = typeof patch === "function" ? patch(base) : patch;

  const next: ServerState = normalizeWholeState({
    ...base,
    ...delta,
    // merge settings through the normalizer
    settings: normalizeSettings({ ...(base.settings || {}), ...(delta as any)?.settings }),
  });

  state = next;
  persist(state);
  emit();
}

/* ---------------- React hook with hybrid API ---------------- */

/**
 * Overloads:
 * 1) useServerState((s) => slice) -> T
 * 2) useServerState("key", initial) -> object that is ALSO iterable:
 *    const { state, setState } = useServerState("k", init)
 *    const [value, setValue]   = useServerState("k", init)
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

  // React-visible view is always normalized/sanitized
  const view = useMemo(() => normalizeWholeState(snapshot), [snapshot]);

  if (isSelector) {
    const selector = arg1 as (s: ServerState) => T;
    // Even selector results get array coercion if key is known
    try {
      const res = selector(view);
      return res;
    } catch (e) {
      // If user code throws inside selector, surface a safe fallback
      // (keeps app from white-screening)
      return undefined as unknown as T;
    }
  }

  const key = String(arg1) as keyof ServerState;
  const initialValue = arg2 as T;

  // Base value: if the key is in ARRAY_KEYS and not an array, force []
  let value: any = (view as any)[key];
  if (ARRAY_KEYS.has(key as string)) value = Array.isArray(value) ? value : [];

  // If the caller provided an array initial, ensure array semantics anyway
  if (Array.isArray(initialValue) && !Array.isArray(value)) value = [];

  const setter = (next: T | ((prev: T) => T)) => {
    setState((s) => {
      const prevRaw = (s as any)[key];
      const prev = ARRAY_KEYS.has(key as string)
        ? (Array.isArray(prevRaw) ? prevRaw : [])
        : prevRaw;
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      if (key === "settings") {
        return { settings: normalizeSettings({ ...(prev || {}), ...(resolved as any) }) } as any;
      }
      return { [key]: resolved } as any;
    });
  };

  // Return object that is ALSO iterable: supports both destructuring styles
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

/* convenience helpers */
export const getSettings = () => getState().settings;
export const setSettings = (patch: Partial<AppSettings>) =>
  setState((s) => ({ settings: { ...normalizeSettings(s.settings), ...patch } }));
