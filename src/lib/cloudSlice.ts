/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef } from "react";
import { useServerState } from "./serverState";
import { useFarm } from "./FarmContext";

function jsonEqual(a: any, b: any) {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}
function debounce<T extends (...args: any[]) => any>(fn: T, ms: number) {
  let t: any; return (...args: Parameters<T>) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/**
 * useCloudSlice(key, initial, opts?)
 * - reads initial value from Netlify Blobs on mount (scoped by farm)
 * - pushes changes to Blobs (debounced)
 * - pulls again on window focus / tab visibility regain
 * - optional background polling (default 30s)
 *
 * Works even if you're not signed in (silently falls back to local).
 */
export function useCloudSlice<T>(key: string, initial: T, opts?: { pollMs?: number }) {
  const { state: local, setState: setLocal } = useServerState<T>(key, initial);
  const { farmId } = useFarm() as any;
  const loadedOnce = useRef(false);
  const lastPushed = useRef<string>("");
  const pulling = useRef<AbortController | null>(null);
  const pollMs = opts?.pollMs ?? 30000;

  const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
  const scopeKey = (scope: string, k: string) => `${scope}/${k}`;
  const scoped = () => scopeKey(farmId || "default", key);

  async function pullOnce() {
    if (!isBrowser) return;
    try {
      const ctrl = new AbortController();
      pulling.current?.abort(); // cancel any in-flight
      pulling.current = ctrl;

      const res = await fetch(`/.netlify/functions/data?key=${encodeURIComponent(scoped())}`, {
        credentials: "include",
        signal: ctrl.signal,
      });
      if (!res.ok) return;
      const json = await res.json(); // { value }
      if (json?.value != null && !jsonEqual(json.value, local)) {
        setLocal(json.value);
      }
    } catch {
      /* ignore network/auth blips */
    }
  }

  // Load from cloud once on mount
  useEffect(() => {
    if (!isBrowser) return;
    if (loadedOnce.current) return;
    loadedOnce.current = true;
    pullOnce();
  }, [key, farmId]);

  // Pull on focus / when tab becomes visible
  useEffect(() => {
    if (!isBrowser) return;
    function onFocus() { pullOnce(); }
    function onVis() { if (document.visibilityState === "visible") pullOnce(); }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [key, farmId]);

  // Optional background polling
  useEffect(() => {
    if (!isBrowser) return;
    if (!pollMs) return;
    const id = setInterval(pullOnce, pollMs);
    return () => clearInterval(id);
  }, [pollMs, key, farmId]);

  const push = useRef(
    debounce(async (value: T, keyScoped: string) => {
      if (!isBrowser) return;
      try {
        const body = JSON.stringify(value);
        if (lastPushed.current === body) return;
        lastPushed.current = body;
        await fetch(`/.netlify/functions/data?key=${encodeURIComponent(keyScoped)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body,
        });
      } catch {
        /* ignore; next change will retry */
      }
    }, 500)
  ).current;

  // Push to cloud when the slice changes
  useEffect(() => {
    if (!isBrowser) return;
    push(local, scoped());
  }, [local, key, farmId, push]);

  // Same tuple API as useServerState slice mode
  return [local, setLocal] as const;
}

// Also export default to tolerate `import useCloudSlice from "..."`
export default useCloudSlice;
