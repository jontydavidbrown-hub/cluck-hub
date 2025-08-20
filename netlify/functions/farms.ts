// netlify/functions/farms.ts
import type { Handler } from "@netlify/functions";

interface Farm {
  id: string;
  name: string;
}

const STORE_NAME = "app-data";         // name of your site-wide store (any string w/o "/" or ":")
const FARMS_KEY  = "farms_list";       // key inside the store

// Keys that may exist if the user added data before farms existed.
// Adjust this list to match your app.
const ORPHAN_KEYS = [
  "morts",
  "feed",
  "water",
  "weights",
  "dailyLogs",
  "pickups",
  "reminders",
];

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// dynamic import to avoid ESM/CJS crash
async function getStoreApi() {
  const { getStore } = await import("@netlify/blobs");
  return getStore(STORE_NAME);
}

function makeId() {
  // @ts-ignore
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function loadFarms(): Promise<Farm[]> {
  const store = await getStoreApi();
  const list = (await store.get(FARMS_KEY, { type: "json" })) as Farm[] | null;
  return Array.isArray(list) ? list : [];
}

async function saveFarms(farms: Farm[]) {
  const store = await getStoreApi();
  await store.setJSON(FARMS_KEY, farms);
}

async function migrateOrphansToFarm(farmId: string) {
  const store = await getStoreApi();

  for (const key of ORPHAN_KEYS) {
    const fromKey = `data/${key}`;
    try {
      const value = await store.get(fromKey, { type: "json" });
      if (value == null) continue; // nothing to migrate
      const toKey = `farm/${farmId}/${key}`;
      await store.setJSON(toKey, value);
    } catch {
      // skip individual failures; don’t block creation
    }
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    let farms = await loadFarms();

    // GET: list farms
    if (event.httpMethod === "GET") {
      return { statusCode: 200, headers, body: JSON.stringify(farms) };
    }

    // POST: create farm (and if it's the first, migrate orphaned data into it)
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const name = String(body?.name ?? "").trim();
      if (!name) {
        return { statusCode: 400, headers, body: "Farm must have a name" };
      }

      const hadNoFarms = farms.length === 0;
      const newFarm: Farm = { id: makeId(), name };

      farms.push(newFarm);
      await saveFarms(farms);

      if (hadNoFarms) {
        try { await migrateOrphansToFarm(newFarm.id); } catch {}
      }

      return { statusCode: 200, headers, body: JSON.stringify(newFarm) };
    }

    // DELETE: remove farm
    if (event.httpMethod === "DELETE") {
      const body = JSON.parse(event.body || "{}");
      const id = String(body?.id ?? "").trim();
      if (!id) {
        return { statusCode: 400, headers, body: "Farm id required" };
      }

      farms = farms.filter((f) => f.id !== id);
      await saveFarms(farms);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers, body: "Method Not Allowed" };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers,
      body: `Server error: ${err?.message || "unknown"}`,
    };
  }
};
