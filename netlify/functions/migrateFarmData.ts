// netlify/functions/migrateFarmData.ts
import type { Handler } from "@netlify/functions";

const DEFAULT_KEYS = [
  "morts",
  "feed",
  "water",
  "weights",
  "dailyLogs",
  "pickups",
  "reminders",
];

// Build absolute URL to call our own /data function
function getBaseURL(event: any): string {
  const host = event.headers["x-forwarded-host"] || event.headers.host;
  const proto = (event.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  return `${proto}://${host}`;
}

function authHeadersFrom(event: any) {
  const cookie = event.headers.cookie || event.headers.Cookie;
  const authorization = event.headers.authorization || event.headers.Authorization;
  return {
    ...(cookie ? { Cookie: cookie } : {}),
    ...(authorization ? { Authorization: authorization } : {}),
  };
}

async function fetchJSON(url: string, init: RequestInit, extraHeaders: Record<string, string>) {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
      ...(init.headers || {}),
    },
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
    const { farmId, keys, dryRun } = JSON.parse(event.body || "{}") as {
      farmId: string;
      keys?: string[];
      dryRun?: boolean;
    };
    if (!farmId) return { statusCode: 400, body: "farmId is required" };

    const baseURL = getBaseURL(event);
    const passAuth = authHeadersFrom(event);
    const list = Array.isArray(keys) && keys.length ? keys : DEFAULT_KEYS;

    const migrated: string[] = [];
    const missing: string[] = [];
    const errors: { key: string; error: string }[] = [];

    for (const k of list) {
      const fromKey = `data/${k}`;
      const toKey   = `farm/${farmId}/${k}`;

      try {
        // GET orphan
        const got = await fetchJSON(
          `${baseURL}/.netlify/functions/data?key=${encodeURIComponent(fromKey)}`,
          { method: "GET" },
          passAuth
        ); // returns { value?: any }

        const value = got?.value;
        if (value == null) { missing.push(k); continue; }

        if (!dryRun) {
          await fetchJSON(
            `${baseURL}/.netlify/functions/data?key=${encodeURIComponent(toKey)}`,
            { method: "POST", body: JSON.stringify(value) },
            passAuth
          );
        }

        migrated.push(k);
      } catch (e: any) {
        errors.push({ key: k, error: e?.message || "unknown error" });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, farmId, migrated, missing, errors, dryRun: !!dryRun }),
    };
  } catch (err: any) {
    return { statusCode: 500, body: `Migration failed: ${err?.message || "unknown"}` };
  }
};
