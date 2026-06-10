import { NextRequest, NextResponse } from "next/server"
import {
  configuredAccessKey,
  createSessionToken,
  timingSafeEqual,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "@/lib/auth"

export const dynamic = "force-dynamic"

// Best-effort brute-force throttle: 10 attempts per 10 minutes per IP.
// Per-instance only (serverless), which is fine for a single-key demo gate.
const WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 10
const attempts = new Map<string, { count: number; resetAt: number }>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > MAX_ATTEMPTS
}

export async function POST(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim()
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many attempts — try again in a few minutes" }, { status: 429 })
  }

  let body: { email?: unknown; accessKey?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const accessKey = typeof body.accessKey === "string" ? body.accessKey : ""

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 })
  }
  if (!(await timingSafeEqual(accessKey, configuredAccessKey()))) {
    return NextResponse.json({ error: "Invalid access key" }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, await createSessionToken(email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  })
  return res
}
