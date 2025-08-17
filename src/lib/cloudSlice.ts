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
 * useCloudSlice(key, initial)
 * - reads initial value from Netlify Blobs on mount (scoped by farm)
 * - pushes changes to Blobs (debounced) whenever local slice changes
 * - falls back silently if offline or unauthenticated
 */
export function useCloudSlice<T>(key: string, initial: T) {
  const { state: local, setState: setLocal } = useServerState<T>(key, initial);
  const { farmId } = useFarm() as any;
  const loadedOnce = useRef(false);
  const lastPushed = useRef<string>("");

  // Load from cloud once on mount
  useEffect(() => {
    if (loadedOnce.current) return;
    loadedOnce.current = true;
    (async () => {
      try {
        const scope = farmId || "default";
        const res = await fetch(
          `/.netlify/functions/data?key=${encodeURIComponent(`${scope}/${key}`)}`,
          { credentials: "include" }
        );
        if (res.ok) {
          const json = await res.json(); // { value: ... }
          if (json?.value != null && !jsonEqual(json.value, local)) {
            setLocal(json.value);
          }
        }
      } catch {
        // ignore: offline or not signed in
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, farmId]); // don't include local/setLocal to avoid loops

  const push = useRef(
    debounce(async (value: T, scope: string, keyStr: string) => {
      try {
        const body = JSON.stringify(value);
        if (lastPushed.current === body) return;
        lastPushed.current = body;
        await fetch(
          `/.netlify/functions/data?key=${encodeURIComponent(`${scope}/${keyStr}`)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body,
          }
        );
      } catch {
        // ignore transient errors
      }
    }, 500)
  ).current;

  // Push to cloud when the slice changes
  useEffect(() => {
    const scope = farmId || "default";
    push(local, scope, key);
  }, [local, key, farmId, push]);

  // Return exactly the same tuple shape as useServerState slice mode
  return [local, setLocal] as const;
}
