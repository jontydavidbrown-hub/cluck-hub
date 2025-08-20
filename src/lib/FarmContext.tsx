import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

type Farm = { id: string; name?: string };

interface FarmContextType {
  farms: Farm[];
  farmId: string | null;
  setFarmId: (id: string) => void;
  createFarm: (name: string) => Promise<void>;
  deleteFarm: (id: string) => Promise<void>;
}

const FarmContext = createContext<FarmContextType | undefined>(undefined);

export const FarmProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmId, setFarmIdState] = useState<string | null>(null);

  // Load farms from API (Netlify function) on mount
  useEffect(() => {
    fetch("/.netlify/functions/farms", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setFarms(data);
          if (data.length > 0 && !farmId) {
            setFarmIdState(data[0].id);
          }
        }
      })
      .catch((err) => console.error("Failed to fetch farms:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Create farm and persist to backend
  const createFarm = useCallback(async (name: string) => {
    try {
      const response = await fetch("/.netlify/functions/farms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error(await response.text());
      const savedFarm = await response.json();
      setFarms((prev) => [...prev, savedFarm]);
      setFarmIdState(savedFarm.id);
    } catch (err) {
      console.error("Failed to create farm:", err);
    }
  }, []);

  // Delete farm and persist to backend
  const deleteFarm = useCallback(async (id: string) => {
    try {
      const response = await fetch("/.netlify/functions/farms", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error(await response.text());
      setFarms((prev) => prev.filter((f) => f.id !== id));
      if (farmId === id) {
        setFarmIdState(null);
      }
    } catch (err) {
      console.error("Failed to delete farm:", err);
    }
  }, [farmId]);

  return (
    <FarmContext.Provider
      value={{
        farms,
        farmId,
        setFarmId: setFarmIdState,
        createFarm,
        deleteFarm,
      }}
    >
      {children}
    </FarmContext.Provider>
  );
};

export const useFarm = (): FarmContextType => {
  const context = useContext(FarmContext);
  if (!context) {
    throw new Error("useFarm must be used within FarmProvider");
  }
  return context;
};
