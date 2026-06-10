import { NextRequest, NextResponse } from "next/server"
import { buildAuthorizeUrl, isGitHubOAuthConfigured } from "@/lib/github-oauth"
import { appBaseUrl } from "@/lib/backend"
import { createStateToken, OAUTH_STATE_COOKIE, OAUTH_STATE_TTL_SECONDS } from "@/lib/auth"

export const dynamic = "force-dynamic"

function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard"
}

// Step 1 of the OAuth dance: mint a CSRF state, stash it in a sealed
// httpOnly cookie, and bounce the user to GitHub's consent screen.
export async function GET(req: NextRequest) {
  if (!isGitHubOAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?error=oauth_unconfigured", req.url))
  }

  const next = safeNext(req.nextUrl.searchParams.get("next"))
  const stateValue = crypto.randomUUID()
  const redirectUri = `${appBaseUrl(req)}/api/auth/github/callback`

  const res = NextResponse.redirect(buildAuthorizeUrl(redirectUri, stateValue))
  res.cookies.set(OAUTH_STATE_COOKIE, await createStateToken(stateValue, next), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_STATE_TTL_SECONDS,
  })
  return res
}
