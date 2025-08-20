import React, { createContext, useContext, useEffect, useState } from "react";

interface Farm {
  id: string;
  name: string;
  [key: string]: any;
}

interface FarmContextType {
  farms: Farm[];
  addFarm: (name: string) => Promise<void>;
}

const FarmContext = createContext<FarmContextType | undefined>(undefined);

export const FarmProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [farms, setFarms] = useState<Farm[]>([]);

  // Load farms from API on mount
  useEffect(() => {
    fetch("/.netlify/functions/farms")
      .then((res) => res.json())
      .then((data) => setFarms(data))
      .catch((err) => console.error("Failed to fetch farms:", err));
  }, []);

  // Add farm and persist to backend
  const addFarm = async (name: string) => {
    try {
      const response = await fetch("/.netlify/functions/farms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const savedFarm = await response.json();
      setFarms((prev) => [...prev, savedFarm]);
    } catch (err) {
      console.error("Failed to save farm:", err);
    }
  };

  return (
    <FarmContext.Provider value={{ farms, addFarm }}>
      {children}
    </FarmContext.Provider>
  );
};

export const useFarms = (): FarmContextType => {
  const context = useContext(FarmContext);
  if (!context) throw new Error("useFarms must be used within FarmProvider");
  return context;
};
