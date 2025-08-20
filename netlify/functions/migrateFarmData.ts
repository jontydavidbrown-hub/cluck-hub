// netlify/functions/migrateFarmData.ts
import type { Handler } from "@netlify/functions";

// Buckets that may exist before a farm was created — customize as needed.
const DEFAULT_KEYS = [
  "morts",
  "feed",
  "water",
  "weights",
  "dailyLogs",
  "pickups",
  "reminders",
];

// Build an absolute URL to call your existing /data gateway.
function getBaseURL(event: any): string {
  const host = event.headers["x-forwarded-host"] || event.headers.host;
  const proto = (event.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  return `${proto}://${host}`;
}

async function fetchJSON(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : undefined; } catch {}
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || text || res.statusText || "Request failed";
    throw new Error(msg);
  }
  return data;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const baseURL = getBaseURL(event);
    const body = JSON.parse(event.body || "{}");
    const farmId: string = String(body.farmId || "").trim();
    const keys: string[] = Array.isArray(body.keys) && body.keys.length ? body.keys : DEFAULT_KEYS;
    const dryRun: boolean = !!body.dryRun; // if true, only lists what would be migrated

    if (!farmId) {
      return { statusCode: 400, body: "farmId is required" };
    }

    const migrated: string[] = [];
    const missing: string[] = [];
    const errors: { key: string; error: string }[] = [];

    for (const k of keys) {
      const fromKey = `data/${k}`;
      const toKey   = `farm/${farmId}/${k}`;

      try {
        // Read orphaned value
        const getURL = `${baseURL}/.netlify/functions/data?key=${encodeURIComponent(fromKey)}`;
        const got = await fetchJSON(getURL); // { value?: any }
        const value = got?.value;
        if (value == null) {
          missing.push(k);
          continue;
        }

        if (!dryRun) {
          const setURL = `${baseURL}/.netlify/functions/data?key=${encodeURIComponent(toKey)}`;
          await fetchJSON(setURL, {
            method: "POST",
            body: JSON.stringify(value),
          });
        }

        migrated.push(k);
      } catch (e: any) {
        errors.push({ key: k, error: e?.message || "unknown error" });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, farmId, migrated, missing, errors, dryRun }),
    };
  } catch (err: any) {
    return { statusCode: 500, body: `Migration failed: ${err?.message || "unknown"}` };
  }
};
