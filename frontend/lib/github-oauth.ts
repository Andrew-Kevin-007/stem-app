// GitHub App user-authorization (OAuth) helpers. STEM is a GitHub App, so
// identity comes from the user-to-server OAuth flow and *repo access* comes
// from the user installing the App on the repos they choose — not from broad
// OAuth scopes. This mirrors how Vercel/Netlify connect GitHub.

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
const TOKEN_URL = "https://github.com/login/oauth/access_token"
const API = "https://api.github.com"

export interface GitHubUser {
  id: number
  login: string
  name: string | null
  avatar_url: string
  email: string | null
}

export function isGitHubOAuthConfigured(): boolean {
  return !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)
}

export function githubAppSlug(): string {
  // Default to the deployed STEM App's slug (named after its private key file).
  return process.env.GITHUB_APP_SLUG || "stem-ci-andrew-kevin-007"
}

/** Where the user installs the STEM App to grant repo access. */
export function appInstallUrl(): string {
  const slug = githubAppSlug()
  return slug
    ? `https://github.com/apps/${slug}/installations/new`
    : "https://github.com/settings/installations"
}

export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const url = new URL(AUTHORIZE_URL)
  url.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID ?? "")
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("state", state)
  // GitHub Apps derive access from App permissions; these scopes cover the
  // case where the same client id is configured as a plain OAuth App.
  url.searchParams.set("scope", "read:user user:email")
  url.searchParams.set("allow_signup", "false")
  return url.toString()
}

export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  })
  if (!res.ok) throw new Error(`GitHub token exchange failed: ${res.status}`)
  const data = (await res.json()) as { access_token?: string; error_description?: string; error?: string }
  if (!data.access_token) {
    throw new Error(data.error_description || data.error || "GitHub returned no access token")
  }
  return data.access_token
}

function authedHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "stem-app",
    "X-GitHub-Api-Version": "2022-11-28",
  }
}

export async function fetchGitHubUser(token: string): Promise<GitHubUser> {
  const res = await fetch(`${API}/user`, { headers: authedHeaders(token) })
  if (!res.ok) throw new Error(`GitHub /user failed: ${res.status}`)
  const user = (await res.json()) as GitHubUser

  // Email is null when the user keeps it private; pull the primary verified one.
  if (!user.email) {
    const emailRes = await fetch(`${API}/user/emails`, { headers: authedHeaders(token) })
    if (emailRes.ok) {
      const emails = (await emailRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>
      const chosen = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified)
      if (chosen) user.email = chosen.email
    }
  }
  return user
}

/** How many orgs/accounts the user has installed the STEM App on. */
export async function fetchInstallationCount(token: string): Promise<number> {
  const res = await fetch(`${API}/user/installations`, { headers: authedHeaders(token) })
  if (!res.ok) return 0
  const data = (await res.json()) as { total_count?: number }
  return data.total_count ?? 0
}
