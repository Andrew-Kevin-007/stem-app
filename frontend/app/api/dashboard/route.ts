import { NextRequest, NextResponse } from "next/server"
import { backendBase, backendHeaders } from "@/lib/backend"
import { readSession, SESSION_COOKIE } from "@/lib/auth"

export const dynamic = "force-dynamic"

// Same-origin proxy to the STEM backend. The backend sends no CORS headers,
// so the browser polls this route and the server-to-server hop does the rest.
// Tenant isolation: scope the upstream query to the signed-in user's login so
// each operator only ever sees their own branches.
export async function GET(req: NextRequest) {
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value)
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }
  try {
    const url = `${backendBase()}/api/dashboard?owner=${encodeURIComponent(session.login)}`
    const res = await fetch(url, {
      cache: "no-store",
      headers: backendHeaders(),
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) {
      return NextResponse.json({ error: `STEM backend responded ${res.status}` }, { status: 502 })
    }
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: "STEM backend unreachable" }, { status: 502 })
  }
}
