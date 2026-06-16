import { GitPullRequest, ArrowRight } from "lucide-react"

const STEPS: { title: string; detail: string }[] = [
  {
    title: "Open a repo with the STEM App installed",
    detail: "Any repository you granted access to during onboarding works.",
  },
  {
    title: "Make a change on a new branch",
    detail: "Edit any file — a README line is enough. Commit it to a feature branch.",
  },
  {
    title: "Open a pull request",
    detail: "Target the default branch. STEM's webhook fires the moment the PR opens.",
  },
  {
    title: "Watch the branch appear here",
    detail: "Within ~30s a card shows up and moves QUEUED → PROVISIONING → ACTIVE as the clone is built and PII is masked.",
  },
  {
    title: "Copy the masked database endpoint",
    detail: "Expand the card for the connection string and the list of anonymized columns. Point your preview at it.",
  },
  {
    title: "Close or merge the PR",
    detail: "The clone and every AWS resource are destroyed automatically — no orphaned cost.",
  },
]

/**
 * Shown on the dashboard when a fully-onboarded user has no branches yet.
 * Turns an empty screen into a guided "run your first branch" walkthrough.
 */
export function FirstRunGuide({ testRepo }: { testRepo?: string }) {
  const compareUrl = testRepo ? `https://github.com/${testRepo}/compare` : null

  return (
    <div className="border border-dashed border-border/40 bg-card/20 px-6 py-12 md:px-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <GitPullRequest className="h-5 w-5 text-accent" aria-hidden="true" />
          <h2 className="font-[var(--font-bebas)] text-3xl tracking-tight">RUN YOUR FIRST BRANCH</h2>
        </div>
        <p className="mt-2 font-mono text-xs text-muted-foreground leading-relaxed">
          No branches yet. STEM reacts to pull requests — here is the full loop, end to end.
        </p>

        <ol className="mt-8 flex flex-col gap-5">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent/50 font-mono text-[11px] text-accent">
                {i + 1}
              </span>
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.15em] text-foreground/90">{step.title}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground leading-relaxed">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-border/20 pt-6">
          {compareUrl && (
            <a
              href={compareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-foreground px-5 py-2.5 font-mono text-[11px] uppercase tracking-widest text-background hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Open a PR on the test repo <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
          <a
            href="/docs#first-branch"
            className="inline-flex items-center gap-2 border border-border/40 px-5 py-2.5 font-mono text-[11px] uppercase tracking-widest text-foreground hover:border-accent hover:text-accent transition-colors"
          >
            Full walkthrough in docs
          </a>
        </div>

        <p className="mt-6 font-mono text-[10px] text-muted-foreground/60 leading-relaxed">
          Tip: the pipeline advances on a schedule. On the free plan, use the{" "}
          <span className="text-accent">ADVANCE PIPELINE</span> button in the operator console below to step a
          branch through provisioning instantly during a demo.
        </p>
      </div>
    </div>
  )
}
