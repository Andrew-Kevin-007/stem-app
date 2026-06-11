import { NextRequest, NextResponse } from "next/server"
import {
  exchangeCodeForToken,
  fetchGitHubUser,
  fetchInstallationCount,
  isGitHubOAuthConfigured,
} from "@/lib/github-oauth"
import { appBaseUrl } from "@/lib/backend"
import {
  createSessionToken,
  readStateToken,
  timingSafeEqual,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth"

export const dynamic = "force-dynamic"

function fail(req: NextRequest, reason: string) {
  const res = NextResponse.redirect(new URL(`/login?error=${reason}`, req.url))
  res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 })
  return res
}

// Step 2: GitHub redirects back with ?code&state. Verify the state against the
// sealed cookie (CSRF), exchange the code server-side, build the session.
export async function GET(req: NextRequest) {
  if (!isGitHubOAuthConfigured()) return fail(req, "oauth_unconfigured")

  const code = req.nextUrl.searchParams.get("code")
  const returnedState = req.nextUrl.searchParams.get("state")
  if (req.nextUrl.searchParams.get("error")) return fail(req, "access_denied")
  if (!code || !returnedState) return fail(req, "missing_code")

  const stored = await readStateToken(req.cookies.get(OAUTH_STATE_COOKIE)?.value)
  if (!stored || !(await timingSafeEqual(stored.state, returnedState))) {
    return fail(req, "state_mismatch")
  }

  try {
    const redirectUri = `${appBaseUrl(req)}/api/auth/github/callback`
    const token = await exchangeCodeForToken(code, redirectUri)
    const user = await fetchGitHubUser(token)
    const installations = await fetchInstallationCount(token)

    const next = stored.next.startsWith("/") && !stored.next.startsWith("//") ? stored.next : "/dashboard"
    const res = NextResponse.redirect(new URL(installations > 0 ? next : "/connect", req.url))
    res.cookies.set(
      SESSION_COOKIE,
      await createSessionToken({
        sub: String(user.id),
        login: user.login,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatar_url,
        ghToken: token,
        installations,
      }),
      sessionCookieOptions,
    )
    res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 })
    return res
  } catch (err) {
    // Log the raw error so it appears in Vercel function logs.
    console.error("[stem/auth/callback] exchange failed:", err)
    const detail = err instanceof Error ? err.message : String(err)
    return fail(req, `exchange_failed&detail=${encodeURIComponent(detail)}`)
  }
}
