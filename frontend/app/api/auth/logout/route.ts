import { NextResponse } from "next/server"
import { SESSION_COOKIE, OAUTH_STATE_COOKIE } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 })
  res.cookies.set(OAUTH_STATE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 })
  return res
}
