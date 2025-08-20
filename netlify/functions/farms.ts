// netlify/functions/farms.ts
import type { Handler } from "@netlify/functions";

interface Farm {
  id: string;
  name: string;
}

const STORE_NAME = "app-data";      // any simple string
const FARMS_KEY  = "farms_list";

// Adjust to your actual datasets that might exist pre-farm
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

// Dynamic import to avoid ESM/CJS issues
async function getStoreApi() {
  const mod = await import("@netlify/blobs");
  const siteID = process.env.NETLIFY_SITE_ID;
  const token  = process.env.NETLIFY_AUTH_TOKEN;

  if (!siteID || !token) {
    throw new Error(
      "Blobs not configured. Please set NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN as environment variables."
    );
  }

  // getStore(name, options)
  return mod.getStore(STORE_NAME, { siteID, token });
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
      if (value == null) continue;
      const toKey = `farm/${farmId}/${key}`;
      await store.setJSON(toKey, value);
    } catch {
      // Skip individual failures; don't block farm creation
    }
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    let farms = await loadFarms();

    if (event.httpMethod === "GET") {
      return { statusCode: 200, headers, body: JSON.stringify(farms) };
    }

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
