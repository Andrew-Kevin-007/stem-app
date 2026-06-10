import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { isGitHubOAuthConfigured } from "@/lib/github-oauth"
import { readSession, SESSION_COOKIE } from "@/lib/auth"
import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "STEM / Sign In",
  description: "Authenticate with GitHub to access live branch credentials and the STEM operator console.",
}

export default async function LoginPage() {
  // Already signed in? Skip straight through.
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value)
  if (session) redirect(session.installations > 0 || session.demo ? "/dashboard" : "/connect")

  return (
    <main className="relative min-h-screen">
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <Suspense>
          <LoginForm oauthEnabled={isGitHubOAuthConfigured()} />
        </Suspense>
      </div>
    </main>
  )
}
