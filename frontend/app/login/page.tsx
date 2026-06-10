import type { Metadata } from "next"
import { Suspense } from "react"
import { isDemoMode } from "@/lib/auth"
import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "STEM / Operator Login",
  description: "Authenticate to access live branch credentials and the STEM operator console.",
}

export default function LoginPage() {
  return (
    <main className="relative min-h-screen">
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <Suspense>
          <LoginForm demoKey={isDemoMode() ? "stem-demo" : null} />
        </Suspense>
      </div>
    </main>
  )
}
