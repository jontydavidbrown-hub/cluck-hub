// netlify/functions/farms.ts
import type { Handler } from "@netlify/functions";

interface Farm {
  id: string;
  name: string;
}

const FARMS_KEY = "farms_list"; // stored through your /data function

// Data categories that might exist before any farm was created.
// Adjust to match your app
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

// Build an absolute base URL for calling our own Netlify function
function getBaseURL(event: any): string {
  // Prefer the official site URL if available, else use the incoming host header
  const host = event.headers["x-forwarded-host"] || event.headers.host;
  const proto = (event.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  return `${proto}://${host}`;
}

async function fetchJSON(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const text = await res.text();
  let data: any = undefined;
  try { data = text ? JSON.parse(text) : undefined; } catch {}
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || text || res.statusText || "Request failed";
    throw new Error(msg);
  }
  return data;
}

async function loadFarms(baseURL: string): Promise<Farm[]> {
  // GET /data?key=FARMS_KEY => { value?: any }
  const url = `${baseURL}/.netlify/functions/data?key=${encodeURIComponent(FARMS_KEY)}`;
  const payload = await fetchJSON(url); // { value?: any }
  const list = payload?.value;
  return Array.isArray(list) ? list as Farm[] : [];
}

async function saveFarms(baseURL: string, farms: Farm[]): Promise<void> {
  // POST /data?key=FARMS_KEY with JSON body = farms array
  const url = `${baseURL}/.netlify/functions/data?key=${encodeURIComponent(FARMS_KEY)}`;
  await fetchJSON(url, {
    method: "POST",
    body: JSON.stringify(farms),
  });
}

function makeId() {
  // @ts-ignore
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Copy orphaned keys: data/<key>  -> farm/<farmId>/<key>
async function migrateOrphansToFarm(baseURL: string, farmId: string): Promise<void> {
  for (const key of ORPHAN_KEYS) {
    const fromKey = `data/${key}`;
    const toKey   = `farm/${farmId}/${key}`;

    // GET old
    const getURL = `${baseURL}/.netlify/functions/data?key=${encodeURIComponent(fromKey)}`;
    try {
      const got = await fetchJSON(getURL); // { value?: any }
      if (got?.value == null) continue;

      // POST new
      const setURL = `${baseURL}/.netlify/functions/data?key=${encodeURIComponent(toKey)}`;
      await fetchJSON(setURL, {
        method: "POST",
        body: JSON.stringify(got.value),
      });
    } catch {
      // skip individual failures; never block farm creation
    }
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const baseURL = getBaseURL(event);

    // Always fetch current farms through the /data function
    let farms = await loadFarms(baseURL);

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
      await saveFarms(baseURL, farms);

      // If this is the FIRST farm ever, migrate orphaned data into it
      if (hadNoFarms) {
        try { await migrateOrphansToFarm(baseURL, newFarm.id); } catch {}
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
      await saveFarms(baseURL, farms);
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
