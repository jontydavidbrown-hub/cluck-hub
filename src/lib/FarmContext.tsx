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

async function fetchJSON(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, { credentials: "include", ...init });
  const text = await res.text();
  let data: any = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    // ignore
  }
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || res.statusText || "Request failed";
    throw new Error(msg);
  }
  return data;
}

export const FarmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmId, setFarmIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load farms on mount
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchJSON("/.netlify/functions/farms");
        if (!alive) return;
        if (Array.isArray(data)) {
          setFarms(data);
          if (data.length > 0 && !farmId) {
            setFarmIdState(data[0].id);
          }
        }
      } catch (e: any) {
        if (alive) setError(e?.message || "Failed to load farms");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createFarm = useCallback(async (name: string) => {
    setError(null);
    const payload = { name: String(name || "").trim() };
    if (!payload.name) {
      setError("Please enter a farm name.");
      return;
    }
    const created = await fetchJSON("/.netlify/functions/farms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    setFarms((prev) => [...prev, created]);
    setFarmIdState(created.id);
  }, []);

  const deleteFarm = useCallback(async (id: string) => {
    setError(null);
    await fetchJSON("/.netlify/functions/farms", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    setFarms((prev) => prev.filter((f) => f.id !== id));
    setFarmIdState((prev) => (prev === id ? null : prev));
  }, []);

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
