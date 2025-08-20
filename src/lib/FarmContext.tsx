import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

type FarmMeta = { id: string; name: string };
type Ctx = {
  farms: FarmMeta[];
  farmId: string | null;
  setFarmId: (id: string) => void;
  createFarm: (name: string) => Promise<string | null>;
  deleteFarm: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

export const FarmCtx = createContext<Ctx | null>(null);
export function useFarm() {
  const v = useContext(FarmCtx);
  if (!v) throw new Error("useFarm must be used within <FarmProvider>");
  return v;
}

// ------- helpers -------
const getJSON = async (key: string) => {
  try {
    const r = await fetch(`/.netlify/functions/data?key=${encodeURIComponent(key)}`, {
      credentials: "include",
    });
    if (!r.ok) return null; // 4xx/5xx → treat as missing
    const j = await r.json().catch(() => null);
    return j && typeof j === "object" && "value" in j ? (j as any).value : j;
  } catch {
    return null; // CORS / network
  }
};

const setJSON = async (key: string, value: any) => {
  try {
    await fetch(`/.netlify/functions/data?key=${encodeURIComponent(key)}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    return true;
  } catch {
    return false;
  }
};

const delKey = async (key: string) => {
  try {
    await fetch(`/.netlify/functions/data?key=${encodeURIComponent(key)}`, {
      method: "DELETE",
      credentials: "include",
    });
  } catch {
    /* ignore */
  }
};

const LS_FARMS = "farmsLocal";
const LS_FARMID = "farmId";

const readLSFarms = (): FarmMeta[] => {
  try {
    const raw = localStorage.getItem(LS_FARMS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    const list = Array.isArray(arr) ? arr : (arr && typeof arr === "object" ? Object.values(arr) : []);
    return list
      .filter((f: any) => f && typeof f === "object" && typeof f.id === "string")
      .map((f: any) => ({ id: f.id, name: String(f.name || "") }));
  } catch {
    return [];
  }
};
const writeLSFarms = (farms: FarmMeta[]) => {
  try {
    localStorage.setItem(LS_FARMS, JSON.stringify(farms));
  } catch {}
};
const readLSFarmId = (): string | null => {
  try {
    const v = localStorage.getItem(LS_FARMID);
    return v && typeof v === "string" ? v : null;
  } catch {
    return null;
  }
};
const writeLSFarmId = (id: string) => {
  try {
    localStorage.setItem(LS_FARMID, id);
  } catch {}
};

const uniqById = (arr: FarmMeta[]) => {
  const seen = new Set<string>();
  const out: FarmMeta[] = [];
  for (const f of arr) {
    if (!f || typeof f !== "object" || typeof f.id !== "string") continue;
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    out.push({ id: f.id, name: f.name || "" });
  }
  return out;
};

// Normalize user/farms payload → FarmMeta[]
const normalizeFarmsPayload = async (payload: any): Promise<FarmMeta[]> => {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
    ? Object.values(payload)
    : [];

  // If it looks like ids, fetch each meta
  const looksLikeIds = list.every((x) => typeof x === "string");
  if (looksLikeIds) {
    const metas: FarmMeta[] = [];
    for (const id of list as string[]) {
      if (!id) continue;
      const meta = await getJSON(`farm/${id}/meta`);
      if (meta && typeof meta === "object" && typeof meta.id === "string") {
        metas.push({ id: meta.id, name: String(meta.name || "") });
      } else {
        // If meta missing, still keep the id
        metas.push({ id, name: "" });
      }
    }
    return uniqById(metas);
  }

  // Otherwise expect objects with id/name
  const metas = (list as any[]).map((f) => ({
    id: typeof f?.id === "string" ? f.id : String(f?.id || "").trim(),
    name: String(f?.name || ""),
  }));
  return uniqById(metas);
};

export function FarmProvider({ children }: { children: ReactNode }) {
  const [farms, setFarms] = useState<FarmMeta[]>([]);
  const [farmId, setFarmIdState] = useState<string | null>(null);
  const [initDone, setInitDone] = useState(false);

  // Initial load (server → fallback to LS)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // try server
      let metas: FarmMeta[] | null = null;
      const userFarms = await getJSON("user/farms");
      if (userFarms) metas = await normalizeFarmsPayload(userFarms);

      // fallbacks
      if (!metas || metas.length === 0) metas = readLSFarms();

      // selection
      let sel: string | null = null;
      const selServer = await getJSON("user/selectedFarmId");
      sel = typeof selServer === "string" && selServer ? selServer : readLSFarmId();

      // apply
      if (!cancelled) {
        const cleaned = uniqById(metas || []);
        setFarms(cleaned);
        const safeSel =
          (sel && cleaned.some((f) => f.id === sel) && sel) || (cleaned[0]?.id ?? null);
        setFarmIdState(safeSel);
        // persist (best-effort)
        writeLSFarms(cleaned);
        if (safeSel) writeLSFarmId(safeSel);
        if (safeSel) setJSON("user/selectedFarmId", safeSel);
      }

      setInitDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // public setter writes both places best-effort and guards invalid ids
  const setFarmId = (id: string) => {
    const valid = farms.some((f) => f.id === id);
    const next = valid ? id : farms[0]?.id ?? null;
    setFarmIdState(next);
    if (next) {
      writeLSFarmId(next);
      setJSON("user/selectedFarmId", next);
    }
  };

  // Create a farm
  const createFarm = async (name: string): Promise<string | null> => {
    const id = (crypto && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2));
    const meta: FarmMeta = { id, name: name?.trim() || "" };

    // optimistic
    setFarms((prev) => uniqById([...(prev || []), meta]));
    writeLSFarms(uniqById([...(farms || []), meta]));

    // server best-effort
    await setJSON(`farm/${id}/meta`, meta);
    const serverList = await getJSON("user/farms");
    let newList: any[] = [];
    if (Array.isArray(serverList)) newList = [...serverList];
    else if (serverList && typeof serverList === "object") newList = Object.values(serverList);
    newList.push(id);
    await setJSON("user/farms", newList);

    // select it
    setFarmId(id);
    return id;
  };

  // Delete a farm (best-effort server cleanup + local)
  const deleteFarm = async (id: string) => {
    // local optimistic
    setFarms((prev) => (prev || []).filter((f) => f && f.id !== id));
    writeLSFarms((farms || []).filter((f) => f && f.id !== id));
    if (farmId === id) {
      const first = (farms || []).find((f) => f && f.id !== id)?.id ?? null;
      setFarmIdState(first);
      if (first) writeLSFarmId(first);
    }

    // server-side best-effort cleanup
    await delKey(`farm/${id}/meta`);
    await delKey(`farm/${id}/members`);
    const slices = ["sheds","morts","pickups","feedDeliveries","feedStocktakes","weights","water","reminders","settings","feedQuotas"];
    await Promise.all(slices.map((k) => delKey(`${id}/${k}`)));

    const serverList = await getJSON("user/farms");
    let next: any[] = [];
    if (Array.isArray(serverList)) next = serverList.filter((x) => x !== id);
    else if (serverList && typeof serverList === "object") {
      next = Object.values(serverList).filter((x: any) => x !== id && x?.id !== id);
    } else {
      next = (farms || []).filter((f) => f && f.id !== id).map((f) => f.id);
    }
    await setJSON("user/farms", next);
  };

  const refresh = async () => {
    const serverFarms = await getJSON("user/farms");
    const metas = serverFarms ? await normalizeFarmsPayload(serverFarms) : readLSFarms();
    const cleaned = uniqById(metas || []);
    setFarms(cleaned);
    writeLSFarms(cleaned);

    const selServer = await getJSON("user/selectedFarmId");
    const sel = typeof selServer === "string" && selServer ? selServer : readLSFarmId();
    const safeSel =
      (sel && cleaned.some((f) => f.id === sel) && sel) || (cleaned[0]?.id ?? null);
    setFarmIdState(safeSel);
    if (safeSel) writeLSFarmId(safeSel);
  };

  const value = useMemo<Ctx>(
    () => ({
      farms,
      farmId,
      setFarmId,
      createFarm,
      deleteFarm,
      refresh,
    }),
    [farms, farmId]
  );

  // Prevent consumers from rendering until the first pass is done
  if (!initDone) {
    return <>{/* initial loading gate to avoid null flashes */}</>;
  }

  return <FarmCtx.Provider value={value}>{children}</FarmCtx.Provider>;
}
