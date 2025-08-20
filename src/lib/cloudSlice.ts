// src/lib/cloudSlice.ts
import React, { useEffect, useRef, useContext } from "react";
import { useServerState } from "./serverState";
import { useFarm } from "./FarmContext";

function jsonEqual(a: any, b: any) {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}
function debounce<T extends (...args: any[]) => any>(fn: T, ms: number) {
  let t: any; return (...args: Parameters<T>) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

type Options = { pollMs?: number };

/**
 * useCloudSlice(key, initial, opts?)
 *
 * - Local state is **scoped by farm** (key becomes "<farmId>/<key>")
 * - Resets to `initial` when farm changes (so new farm starts blank)
 * - Pulls from Netlify Blobs on mount and on farm/key change
 * - Debounced push to Blobs when local changes (after initial pull)
 * - Also pulls on window focus / visibility and optional background polling
 */
export function useCloudSlice<T>(key: string, initial: T, opts?: Options) {
  const { farmId } = useFarm() as any;
  const pollMs = opts?.pollMs ?? 30000;

  // Derive the farm-scoped key we will use for BOTH local cache and remote fetch.
  const scopedKey = `${farmId ?? "default"}/${key}`;

  // Local state is also per-farm now (IMPORTANT)
  const { state: local, setState: setLocal } = useServerState<T>(scopedKey, initial);

  // Track switching to prevent accidental pushes during farm change
  const suppressPushRef = useRef(true);
  const lastPulledHash = useRef<string>(""); // to avoid loops
  const pullingCtrl = useRef<AbortController | null>(null);
  const lastScopedKeyRef = useRef<string>(scopedKey);

  // --- Pull once helper ---
  async function pullOnce(k = scopedKey) {
    try {
      pullingCtrl.current?.abort();
      const ctrl = new AbortController();
      pullingCtrl.current = ctrl;

      const res = await fetch(`/.netlify/functions/data?key=${encodeURIComponent(k)}`, {
        credentials: "include",
        signal: ctrl.signal,
      });

      // If 404/missing, treat as no data (keep `initial`) but allow future pushes
      if (!res.ok) {
        suppressPushRef.current = false;
        return;
      }

      const json = await res.json(); // { value }
      if (json?.value !== undefined && !jsonEqual(json.value, local)) {
        setLocal(json.value);
        try { lastPulledHash.current = JSON.stringify(json.value); } catch {}
      }
    } catch {
      // ignore network/auth blips
    } finally {
      suppressPushRef.current = false;
    }
  }

  // --- On farm or key change: reset local to initial and pull fresh ---
  useEffect(() => {
    if (lastScopedKeyRef.current !== scopedKey) {
      lastScopedKeyRef.current = scopedKey;
      suppressPushRef.current = true; // don’t push during switch
      setLocal(initial);              // show clean slate immediately
      pullOnce(scopedKey);            // fetch the new farm’s data
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedKey]);

  // Initial pull on mount
  useEffect(() => {
    suppressPushRef.current = true;
    pullOnce(scopedKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only; farm/key changes handled above

  // Pull on focus / visibility
  useEffect(() => {
    function onFocus() { pullOnce(scopedKey); }
    function onVis() { if (document.visibilityState === "visible") pullOnce(scopedKey); }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedKey]);

  // Optional background polling
  useEffect(() => {
    if (!pollMs) return;
    const id = setInterval(() => pullOnce(scopedKey), pollMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedKey, pollMs]);

  // Debounced push
  const push = useRef(
    debounce(async (value: T, k: string) => {
      try {
        if (suppressPushRef.current) return; // block during farm switches / first load
        const body = JSON.stringify(value);
        if (lastPulledHash.current && lastPulledHash.current === body) return; // no-op
        await fetch(`/.netlify/functions/data?key=${encodeURIComponent(k)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body,
        });
        lastPulledHash.current = body;
      } catch {
        // ignore, next change will retry
      }
    }, 500)
  ).current;

  // Push to cloud when the slice changes
  useEffect(() => {
    push(local, scopedKey);
  }, [local, scopedKey, push]);

  // Same tuple API as before
  return [local, setLocal] as const;
}
