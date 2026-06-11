import { NextRequest, NextResponse } from "next/server"
import { readSession, createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 })

  const res = NextResponse.json({ ok: true })
  res.cookies.set(
    SESSION_COOKIE,
    await createSessionToken({
      sub: session.sub,
      login: session.login,
      name: session.name,
      email: session.email,
      avatarUrl: session.avatarUrl,
      ghToken: session.ghToken,
      installations: session.installations,
    }),
    sessionCookieOptions,
  )
  return res
}
