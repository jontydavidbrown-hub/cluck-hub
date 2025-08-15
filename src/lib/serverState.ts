import { useEffect, useRef, useState } from "react";
import { useFarm } from "./FarmContext";

type Listener<T> = (v: T) => void;
const cache = new Map<string, any>();
const listeners = new Map<string, Set<Listener<any>>>();
const debounces = new Map<string, number>();

function cacheKey(farmId: string, key: string) { return `${farmId}::${key}`; }

export function useServerState<T>(key: string, initial: T): [T, (v: T) => void, boolean] {
  const { farmId } = useFarm();
  const [state, setState] = useState<T>(initial);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!farmId) return;
    const k = cacheKey(farmId, key);
    const listener: Listener<T> = (v) => setState(v);

    if (!listeners.has(k)) listeners.set(k, new Set());
    listeners.get(k)!.add(listener);

    let alive = true;
    (async () => {
      if (cache.has(k)) {
        setState(cache.get(k));
        setLoading(false);
      }
      const res = await fetch(`/.netlify/functions/farmData/${farmId}/${key}`, { credentials: "include" });
      const j = await res.json();
      if (!alive) return;
      if (j?.ok) { cache.set(k, j.data ?? initial); setState(j.data ?? initial); }
      setLoading(false);
    })();

    return () => {
      alive = false;
      listeners.get(k)?.delete(listener);
    };
  }, [farmId, key]);

  const setServer = (v: T) => {
    if (!farmId) return;
    const k = cacheKey(farmId, key);
    cache.set(k, v);
    listeners.get(k)?.forEach(fn => fn(v));
    setState(v);

    if (debounces.has(k)) window.clearTimeout(debounces.get(k)!);
    const t = window.setTimeout(async () => {
      await fetch(`/.netlify/functions/farmData/${farmId}/${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(v)
      });
      debounces.delete(k);
    }, 400);
    debounces.set(k, t);
  };

  return [state, setServer, loading];
}
