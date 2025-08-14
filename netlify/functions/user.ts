// netlify/functions/user.ts
import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions'
import jwt from 'jsonwebtoken'

type Profile = {
  email: string
  displayName: string
  timezone: string
  marketingOptIn: boolean
  updatedAt: string
}

const COOKIE_NAME = 'cluckhub_session'

// dynamic import avoids ESM/CJS bundling issues
async function getBlobs() {
  return await import('@netlify/blobs')
}

function json(statusCode: number, body: any): HandlerResponse {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
    body: JSON.stringify(body),
  }
}

function text(statusCode: number, body: string): HandlerResponse {
  return {
    statusCode,
    headers: {
      'content-type': 'text/plain',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
    body,
  }
}

function parseCookies(header?: string | null) {
  const out: Record<string, string> = {}
  if (!header) return out
  header.split(';').forEach((part) => {
    const i = part.indexOf('=')
    if (i !== -1) out[part.slice(0, i).trim()] = part.slice(i + 1).trim()
  })
  return out
}

function getAuthSecret() {
  const s = process.env.AUTH_JWT_SECRET
  if (!s) throw new Error('Missing AUTH_JWT_SECRET env var')
  return s
}

function getEmailFromCookie(event: HandlerEvent): string | null {
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
  const token =
    process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_ACCESS_TOKEN
  if (siteID && token) return getStore({ name, siteID, token })
  return getStore(name)
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return text(200, 'ok')

  const email = getEmailFromCookie(event)
  if (!email) return json(401, { error: 'Not authenticated' })

  const action = (event.queryStringParameters?.action || 'get').toLowerCase()
  const store = await getStore()
  const key = `profile:${email.toLowerCase()}`

  try {
    if (action === 'get') {
      const data = (await store.get(key, { type: 'json' })) as Profile | null
      if (data) return json(200, data)
      // default profile on first load
      const profile: Profile = {
        email,
        displayName: email.split('@')[0],
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        marketingOptIn: false,
        updatedAt: new Date().toISOString(),
      }
      await store.setJSON(key, profile)
      return json(200, profile)
    }

    if (action === 'update' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}')
      const updated: Profile = {
        email,
        displayName: String(body.displayName ?? '').slice(0, 80),
        timezone: String(body.timezone ?? 'UTC').slice(0, 64),
        marketingOptIn: Boolean(body.marketingOptIn),
        updatedAt: new Date().toISOString(),
      }
      await store.setJSON(key, updated)
      return json(200, updated)
    }

    return json(405, { error: 'Method Not Allowed' })
  } catch (e: any) {
    return json(500, { error: e?.message || 'Server error' })
  }
}
