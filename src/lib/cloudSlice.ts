// src/lib/cloudSlice.ts
import * as React from "react";
import { dataGet, dataSet } from "./storage";
import { useFarm } from "./FarmContext";

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

const isEqual = (a: any, b: any) => {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return a === b; }
};

export function useCloudSlice<T>(sliceKey: string, initial: T): [T, SetState<T>, { saving: boolean; error: string | null }] {
  const { email, farmId } = useFarm();
  const [value, setValue] = React.useState<T>(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const keyRef = React.useRef<string | null>(null);
  const queuedRef = React.useRef<any>(null);
  const timerRef = React.useRef<any>(null);

  const scopedKey = React.useMemo(() => {
    if (!email || !farmId) return null;
    return `u/${encodeURIComponent(email)}/f/${farmId}/${sliceKey}`;
  }, [email, farmId, sliceKey]);

  // pull on mount and whenever scope changes
  React.useEffect(() => {
    let alive = true;
    (async () => {
      setError(null);
      if (!scopedKey) { setValue(initial); return; }
      keyRef.current = scopedKey;
      try {
        const serverVal = await dataGet<T>(scopedKey);
        if (!alive) return;
        if (serverVal !== undefined && !isEqual(serverVal, value)) {
          setValue(serverVal as T);
        } else if (serverVal === undefined) {
          // initialize empty slice on server (optional)
          await dataSet(scopedKey, initial);
        }
      } catch (e: any) {
        if (alive) setError(e?.message || "Failed to load");
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedKey]);

  // debounced push
  const flush = React.useCallback(async () => {
    if (!scopedKey) return;
    const next = queuedRef.current;
    queuedRef.current = null;
    if (next === null || next === undefined) return;
    setSaving(true);
    try {
      await dataSet(scopedKey, next);
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [scopedKey]);

  // setter that queues debounced save
  const setAndQueue: SetState<T> = React.useCallback((updater) => {
    setValue(prev => {
      const next = typeof updater === "function" ? (updater as any)(prev) : updater;
      // do not attempt to write without scope (blocks orphan writes)
      if (scopedKey) {
        queuedRef.current = next;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flush, 500);
      }
      return next;
    });
  }, [flush, scopedKey]);

  React.useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return [value, setAndQueue, { saving, error }];
}
