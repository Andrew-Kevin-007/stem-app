import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth"

// Gate the dashboard and the data proxy routes behind a signed session.
// /api/auth/* and the public marketing pages stay open.
export const config = {
  matcher: ["/dashboard/:path*", "/api/dashboard/:path*", "/api/cron/:path*"],
}

export async function middleware(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)
  if (session) return NextResponse.next()

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  const login = new URL("/login", req.url)
  login.searchParams.set("next", req.nextUrl.pathname)
  return NextResponse.redirect(login)
}
