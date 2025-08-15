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

// bump key again to ditch any stubborn old cache
const STORAGE_KEY = "cluckhub:state:v4";

type Listener = () => void;
const listeners = new Set<Listener>();
let state: ServerState = loadAndSanitize();

/* ---------------- helpers ---------------- */

function asArray<T = any>(v: any): T[] {
  return Array.isArray(v) ? v : [];
}

function arrayFacade<T = any>(v: any): T[] {
  const base = asArray<T>(v);
  if (Array.isArray(v)) return v; // already real array

  // Lightweight facade that behaves like an array when called
  const facade: any = {
    get length() { return base.length; },
    at: (i: number) => base.at(i),
    slice: (...a: any[]) => base.slice(...a),
    map: (...a: any[]) => base.map(...a),
    filter: (...a: any[]) => base.filter(...a),
    reduce: (...a: any[]) => (base as any).reduce(...a),
    some: (...a: any[]) => base.some(...a),
    every: (...a: any[]) => base.every(...a),
    forEach: (...a: any[]) => base.forEach(...a),
    [Symbol.iterator]: function* () { yield* base; },
  };

  return new Proxy(facade, {
    get(_t, prop, _r) {
      if (typeof prop === "string" && /^\d+$/.test(prop)) return base[Number(prop)];
      // methods/props fall back to base (length, map, etc.)
      const val = (base as any)[prop as any];
      return typeof val === "function" ? val.bind(base) : val;
    },
    ownKeys() {
      return Array.from({ length: base.length }, (_, i) => String(i)).concat("length");
    },
    getOwnPropertyDescriptor(_t, prop) {
      if (prop === "length") return { configurable: true, enumerable: false, writable: false, value: base.length };
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
  } catch {}
  return normalizeWholeState(s);
}

function persist(next: ServerState) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  } catch {}
}

function emit() { for (const l of Array.from(listeners)) l(); }

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

/* ---------------- React hook (triple-mode return) ---------------- */
/**
 * Modes supported:
 *  1) useServerState((s) => slice) -> T
 *  2) const { state, setState } = useServerState("key", init)
 *  3) const [value, setValue]    = useServerState("key", init)
 *
 * Additionally, for array-shaped keys (like "sheds"), the returned object
 * also behaves like an array if you call `.map` on it directly.
 *    const sheds = useServerState("sheds", []);
 *    sheds.map(...)  // ✅ works
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
    try {
      return selector(view);
    } catch {
      return undefined as unknown as T;
    }
  }

  const key = String(arg1) as keyof ServerState;
  const initialValue = arg2 as T;
  const shouldBeArray = ARRAY_KEYS.has(key as string) || Array.isArray(initialValue);

  const raw = (view as any)[key];
  const arr = shouldBeArray ? arrayFacade(raw) : raw;

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

  // Create a proxy that:
  // - exposes { state, setState, loading, synced }
  // - supports [value, setValue] via iterator
  // - and forwards array methods (map/filter/etc.) to arr when needed
  const base: any = {
    state: arr as T,
    setState: setter,
    loading: false,
    synced: true,
  };
  base[0] = base.state;
  base[1] = base.setState;
  base.length = 2;
  base[Symbol.iterator] = function* () { yield base.state; yield base.setState; };

  return new Proxy(base, {
    get(target, prop, recv) {
      if (prop in target) return Reflect.get(target, prop, recv);
      if (shouldBeArray) {
        const val = (arr as any)[prop as any];
        return typeof val === "function" ? val.bind(arr) : val;
      }
      return undefined;
    },
    has(target, prop) {
      return prop in target || (shouldBeArray && prop in (arr as any));
    },
    ownKeys(target) {
      if (!shouldBeArray) return Reflect.ownKeys(target);
      const arrKeys = Array.from({ length: (arr as any).length }, (_, i) => String(i));
      return Array.from(new Set([...Reflect.ownKeys(target), ...arrKeys, "length"]));
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop in target) return Object.getOwnPropertyDescriptor(target, prop as any);
      if (shouldBeArray) {
        if (prop === "length") return { configurable: true, enumerable: false, writable: false, value: (arr as any).length };
        if (typeof prop === "string" && /^\d+$/.test(prop)) {
          return { configurable: true, enumerable: true, writable: false, value: (arr as any)[Number(prop)] };
        }
      }
      return undefined;
    },
  });
}

/* convenience helpers */
export const getSettings = () => getState().settings;
export const setSettings = (patch: Partial<AppSettings>) =>
  setState((s) => ({ settings: { ...normalizeSettings(s.settings), ...patch } }));
