// netlify/functions/farms.ts
import { Handler } from "@netlify/functions";
import { get, set } from "@netlify/blobs";

interface Farm {
  id: string;
  name: string;
  // you can add more fields as needed
}

// Where the farms array is stored
const FARMS_KEY = "farms_list";

// Orphaned keys created before any farm existed.
// Adjust this list to match your app's data categories.
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

async function loadFarms(): Promise<Farm[]> {
  const stored = await get(FARMS_KEY);
  if (!stored) return [];
  try {
    const list = await stored.json();
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function saveFarms(farms: Farm[]): Promise<void> {
  await set(FARMS_KEY, JSON.stringify(farms));
}

async function migrateOrphansToFarm(newFarmId: string): Promise<void> {
  // Copy orphaned data keys "data/<key>" -> "farm/<newFarmId>/<key>"
  for (const key of ORPHAN_KEYS) {
    const fromKey = `data/${key}`;
    const res = await get(fromKey);
    if (res) {
      try {
        const val = await res.json(); // assume JSON; adjust if you store as text
        const toKey = `farm/${newFarmId}/${key}`;
        await set(toKey, JSON.stringify(val));
      } catch {
        // If any single key fails to parse, skip it (don’t block creation)
      }
    }
  }
}

function makeId() {
  // Stable unique id
  // @ts-ignore
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    // Always load current farms from persistent storage
    let farms = await loadFarms();

    if (event.httpMethod === "GET") {
      return { statusCode: 200, headers, body: JSON.stringify(farms) };
    }

    if (event.httpMethod === "POST") {
      // Create a farm
      const body = JSON.parse(event.body || "{}");
      const name = (body?.name ?? "").toString().trim();
      if (!name) {
        return { statusCode: 400, headers, body: "Farm must have a name" };
      }

      const newFarm: Farm = { id: makeId(), name };
      const hadNoFarms = farms.length === 0;

      farms.push(newFarm);
      await saveFarms(farms);

      // If this is the first farm ever, migrate orphaned data into it (one-time)
      if (hadNoFarms) {
        try {
          await migrateOrphansToFarm(newFarm.id);
        } catch {
          // Don't fail farm creation if migration hiccups; user can retry later if needed
        }
      }

      return { statusCode: 200, headers, body: JSON.stringify(newFarm) };
    }

    if (event.httpMethod === "DELETE") {
      // Delete a farm
      const body = JSON.parse(event.body || "{}");
      const id = (body?.id ?? "").toString().trim();
      if (!id) {
        return { statusCode: 400, headers, body: "Farm id required" };
      }

      const next = farms.filter((f) => f.id !== id);
      await saveFarms(next);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers, body: "Method Not Allowed" };
  } catch (err: any) {
    return { statusCode: 500, headers, body: `Server error: ${err?.message || "unknown"}` };
  }
};

export { handler };
