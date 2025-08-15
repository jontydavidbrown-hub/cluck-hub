// netlify/functions/farmData.ts
import type { Handler } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import * as jwt from 'jsonwebtoken';

/**
 * ENV REQUIRED:
 * - AUTH_JWT_SECRET: string used to sign/verify JWT in cluckhub_session cookie
 * OPTIONAL:
 * - BLOB_STORE: custom Netlify Blobs store name (defaults to "cluckhub")
 *
 * PATH:
 * /.netlify/functions/farmData/:farmId/:key
 *
 * KEYS supported (per farm):
 * - dailyLog, waterLogs, deliveries, weights, sheds, settings, allocations, reminders
 *
 * ROLES:
 * - owner, manager: read/write all keys
 * - worker: read all; write input keys (dailyLog, waterLogs, deliveries, weights)
 * - viewer: read-only
 */

const COOKIE_NAME = 'cluckhub_session';
const JWT_SECRET = process.env.AUTH_JWT_SECRET || '';
const STORE_NAME = process.env.BLOB_STORE || 'cluckhub';

// Allow list of keys
const ALLOWED_KEYS = new Set([
  'dailyLog',
  'waterLogs',
  'deliveries',
  'weights',
  'sheds',
  'settings',
  'allocations',
  'reminders',
]);

// Keys a worker is allowed to write
const WORKER_WRITABLE = new Set(['dailyLog', 'waterLogs', 'deliveries', 'weights']);

type Role = 'owner' | 'manager' | 'worker' | 'viewer';
type Member = { email: string; role: Role };
type Farm = {
  id: string;
  name: string;
  ownerEmail: string;
  members: Member[];
  createdAt?: string;
};

type AuthedUser = { email: string };

// --- helpers ---------------------------------------------------------------

function parseCookies(header?: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  const parts = header.split(';');
  for (const p of parts) {
    const [k, ...rest] = p.trim().split('=');
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join('=') || '');
  }
  return out;
}

function jsonResponse(status: number, body: any) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      // CORS
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

function textResponse(status: number, body: string, contentType = 'text/plain') {
  return {
    statusCode: status,
    headers: {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    },
    body,
  };
}

async function getUserFromCookie(event: Parameters<Handler>[0]): Promise<AuthedUser | null> {
  if (!JWT_SECRET) return null;
  const cookieHeader =
    event.headers?.cookie ||
    event.headers?.Cookie ||
    event.multiValueHeaders?.cookie?.[0] ||
    '';
  const cookies = parseCookies(cookieHeader);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!decoded || !decoded.email) return null;
    return { email: decoded.email };
  } catch {
    return null;
  }
}

function roleAllowsWrite(role: Role, key: string): boolean {
  if (role === 'owner' || role === 'manager') return true;
  if (role === 'worker') return WORKER_WRITABLE.has(key);
  return false; // viewer
}

function extractPathParams(fullPath?: string) {
  // fullPath looks like: "/.netlify/functions/farmData/<farmId>/<key>"
  const base = '/.netlify/functions/farmData/';
  if (!fullPath || !fullPath.startsWith(base)) return { farmId: '', key: '' };
  const rest = fullPath.slice(base.length);
  const [farmId, key] = rest.split('/');
  return { farmId, key };
}

// Blob helpers
const store = getStore(STORE_NAME);

async function readJSON<T = any>(key: string): Promise<T | null> {
  const value = await store.get(key, { type: 'json' });
  return (value as T) ?? null;
}

async function writeJSON(key: string, value: any): Promise<void> {
  await store.set(key, JSON.stringify(value), { contentType: 'application/json' });
}

async function getFarm(farmId: string): Promise<Farm | null> {
  return await readJSON<Farm>(`farms/${farmId}.json`);
}

// --- handler ---------------------------------------------------------------

export const handler: Handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return textResponse(204, '');
  }

  try {
    // Auth
    const user = await getUserFromCookie(event);
    if (!user) return jsonResponse(401, { error: 'Not authenticated' });

    // Params
    const { farmId, key } = extractPathParams(event.path);
    if (!farmId || !key) return jsonResponse(400, { error: 'Path must be /farmData/:farmId/:key' });
    if (!ALLOWED_KEYS.has(key)) return jsonResponse(400, { error: `Key "${key}" is not allowed.` });

    // Farm + membership
    const farm = await getFarm(farmId);
    if (!farm) return jsonResponse(404, { error: 'Farm not found' });

    const member = farm.members?.find((m) => m.email === user.email) || null;
    if (!member) return jsonResponse(403, { error: 'Not a member of this farm' });

    // GET: read JSON for key
    if (event.httpMethod === 'GET') {
      const data = await readJSON(`farmData/${farmId}/${key}.json`);
      return jsonResponse(200, { ok: true, data: data ?? null });
    }

    // POST: write JSON for key (with role gate)
    if (event.httpMethod === 'POST') {
      if (!roleAllowsWrite(member.role, key)) {
        return jsonResponse(403, { error: 'Insufficient role to write this key' });
      }

      let body: any = null;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return jsonResponse(400, { error: 'Invalid JSON body' });
      }

      // Optional: lightweight sanity checks per key (extend as needed)
      // Example: ensure arrays for log-like datasets
      if (['dailyLog', 'waterLogs', 'deliveries', 'weights', 'sheds', 'reminders'].includes(key)) {
        if (body !== null && typeof body !== 'object') {
          return jsonResponse(400, { error: 'Body must be an object or array' });
        }
      }
      if (key === 'settings' || key === 'allocations') {
        if (body !== null && typeof body !== 'object') {
          return jsonResponse(400, { error: 'Body must be an object' });
        }
      }

      await writeJSON(`farmData/${farmId}/${key}.json`, body);
      return jsonResponse(200, { ok: true });
    }

    return jsonResponse(405, { error: 'Method not allowed' });
  } catch (e: any) {
    return jsonResponse(500, { error: e?.message || 'Server error' });
  }
};
