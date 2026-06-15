import { NextResponse } from "next/server"
import { backendBase, backendHeaders } from "@/lib/backend"

export const dynamic = "force-dynamic"
// The backend pipeline walks every branch through RDS calls — give it room.
export const maxDuration = 300

export async function GET() {
  try {
    // This route sits behind session-gating middleware, so a caller here is an
    // authenticated operator. Forward CRON_SECRET so the backend's pipeline
    // endpoint (also hit directly by Vercel Cron) accepts the manual trigger.
    const headers: Record<string, string> = { ...backendHeaders() }
    if (process.env.CRON_SECRET) headers["Authorization"] = `Bearer ${process.env.CRON_SECRET}`

    const res = await fetch(`${backendBase()}/api/cron/advance-pipeline`, {
      cache: "no-store",
      headers,
      signal: AbortSignal.timeout(290_000),
    })
    if (!res.ok) {
      return NextResponse.json({ error: `STEM backend responded ${res.status}` }, { status: 502 })
    }
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: "STEM backend unreachable" }, { status: 502 })
  }
}
