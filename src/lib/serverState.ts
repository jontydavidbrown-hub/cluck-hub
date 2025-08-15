import { useMemo } from "react";
import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, normalizeSettings, type AppSettings } from "./defaults";

/** Slices that should always behave like arrays */
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
  [key: string]: any;
};

// bump key to invalidate any lingering bad data
const STORAGE_KEY = "cluckhub:state:v3";

type Listener = () => void;
const listeners = new Set<Listener>();
let state: ServerState = loadAndSanitize();

/* ---------------- helpers ---------------- */

function asArray<T = any>(v: any): T[] {
  return Array.isArray(v) ? v : [];
}

/**
 * Create an "array facade": an object that walks/talks like an array
 * (map/filter/reduce/spread/for..of/length), backed by the given value,
 * but safely falls back to [] when value isn’t an array.
 */
function arrayFacade<T = any>(v: any): T[] {
  const base = asArray<T>(v);
  // If already a real array, just return it for max perf
  if (Array.isArray(v)) return v;

  // Minimal facade that covers common ops used in the app
  const facade: any = {
    get length() {
      return base.length;
    },
    at: (i: number) => base.at(i),
    slice: (...args: any[]) => base.slice(...args),
    map: (...args: any[]) => base.map(...args),
    filter: (...args: any[]) => base.filter(...args),
    reduce: (...args: any[]) => (base as any).reduce(...args),
    some: (...args: any[]) => base.some(...args),
    every: (...args: any[]) => base.every(...args),
    forEach: (...args: any[]) => base.forEach(...args),
    [Symbol.iterator]: function* () {
      yield* base;
    },
    // spread support: [...facade] works because of iterator
    // index access fallback:
    // NOTE: TS can’t type this nicely; at runtime it’s fine.
  };

  return new Proxy(facade, {
    get(target, prop, recv) {
      if (typeof prop === "string" && /^\d+$/.test(prop)) {
        return base[Number(prop)];
      }
      return Reflect.get(target, prop, recv);
    },
    ownKeys() {
      // make Object.keys([...]) reasonable
      return Array.from({ length: base.length }, (_, i) => String(i));
    },
    getOwnPropertyDescriptor(_t, prop) {
      if (typeof prop === "string" && /^\d+$/.test(prop)) {
        return { configurable: true, enumerable: true, writable: false, value: base[Number(prop)] };
      }
      return undefined;
    },
  }) as any;
}

function normalizeWholeState(s: ServerState): ServerState {
  const out: ServerState = { ...s };
  out.settings = normalizeSettings(out.settings);
  for (const k of ARRAY_KEYS) {
    const v = (out as any)[k];
    if (!Array.isArray(v)) (out as any)[k] = [];
  }
  return out;
}

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

function persist(next: ServerState) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  } catch {}
}

function emit() {
  for (const l of Array.from(listeners)) l();
}

export function subscribe(cb: Listener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getState(): ServerState {
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
    settings: normalizeSettings({ ...(base.settings || {}), ...(delta as any)?.settings }),
  });
  state = next;
  persist(state);
  emit();
}

/* ---------------- React hook (hybrid API) ---------------- */

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
  const view = useMemo(() => normalizeWholeState(snapshot), [snapshot]);

  if (isSelector) {
    const selector = arg1 as (s: ServerState) => T;
    let res = selector(view);
    // If a known array slice is returned (common case: s => s.sheds), wrap it
    // Note: we can’t easily detect the key from a selector, so we only coerce if it *looks* array-like
    if (!Array.isArray(res) && (res as any)?.map === undefined) {
      // leave non-arrays alone; pages should handle their own shapes
    }
    return res;
  }

  const key = String(arg1) as keyof ServerState;
  const initialValue = arg2 as T;

  // Coerce array-like slices to safe facades
  let value: any = (view as any)[key];
  const shouldBeArray = ARRAY_KEYS.has(key as string) || Array.isArray(initialValue);
  if (shouldBeArray) value = arrayFacade(value);

  const setter = (next: T | ((prev: T) => T)) => {
    setState((s) => {
      const prevRaw = (s as any)[key];
      const prev = shouldBeArray ? asArray(prevRaw) : prevRaw;
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      if (key === "settings") {
        return { settings: normalizeSettings({ ...(prev || {}), ...(resolved as any) }) } as any;
      }
      return { [key]: resolved } as any;
    });
  };

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
