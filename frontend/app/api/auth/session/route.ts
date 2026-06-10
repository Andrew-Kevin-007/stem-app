import { NextRequest, NextResponse } from "next/server"
import { readSession, toPublicSession, SESSION_COOKIE } from "@/lib/auth"

export const dynamic = "force-dynamic"

// Identity for the client UI. Never returns the GitHub token.
export async function GET(req: NextRequest) {
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ session: null }, { status: 200 })
  return NextResponse.json({ session: toPublicSession(session) })
}
