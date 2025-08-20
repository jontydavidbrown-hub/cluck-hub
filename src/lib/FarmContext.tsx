// src/lib/FarmContext.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { dataGet, dataSet } from "./storage";

type Farm = { id: string; name: string; role?: "owner" | "member" };

type FarmContextType = {
  farms: Farm[];
  farmId: string | null;
  setFarmId: (id: string | null) => void;
  createFarm: (name: string) => Promise<void>;
  deleteFarm: (id: string) => Promise<void>;
  email: string | null;
  loading: boolean;
  error: string | null;
};

const FarmContext = createContext<FarmContextType | undefined>(undefined);

function safeEmail(e?: string | null): string | null {
  if (!e) return null;
  const s = String(e).trim().toLowerCase();
  return /\S+@\S+\.\S+/.test(s) ? s : null;
}

async function detectEmail(): Promise<string | null> {
  const candidates = [
    "/.netlify/functions/me",
    "/.netlify/functions/user",
    "/.netlify/functions/session",
    "/api/me",
  ];
  for (const url of candidates) {
    try {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) continue;
      const j = await r.json().catch(() => ({}));
      const e =
        j?.email ||
        j?.user?.email ||
        j?.account?.email ||
        j?.data?.email ||
        j?.profile?.email;
      const ok = safeEmail(e);
      if (ok) return ok;
    } catch {}
  }
  return null;
}

function uid(): string {
  // @ts-ignore
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// canonical keys
const userRoot = (email: string) => `u/${encodeURIComponent(email)}`;
const kFarms = (email: string) => `${userRoot(email)}/farms`;
const kCurrentFarm = (email: string) => `${userRoot(email)}/currentFarm`;

// Optional: one‑time migration from legacy "default/*" buckets to the first farm
const LEGACY_KEYS = ["morts", "feed", "water", "weights", "dailyLogs", "pickups", "reminders"];

async function migrateLegacyDefaultToFarm(email: string, farmId: string) {
  // If you never had default/* data, this is a no‑op
  for (const key of LEGACY_KEYS) {
    const legacy = await dataGet<any>(`default/${key}`);
    if (legacy == null) continue;
    await dataSet(`${userRoot(email)}/f/${farmId}/${key}`, legacy);
    // leave legacy data in place for safety; you can delete once verified
  }
}

export const FarmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [email, setEmail] = useState<string | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmId, setFarmIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setErr] = useState<string | null>(null);

  // detect email then load farms + current
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const e = await detectEmail();
        if (!alive) return;
        setEmail(e);
        if (!e) {
          setFarms([]);
          setFarmIdState(null);
          return;
        }
        const list = (await dataGet<Farm[]>(kFarms(e))) || [];
        const current = (await dataGet<string>(kCurrentFarm(e))) || list[0]?.id || null;
        setFarms(list);
        setFarmIdState(current);
      } catch (err: any) {
        if (alive) setErr(err?.message || "Failed to load farms");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const setFarmId = useCallback(async (id: string | null) => {
    setFarmIdState(id);
    if (email && id) await dataSet(kCurrentFarm(email), id);
  }, [email]);

  const createFarm = useCallback(async (name: string) => {
    const nm = String(name || "").trim();
    if (!nm) throw new Error("Farm name required");
    if (!email) throw new Error("Please sign in");
    const list = (await dataGet<Farm[]>(kFarms(email))) || [];
    const isFirst = list.length === 0;
    const f: Farm = { id: uid(), name: nm, role: "owner" };
    const next = [...list, f];
    await dataSet(kFarms(email), next);
    await dataSet(kCurrentFarm(email), f.id);
    setFarms(next);
    setFarmIdState(f.id);
    if (isFirst) {
      // migrate legacy "default/*" buckets into this first farm (safe copy)
      await migrateLegacyDefaultToFarm(email, f.id);
    }
  }, [email]);

  const deleteFarm = useCallback(async (id: string) => {
    if (!email) throw new Error("Please sign in");
    const list = (await dataGet<Farm[]>(kFarms(email))) || [];
    const next = list.filter(f => f.id !== id);
    await dataSet(kFarms(email), next);
    setFarms(next);
    if (farmId === id) {
      const newId = next[0]?.id || null;
      setFarmIdState(newId);
      if (newId) await dataSet(kCurrentFarm(email), newId);
    }
    // NOTE: we do not delete the farm's data; that’s your call.
  }, [email, farmId]);

  const value = useMemo<FarmContextType>(() => ({
    farms,
    farmId,
    setFarmId,
    createFarm,
    deleteFarm,
    email,
    loading,
    error,
  }), [farms, farmId, setFarmId, createFarm, deleteFarm, email, loading, error]);

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
};

export function useFarm(): FarmContextType {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error("useFarm must be used within FarmProvider");
  return ctx;
}
