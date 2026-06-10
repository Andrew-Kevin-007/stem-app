import { NextResponse } from "next/server"
import { backendBase, backendHeaders } from "@/lib/backend"

export const dynamic = "force-dynamic"

// Same-origin proxy to the STEM backend. The backend sends no CORS headers,
// so the browser polls this route and the server-to-server hop does the rest.
export async function GET() {
  try {
    const res = await fetch(`${backendBase()}/api/dashboard`, {
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
