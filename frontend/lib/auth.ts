// Session auth shared by the login route and the middleware.
// Web Crypto only — this must run in both the Node.js route runtime and the
// Edge middleware runtime, so no node:crypto imports.

const DEMO_ACCESS_KEY = "stem-demo"

export const SESSION_COOKIE = "stem_session"
export const SESSION_TTL_SECONDS = 60 * 60 * 12 // 12 hours

/** The access key visitors must present at /login. Demo key when unset. */
export function configuredAccessKey(): string {
  return process.env.DASHBOARD_ACCESS_KEY || DEMO_ACCESS_KEY
}

/** True when running on the publicly documented demo key. */
export function isDemoMode(): boolean {
  return !process.env.DASHBOARD_ACCESS_KEY
}

function signingSecret(): string {
  // Production deployments should set SESSION_SECRET; the derived fallback
  // keeps the demo working without configuration.
  return process.env.SESSION_SECRET || `stem-session::${configuredAccessKey()}`
}

const encoder = new TextEncoder()

function toBase64Url(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const bin = atob(value.replace(/-/g, "+").replace(/_/g, "/"))
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

async function hmac(payload: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)))
}

/**
 * Constant-time equality. Both inputs are hashed first so neither length nor
 * prefix structure leaks through the comparison.
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ])
  const ua = new Uint8Array(da)
  const ub = new Uint8Array(db)
  let diff = 0
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i]
  return diff === 0
}

export interface Session {
  email: string
  exp: number
}

export async function createSessionToken(email: string): Promise<string> {
  const payload = toBase64Url(
    encoder.encode(
      JSON.stringify({ email, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }),
    ),
  )
  const sig = toBase64Url(await hmac(payload))
  return `${payload}.${sig}`
}

export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null
  const [payload, sig] = token.split(".")
  if (!payload || !sig) return null

  const expected = toBase64Url(await hmac(payload))
  if (!(await timingSafeEqual(sig, expected))) return null

  const bytes = fromBase64Url(payload)
  if (!bytes) return null
  try {
    const session = JSON.parse(new TextDecoder().decode(bytes)) as Session
    if (typeof session.email !== "string" || typeof session.exp !== "number") return null
    if (session.exp * 1000 < Date.now()) return null
    return session
  } catch {
    return null
  }
}
