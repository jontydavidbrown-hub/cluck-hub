// netlify/functions/auth.ts
import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

type UserRecord = { email: string; passwordHash: string; createdAt: string }

// ---- Config ----
const COOKIE_NAME = 'cluckhub_session'
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

// Minimal surface we use from the store
type BlobStore = {
  get: (key: string, opts?: any) => Promise<any>
  setJSON: (key: string, value: any) => Promise<void>
}

// --- ESM/CJS interop safe: dynamically import @netlify/blobs ---
async function getBlobs() {
  return await import('@netlify/blobs')
}

// ---- Small helpers that ALWAYS return HandlerResponse ----
function json(
  statusCode: number,
  body: any,
  extraHeaders: Record<string, string> = {}
): HandlerResponse {
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

function text(
  statusCode: number,
  body: string,
  extraHeaders: Record<string, string> = {}
): HandlerResponse {
  return {
    statusCode,
    headers: {
      'content-type': 'text/plain',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
      ...extraHeaders,
    },
    body,
  }
}

function cookieSerialize(
  name: string,
  value: string,
  opts: {
    path?: string
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'Lax' | 'Strict' | 'None' | string
    maxAge?: number
    domain?: string
    expires?: Date
  } = {}
) {
  const pairs = [`${name}=${value}`]
  if (opts.path) pairs.push(`Path=${opts.path}`)
  if (opts.httpOnly) pairs.push('HttpOnly')
  if (opts.secure) pairs.push('Secure')
  if (opts.sameSite) pairs.push(`SameSite=${opts.sameSite}`)
  if (opts.maxAge != null) pairs.push(`Max-Age=${opts.maxAge}`)
  if (opts.domain) pairs.push(`Domain=${opts.domain}`)
  if (opts.expires) pairs.push(`Expires=${opts.expires.toUTCString()}`)
  return pairs.join('; ')
}

function getAuthSecret() {
  const secret = process.env.AUTH_JWT_SECRET
  if (!secret) throw new Error('Missing AUTH_JWT_SECRET env var')
  return secret
}

async function getStoreSmart(): Promise<BlobStore> {
  const { getStore } = await getBlobs()
  const name = process.env.BLOB_STORE || 'cluckhub'
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID
  const token =
    process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_ACCESS_TOKEN

  // If explicit credentials are present (local/off‑Netlify), pass them.
  if (siteID && token) {
    return getStore({ name, siteID, token }) as unknown as BlobStore
  }
  // Otherwise use implicit Netlify Dev/Prod context.
  return getStore(name) as unknown as BlobStore
}

async function getUser(email: string): Promise<UserRecord | null> {
  const store = await getStoreSmart()
  const key = `user:${email.toLowerCase()}`
  const data = (await store.get(key, { type: 'json' })) as UserRecord | null
  return data || null
}

async function putUser(u: UserRecord) {
  const store = await getStoreSmart()
  const key = `user:${u.email.toLowerCase()}`
  await store.setJSON(key, u)
}

function makeToken(email: string) {
  return jwt.sign(
    { sub: email.toLowerCase(), typ: 'session' },
    getAuthSecret(),
    { expiresIn: TOKEN_TTL_SECONDS }
  )
}

function parseCookies(cookieHeader?: string | null) {
  const out: Record<string, string> = {}
  if (!cookieHeader) return out
  cookieHeader.split(';').forEach((part) => {
    const idx = part.indexOf('=')
    if (idx !== -1) out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim()
  })
  return out
}

function verifyToken(token?: string | null): { email: string } | null {
  if (!token) return null
  try {
    const payload = jwt.verify(token, getAuthSecret()) as any
    return { email: String(payload.sub) }
  } catch {
    return null
  }
}

// ---- Handler (ALWAYS returns a HandlerResponse) ----
export const handler: Handler = async (
  event: HandlerEvent
): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') return text(200, 'ok')

  const action = (event.queryStringParameters?.action || 'me').toLowerCase()

  // Netlify sends x-forwarded-proto; use it to decide Secure cookie
  const xfProto =
    (event.headers['x-forwarded-proto'] as string | undefined) ||
    ((event.headers as any)['X-Forwarded-Proto'] as string | undefined) ||
    ''
  const isProd = xfProto.includes('https')
  const secure = isProd || process.env.NODE_ENV === 'production'

  try {
    if (action === 'ping') {
      return json(200, { ok: true, now: Date.now() })
    }

    if (action === 'signup' && event.httpMethod === 'POST') {
      const { email: rawEmail, password = '' } = JSON.parse(event.body || '{}')
      const email = String(rawEmail || '').toLowerCase().trim()
      if (!email || password.length < 6) {
        return json(400, { error: 'Email and password (6+ chars) required' })
      }
      if (await getUser(email)) {
        return json(409, { error: 'Account already exists' })
      }

      const passwordHash = await bcrypt.hash(password, 10)
      await putUser({ email, passwordHash, createdAt: new Date().toISOString() })

      const token = makeToken(email)
      const cookie = cookieSerialize(COOKIE_NAME, token, {
        path: '/',
        httpOnly: true,
        secure,
        sameSite: 'Lax',
        maxAge: TOKEN_TTL_SECONDS,
      })
      return json(200, { ok: true, email }, { 'Set-Cookie': cookie })
    }

    if (action === 'login' && event.httpMethod === 'POST') {
      const { email: rawEmail, password = '' } = JSON.parse(event.body || '{}')
      const email = String(rawEmail || '').toLowerCase().trim()
      const user = await getUser(email)
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return json(401, { error: 'Invalid email or password' })
      }

      const token = makeToken(email)
      const cookie = cookieSerialize(COOKIE_NAME, token, {
        path: '/',
        httpOnly: true,
        secure,
        sameSite: 'Lax',
        maxAge: TOKEN_TTL_SECONDS,
      })
      return json(200, { ok: true, email }, { 'Set-Cookie': cookie })
    }

    if (action === 'logout' && (event.httpMethod === 'POST' || event.httpMethod === 'GET')) {
      const cookie = cookieSerialize(COOKIE_NAME, 'deleted', {
        path: '/',
        httpOnly: true,
        secure,
        sameSite: 'Lax',
        expires: new Date(0),
      })
      return json(200, { ok: true }, { 'Set-Cookie': cookie })
    }

    if (action === 'me') {
      const rawCookie =
        (event.headers['cookie'] as string | undefined) ||
        ((event.headers as any)['Cookie'] as string | undefined) ||
        ''
      const tok = parseCookies(rawCookie)[COOKIE_NAME]
      const ses = verifyToken(tok)
      return json(200, { email: ses?.email || null })
    }

    // Unknown action or wrong method
    return json(405, { error: 'Method Not Allowed' })
  } catch (e: any) {
    return json(500, { error: e?.message || 'Server error' })
  }
}
