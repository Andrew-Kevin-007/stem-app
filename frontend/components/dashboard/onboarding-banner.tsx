import Link from "next/link"
import { AlertTriangle, ArrowRight } from "lucide-react"

export type OnboardingStatus = "needs-github" | "needs-aws" | "needs-cluster" | "ready"

const COPY: Record<Exclude<OnboardingStatus, "ready">, { title: string; body: string; cta: string }> = {
  "needs-github": {
    title: "Install the STEM GitHub App",
    body: "Your PRs won't trigger database branches until the App is installed on the repos you want covered.",
    cta: "Finish setup",
  },
  "needs-aws": {
    title: "Connect your AWS account",
    body: "Branches provision in your own AWS account. Connect a cross-account role to start cloning your database per PR.",
    cta: "Connect AWS",
  },
  "needs-cluster": {
    title: "Point STEM at your Aurora cluster",
    body: "Your AWS role is connected — now name the source Aurora cluster to clone so opened PRs have somewhere to branch from.",
    cta: "Add cluster",
  },
}

/**
 * Shown above the dashboard when a non-operator user hasn't finished
 * onboarding — the difference between an empty dashboard that looks broken
 * and one that tells the user exactly what's left to do.
 */
export function OnboardingBanner({ status }: { status: OnboardingStatus }) {
  if (status === "ready") return null
  const copy = COPY[status]
  return (
    <div className="border-b border-amber-500/40 bg-amber-500/5 px-6 md:px-12 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-500">{copy.title}</p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground leading-relaxed">{copy.body}</p>
          </div>
        </div>
        <Link
          href="/connect"
          className="inline-flex shrink-0 items-center gap-2 border border-amber-500/40 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-amber-500 hover:bg-amber-500 hover:text-background transition-colors"
        >
          {copy.cta} <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}
