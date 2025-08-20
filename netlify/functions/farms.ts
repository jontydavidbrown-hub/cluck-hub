// netlify/functions/farms.ts
import type { Handler } from "@netlify/functions";

interface Farm {
  id: string;
  name: string;
}

const FARMS_KEY = "farms_list";

// Adjust this list to the orphaned datasets your app uses
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

// Use dynamic import to avoid ESM/CJS crash with @netlify/blobs
async function blobs() {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const mod: typeof import("@netlify/blobs") = await import("@netlify/blobs");
  return mod;
}

async function loadFarms() {
  const { get } = await blobs();
  const stored = await get(FARMS_KEY);
  if (!stored) return [] as Farm[];
  try {
    const json = await stored.json();
    return Array.isArray(json) ? (json as Farm[]) : [];
  } catch {
    return [] as Farm[];
  }
}

async function saveFarms(farms: Farm[]) {
  const { set } = await blobs();
  await set(FARMS_KEY, JSON.stringify(farms));
}

function makeId() {
  // @ts-ignore
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function migrateOrphansToFarm(farmId: string) {
  const { get, set } = await blobs();

  for (const key of ORPHAN_KEYS) {
    const fromKey = `data/${key}`;
    try {
      const res = await get(fromKey);
      if (!res) continue;
      const value = await res.json(); // if you stored text, change to await res.text()
      const toKey = `farm/${farmId}/${key}`;
      await set(toKey, JSON.stringify(value));
    } catch {
      // Skip individual failures; don’t block farm creation.
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
      const name = (body?.name ?? "").toString().trim();
      if (!name) {
        return { statusCode: 400, headers, body: "Farm must have a name" };
      }

      const hadNoFarms = farms.length === 0;
      const newFarm: Farm = { id: makeId(), name };
      farms.push(newFarm);
      await saveFarms(farms);

      if (hadNoFarms) {
        // One‑time: move orphaned data into the very first farm ever created
        try {
          await migrateOrphansToFarm(newFarm.id);
        } catch {
          // swallow migration errors; creation still succeeds
        }
      }

      return { statusCode: 200, headers, body: JSON.stringify(newFarm) };
    }

    if (event.httpMethod === "DELETE") {
      const body = JSON.parse(event.body || "{}");
      const id = (body?.id ?? "").toString().trim();
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
