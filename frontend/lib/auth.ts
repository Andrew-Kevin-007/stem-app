// Session model shared by the OAuth routes and the Edge middleware.
// The whole session is AES-GCM-sealed (see lib/crypto.ts), so the GitHub
// token it carries is never exposed in plaintext, even in the cookie.

import { seal, open } from "./crypto"

export const SESSION_COOKIE = "stem_session"
export const OAUTH_STATE_COOKIE = "stem_oauth_state"
export const SESSION_TTL_SECONDS = 60 * 60 * 12 // 12 hours
export const OAUTH_STATE_TTL_SECONDS = 60 * 10 // 10 minutes

export interface AwsConnection {
  accountId: string
  roleArn: string
  externalId: string
  /** true once an STS AssumeRole has actually succeeded against the role. */
  verified: boolean
  connectedAt: number
}

export interface Session {
  /** GitHub numeric user id, or "demo" for the unconfigured demo session. */
  sub: string
  login: string
  name: string | null
  email: string | null
  avatarUrl: string | null
  /** GitHub user-to-server access token (only present for real sessions). */
  ghToken?: string
  /** Number of orgs/accounts where the user has installed the STEM App. */
  installations: number
  aws?: AwsConnection
  iat: number
  exp: number
  demo?: boolean
}

/** Identity-only view safe to return to the browser (no token). */
export interface PublicSession {
  login: string
  name: string | null
  email: string | null
  avatarUrl: string | null
  installations: number
  aws: { accountId: string; verified: boolean; connectedAt: number } | null
  demo: boolean
}

export function toPublicSession(s: Session): PublicSession {
  return {
    login: s.login,
    name: s.name,
    email: s.email,
    avatarUrl: s.avatarUrl,
    installations: s.installations,
    aws: s.aws ? { accountId: s.aws.accountId, verified: s.aws.verified, connectedAt: s.aws.connectedAt } : null,
    demo: !!s.demo,
  }
}

export async function createSessionToken(
  data: Omit<Session, "iat" | "exp">,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const session: Session = { ...data, iat: now, exp: now + SESSION_TTL_SECONDS }
  return seal(session)
}

export async function readSession(token: string | undefined): Promise<Session | null> {
  const session = await open<Session>(token)
  if (!session || typeof session.sub !== "string") return null
  if (typeof session.exp !== "number" || session.exp * 1000 < Date.now()) return null
  return session
}

export interface OAuthState {
  state: string
  next: string
  iat: number
}

export async function createStateToken(stateValue: string, next: string): Promise<string> {
  return seal({ state: stateValue, next, iat: Math.floor(Date.now() / 1000) } satisfies OAuthState)
}

export async function readStateToken(token: string | undefined): Promise<OAuthState | null> {
  const data = await open<OAuthState>(token)
  if (!data || typeof data.state !== "string") return null
  if (Date.now() / 1000 - data.iat > OAUTH_STATE_TTL_SECONDS) return null
  return data
}

/** Constant-time string comparison (length-independent via hashing). */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder()
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ])
  const ua = new Uint8Array(da)
  const ub = new Uint8Array(db)
  let diff = 0
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i]
  return diff === 0
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
}
