import { NextResponse } from "next/server"
import { backendBase, backendHeaders } from "@/lib/backend"

export const dynamic = "force-dynamic"

// Public uptime + configuration probe. Reports presence booleans only — never
// secret values — so a misconfigured deployment is diagnosable without leaking
// anything. Useful for Vercel/uptime monitors and the deploy checklist.
export async function GET() {
  const config = {
    auth_key: !!(process.env.AUTH_ENCRYPTION_KEY || process.env.SESSION_SECRET),
    github_oauth: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    aws_control_plane: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
    internal_token: !!process.env.STEM_INTERNAL_TOKEN,
    api_base: !!process.env.NEXT_PUBLIC_API_BASE,
  }

  let backend: "ok" | "unreachable" | "error" = "error"
  try {
    const res = await fetch(`${backendBase()}/api/health`, {
      cache: "no-store",
      headers: backendHeaders(),
      signal: AbortSignal.timeout(5_000),
    })
    backend = res.ok ? "ok" : "error"
  } catch {
    backend = "unreachable"
  }

  const ready = config.auth_key && config.github_oauth && config.api_base
  return NextResponse.json(
    { ok: true, ready, time: new Date().toISOString(), config, backend },
    { headers: { "Cache-Control": "no-store" } },
  )
}
