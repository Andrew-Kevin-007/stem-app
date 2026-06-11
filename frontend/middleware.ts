import { NextRequest, NextResponse } from "next/server"
import { readSession, SESSION_COOKIE } from "@/lib/auth"

// Gate the dashboard, onboarding, and data/aws routes behind a valid session.
// /api/auth/* and the public marketing pages stay open.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/connect/:path*",
    "/api/dashboard/:path*",
    "/api/cron/:path*",
    "/api/aws/:path*",
  ],
}

export async function middleware(req: NextRequest) {
  // Public: the parameterized CloudFormation template (no user data) that
  // AWS CloudShell fetches during account connection.
  if (req.nextUrl.pathname === "/api/aws/template") return NextResponse.next()

  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value)
  if (session) return NextResponse.next()

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  const login = new URL("/login", req.url)
  login.searchParams.set("next", req.nextUrl.pathname)
  return NextResponse.redirect(login)
}
