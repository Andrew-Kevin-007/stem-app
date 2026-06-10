/**
 * Helpers for the server-side proxy routes that forward requests to the
 * STEM backend. NEXT_PUBLIC_API_BASE is baked in at build time; the proxy
 * routes run server-side and are not subject to CORS restrictions.
 */

export function backendBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE ?? ""
}

export function backendHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  // If a Vercel Deployment Protection bypass secret is configured, attach it
  // so the server-to-server hop is not blocked by SSO.
  const bypass = process.env.STEM_PROTECTION_BYPASS
  if (bypass) {
    headers["x-vercel-protection-bypass"] = bypass
  }
  return headers
}
