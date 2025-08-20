import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

type Farm = { id: string; name: string };

interface FarmContextType {
  farms: Farm[];
  farmId: string | null;
  setFarmId: (id: string) => void;
  createFarm: (name: string) => Promise<void>;
  deleteFarm: (id: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const FarmContext = createContext<FarmContextType | undefined>(undefined);

// Keys that might have been written before any farm existed.
// Adjust if your app uses different buckets.
const ORPHAN_KEYS = [
  "morts",
  "feed",
  "water",
  "weights",
  "dailyLogs",
  "pickups",
  "reminders",
];

const FARMS_KEY = "farms_list";

// Helpers for calling your existing /data function
function buildURL(key: string) {
  return `/.netlify/functions/data?key=${encodeURIComponent(key)}`;
}

async function getJSON<T = any>(key: string): Promise<T | null> {
  const res = await fetch(buildURL(key), { credentials: "include" });
  const text = await res.text();
  let data: any = text ? JSON.parse(text) : null;
  // /data returns { value?: any }
  return data && "value" in data ? (data.value as T) : null;
}

async function setJSON(key: string, value: any): Promise<void> {
  await fetch(buildURL(key), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}

function makeId() {
  // @ts-ignore
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const FarmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmId, setFarmIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load farms from /data on mount
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await getJSON<Farm[]>(FARMS_KEY);
        if (!alive) return;
        const arr = Array.isArray(list) ? list : [];
        setFarms(arr);
        if (arr.length > 0 && !farmId) setFarmIdState(arr[0].id);
      } catch (e: any) {
        if (alive) setError(e?.message || "Failed to load farms");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Create farm + one-time migrate orphan data into the FIRST farm
  const createFarm = useCallback(async (name: string) => {
    setError(null);
    const clean = String(name || "").trim();
    if (!clean) {
      setError("Please enter a farm name.");
      return;
    }

    const current = (await getJSON<Farm[]>(FARMS_KEY)) ?? [];
    const isFirst = current.length === 0;

    const newFarm: Farm = { id: makeId(), name: clean };
    const next = [...current, newFarm];

    // Persist farms_list
    await setJSON(FARMS_KEY, next);

    // If this is the first farm ever, migrate orphaned buckets into it
    if (isFirst) {
      for (const k of ORPHAN_KEYS) {
        try {
          const orphan = await getJSON<any>(`data/${k}`);
          if (orphan == null) continue;
          await setJSON(`farm/${newFarm.id}/${k}`, orphan);
          // We keep the original orphan copy for safety; you can delete after verifying
        } catch {
          // do not block creation on a single key
        }
      }
    }

    setFarms(next);
    setFarmIdState(newFarm.id);
  }, []);

  // Delete farm
  const deleteFarm = useCallback(async (id: string) => {
    setError(null);
    const current = (await getJSON<Farm[]>(FARMS_KEY)) ?? [];
    const next = current.filter((f) => f.id !== id);
    await setJSON(FARMS_KEY, next);
    setFarms(next);
    if (farmId === id) setFarmIdState(next[0]?.id ?? null);
  }, [farmId]);

  return (
    <FarmContext.Provider
      value={{
        farms,
        farmId,
        setFarmId: setFarmIdState,
        createFarm,
        deleteFarm,
        loading,
        error,
      }}
    >
      {children}
    </FarmContext.Provider>
  );
};

export const useFarm = (): FarmContextType => {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error("useFarm must be used within FarmProvider");
  return ctx;
};
