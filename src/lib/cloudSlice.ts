// src/lib/cloudSlice.ts
import * as React from "react";
import { dataGet, dataSet } from "./storage";
import { useFarm } from "./FarmContext";

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

const isEqual = (a: any, b: any) => {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return a === b; }
};

export function useCloudSlice<T>(
  sliceKey: string,
  initial: T
): [T, SetState<T>, { saving: boolean; error: string | null }] {
  const { email, farmId } = useFarm();
  const [value, setValue] = React.useState<T>(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const timerRef = React.useRef<any>(null);
  const queuedRef = React.useRef<any>(null);

  const scopedKey = React.useMemo(() => {
    if (!email || !farmId) return null;
    return `u/${encodeURIComponent(email)}/f/${farmId}/${sliceKey}`;
  }, [email, farmId, sliceKey]);

  // Pull once per scope change. Treat null like missing; hydrate with initial.
  React.useEffect(() => {
    let alive = true;
    (async () => {
      setError(null);
      if (!scopedKey) { setValue(initial); return; }
      try {
        const serverVal = await dataGet<T | null>(scopedKey);
        if (!alive) return;
        if (serverVal === undefined || serverVal === null) {
          // write the initial so future loads are stable
          await dataSet(scopedKey, initial);
          setValue(initial);
          return;
        }
        if (!isEqual(serverVal, value)) setValue(serverVal as T);
      } catch (e: any) {
        if (alive) setError(e?.message || "Failed to load"); // keep local value
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedKey]);

  const flush = React.useCallback(async (key: string, next: T) => {
    setSaving(true);
    try { await dataSet(key, next); }
    catch (e: any) { setError(e?.message || "Failed to save"); }
    finally { setSaving(false); }
  }, []);

  const setAndQueue: SetState<T> = React.useCallback((updater) => {
    setValue(prev => {
      const next = typeof updater === "function" ? (updater as any)(prev) : updater;
      if (scopedKey) {
        queuedRef.current = next;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => flush(scopedKey, queuedRef.current), 500);
      }
      return next;
    });
  }, [flush, scopedKey]);

  React.useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return [value, setAndQueue, { saving, error }];
}
