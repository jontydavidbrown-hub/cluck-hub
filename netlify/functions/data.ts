// netlify/functions/data.ts
import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions'
import jwt from 'jsonwebtoken'

const COOKIE_NAME = 'cluckhub_session'

// dynamic import avoids ESM/CJS bundling issues
async function getBlobs() {
  // @ts-ignore
  return await import('@netlify/blobs')
}

function json(statusCode: number, body: any, extraHeaders: Record<string, string> = {}): HandlerResponse {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  }
}

function parseCookies(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  raw.split(';').forEach(p => {
    const i = p.indexOf('=')
    if (i > -1) {
      const k = p.slice(0, i).trim()
      const v = decodeURIComponent(p.slice(i + 1).trim())
      out[k] = v
    }
  })
  return out
}

function getAuthSecret(): string {
  const s = process.env.AUTH_JWT_SECRET || process.env.JWT_SECRET || ''
  if (!s) throw new Error('Missing AUTH_JWT_SECRET')
  return s
}

async function getUserEmail(event: HandlerEvent): Promise<string | null> {
  const raw =
    (event.headers['cookie'] as string | undefined) ||
    ((event.headers as any)['Cookie'] as string | undefined) ||
    ''
  const tok = parseCookies(raw)[COOKIE_NAME]
  if (!tok) return null
  try {
    const payload = jwt.verify(tok, getAuthSecret()) as any
    return String(payload.sub || '')
  } catch {
    return null
  }
}

async function getStore() {
  const { getStore } = await getBlobs()
  const name = process.env.BLOB_STORE || 'default'
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID
  const token = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_ACCESS_TOKEN
  if (siteID && token) return getStore({ name, siteID, token })
  return getStore(name)
}

/**
 * Namespaced key format:
 *   data/<email>/<key>
 * where <key> is provided by the client (e.g., "dailyLog", "feedSilos", "weights").
 */
export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(200, { ok: true })

    const email = await getUserEmail(event)
    if (!email) return json(401, { error: 'Not authenticated' })

    const store = await getStore()
    const url = new URL(event.rawUrl)
    const key = url.searchParams.get('key') || (event.queryStringParameters?.key ?? '')
    if (!key) return json(400, { error: 'Missing key' })

    const blobKey = `data/${email}/${key}`

    if (event.httpMethod === 'GET') {
      const existing = await store.get(blobKey, { type: 'json' })
      return json(200, { key, value: existing ?? null })
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}')
      // You may add validation per key here if desired.
      await store.setJSON(blobKey, body)
      return json(200, { ok: true })
    }

    return json(405, { error: 'Method Not Allowed' })
  } catch (e: any) {
    return json(500, { error: e?.message || 'Server error' })
  }
}
