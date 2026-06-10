import { NextResponse } from "next/server"
import { isGitHubOAuthConfigured } from "@/lib/github-oauth"
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth"

export const dynamic = "force-dynamic"

// Demo session — only available when real GitHub OAuth is NOT configured, so
// production (with a client id set) never exposes a credential-free entry.
export async function POST() {
  if (isGitHubOAuthConfigured()) {
    return NextResponse.json({ error: "Demo mode disabled — sign in with GitHub" }, { status: 403 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(
    SESSION_COOKIE,
    await createSessionToken({
      sub: "demo",
      login: "demo-operator",
      name: "Demo Operator",
      email: null,
      avatarUrl: null,
      installations: 0,
      demo: true,
    }),
    sessionCookieOptions,
  )
  return res
}
