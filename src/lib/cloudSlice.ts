import { useEffect, useRef } from "react";
import { useServerState } from "./serverState";
import { useFarm } from "./FarmContext";

function jsonEqual(a: any, b: any) {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}
function debounce<T extends (...args: any[]) => any>(fn: T, ms: number) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/**
 * useCloudSlice(key, initial, opts?)
 * - scope: "farm" (default), "global", or any string
 * - reads from Netlify Blobs on mount (scoped by chosen scope)
 * - pushes changes (debounced)
 * - pulls again on window focus / tab visibility
 * - optional polling (default 30s)
 */
export function useCloudSlice<T>(
  key: string,
  initial: T,
  opts?: { pollMs?: number; scope?: "farm" | "global" | string }
) {
  const { state: local, setState: setLocal } = useServerState<T>(key, initial);
  const { farmId } = useFarm() as any;

  const loadedOnce = useRef(false);
  const lastPushed = useRef<string>("");
  const pulling = useRef<AbortController | null>(null);
  const pollMs = opts?.pollMs ?? 30000;

  // scope prefix: farm by default, or user/global if requested
  const scopeTag =
    opts?.scope === "global"
      ? "user"
      : opts?.scope
      ? String(opts?.scope)
      : (farmId || "default");

  const scopedKey = `${scopeTag}/${key}`;

  async function pullOnce() {
    try {
      const ctrl = new AbortController();
      pulling.current?.abort();
      pulling.current = ctrl;

      const res = await fetch(`/.netlify/functions/data?key=${encodeURIComponent(scopedKey)}`, {
        credentials: "include",
        signal: ctrl.signal,
      });
      if (!res.ok) return;
      const json = await res.json(); // { value }
      if (json?.value != null && !jsonEqual(json.value, local)) {
        setLocal(json.value);
      }
    } catch {
      /* ignore */
    }
  }

  // Load from cloud once on mount / when key or scope changes (first run guarded)
  useEffect(() => {
    if (loadedOnce.current) return;
    loadedOnce.current = true;
    pullOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, scopeTag]);

  // Pull on focus / visibility regain
  useEffect(() => {
    function onFocus() { pullOnce(); }
    function onVis() { if (document.visibilityState === "visible") pullOnce(); }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [key, scopeTag]);

  // Optional polling
  useEffect(() => {
    if (!pollMs) return;
    const id = setInterval(pullOnce, pollMs);
    return () => clearInterval(id);
  }, [pollMs, key, scopeTag]);

  // Debounced push
  const push = useRef(
    debounce(async (value: T, keyScoped: string) => {
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
        /* ignore; later changes will retry */
      }
    }, 500)
  ).current;

  // Push whenever local slice changes
  useEffect(() => {
    push(local, scopedKey);
  }, [local, key, scopeTag, push]);

  return [local, setLocal] as const;
}
