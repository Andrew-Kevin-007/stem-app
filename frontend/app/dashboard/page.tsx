import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { readSession, SESSION_COOKIE } from "@/lib/auth"
import { isGitHubOAuthConfigured } from "@/lib/github-oauth"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardClient } from "@/components/dashboard/dashboard-client"
import { OnboardingBanner, type OnboardingStatus } from "@/components/dashboard/onboarding-banner"
import { AccountMenu } from "./account-menu"

export const metadata: Metadata = {
  title: "STEM / Mission Control",
  description: "Live branch dashboard — isolated database branches for every PR. Zero PII.",
}

const OPERATOR_LOGIN = (process.env.STEM_OPERATOR_LOGIN || "Andrew-Kevin-007").toLowerCase()

// Belt-and-suspenders: middleware is the first gate, but server components
// also verify the session so the page never renders for unauthenticated users
// even if middleware fails silently (e.g. edge-runtime cold-start anomaly).
export default async function DashboardPage() {
  const cookieStore = await cookies()
  const session = await readSession(cookieStore.get(SESSION_COOKIE)?.value)
  if (!session) redirect("/login?next=/dashboard")

  // The operator's repos use the env-configured cluster, so they skip the
  // tenant onboarding gate. Everyone else needs GitHub + AWS + a cluster.
  const isOperator = session.login.toLowerCase() === OPERATOR_LOGIN
  let status: OnboardingStatus = "ready"
  if (!isOperator) {
    if (isGitHubOAuthConfigured() && session.installations === 0) status = "needs-github"
    else if (!session.aws) status = "needs-aws"
    else if (!session.aws.cluster) status = "needs-cluster"
  }

  return (
    <main className="relative min-h-screen">
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />

      <AccountMenu />

      <div className="relative z-10 flex min-h-screen flex-col">
        <DashboardHeader />
        <OnboardingBanner status={status} />
        <DashboardClient testRepo={isOperator ? "Andrew-Kevin-007/stem-test-repo" : undefined} />
      </div>
    </main>
  )
}
