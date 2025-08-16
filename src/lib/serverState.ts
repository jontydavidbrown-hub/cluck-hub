import { useSyncExternalStore, useMemo } from "react";
import { normalizeSettings, DEFAULT_SETTINGS, type AppSettings } from "./defaults";

/** Keys that should always be arrays in state */
const ARRAY_KEYS = new Set([
  "sheds", "dailyLog", "waterLogs", "deliveries", "weights",
  "reminders", "members", "notes", "batches", "feed"
]);

type Member = { email: string; role: "owner"|"manager"|"worker"|"viewer" };
type Farm = { id: string; name: string; members?: Member[] };

type AppState = {
  user?: { email: string } | null;
  farmId?: string | null;
  farms?: Farm[];
  settings: AppSettings;
  // dynamic slices (arrays above + any other ad-hoc slices)
  [key: string]: any;
};

const STORAGE_KEY = "cluckhub_state_v1";

function coerceArrays(obj: any) {
  if (!obj || typeof obj !== "object") return {};
  for (const k of Object.keys(obj)) {
    if (ARRAY_KEYS.has(k) && !Array.isArray(obj[k])) obj[k] = [];
  }
  return obj;
}

function loadInitial(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const state: AppState = {
      settings: normalizeSettings(parsed.settings),
      ...coerceArrays(parsed),
    };
    // ensure farms exist
    if (!Array.isArray(state.farms) || state.farms.length === 0) {
      state.farms = [{ id: "default", name: "My Farm", members: [] }];
      state.farmId = "default";
    }
    if (!state.farmId) state.farmId = state.farms[0].id;
    // ensure base slices present
    for (const key of ARRAY_KEYS) {
      if (!Array.isArray((state as any)[key])) (state as any)[key] = [];
    }
    if (!state.settings) state.settings = DEFAULT_SETTINGS;
    return state;
  } catch {
    return {
      settings: DEFAULT_SETTINGS,
      farms: [{ id: "default", name: "My Farm", members: [] }],
      farmId: "default",
      sheds: [], dailyLog: [], waterLogs: [], deliveries: [], weights: [],
      reminders: [], members: [], notes: [], batches: [], feed: [],
    };
  }
}

let _state: AppState = loadInitial();
const subscribers = new Set<() => void>();

function emit() { subscribers.forEach(fn => fn()); }
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_state)); } catch {}
}

export function getState(): AppState {
  return _state;
}

export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const nextPatch = typeof patch === "function" ? patch(_state) : patch;
  _state = coerceArrays({ ..._state, ...nextPatch });
  persist(); emit();
}

export function setSettings(patch: Partial<AppSettings>) {
  const current = normalizeSettings(_state.settings);
  _state.settings = normalizeSettings({ ...current, ...patch });
  persist(); emit();
}

// Overload declarations for better TS DX
export function useServerState(): AppState;
// When called with a key + initial, return a slice helper that is ALSO iterable.
export function useServerState<T = any>(key: string, initial: T):
  ({ state: T; setState: (next: T | ((prev: T) => T)) => void; loading: boolean; synced: boolean } & Iterable<any>);

export function useServerState<T = any>(key?: string, initial?: T): any {
  const subscribe = (cb: () => void) => { subscribers.add(cb); return () => subscribers.delete(cb); };
  const snapshot = () => _state;
  const state = useSyncExternalStore(subscribe, snapshot, snapshot);
  const memo = useMemo(() => state, [state]);

  if (typeof key === "string") {
    // Slice mode
    const current = (memo as any)[key] ?? initial as T;
    const setter = (next: T | ((prev: T) => T)) => {
      const prevVal = (getState() as any)[key] ?? initial;
      const value = typeof next === "function" ? (next as any)(prevVal) : next;
      setState({ [key]: value } as any);
    };

    // Return an object that supports both object and array destructuring
    const helper: any = {
      state: current as T,
      setState: setter,
      loading: false,
      synced: true,
    };
    helper[Symbol.iterator] = function* () {
      yield current as T;
      yield setter;
    };
    return helper;
  }

  // Full-state mode
  return memo;
}

export const getSettings = () => normalizeSettings(getState().settings);
