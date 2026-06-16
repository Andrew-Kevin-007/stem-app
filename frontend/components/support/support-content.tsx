"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const runbooks = [
  {
    code: "RB-01",
    symptom: "Branch stuck in QUEUED",
    cause: "The source cluster has hit Aurora's 15-clone limit, or the warm pool is exhausted.",
    fix: "Check the dashboard's warm pool panel. Destroy stale branches (merged PRs with TTL remaining) or raise warm_pool_size in stem.config.json. Queued branches activate FIFO automatically.",
  },
  {
    code: "RB-02",
    symptom: "stem-ci never comments on the PR",
    cause: "The STEM GitHub App is not installed on the repository, so the pull_request webhook never reaches the control plane.",
    fix: "Open Connect from the dashboard account menu and check repository access. Install (or extend) the App on the repo, then reopen the PR — no workflow file is needed; the App's webhook fires automatically.",
  },
  {
    code: "RB-03",
    symptom: "Provision time above 30s",
    cause: "Cold start — no warm clone was available, so a fresh Aurora clone had to attach from scratch.",
    fix: "Increase warm_pool_size. Each warm slot adds standing cost but removes the cold-attach penalty. The provision-time chart on the dashboard shows which runs were cold.",
  },
  {
    code: "RB-04",
    symptom: "Masked values break my tests",
    cause: "Tests assert against specific production values, which the masking pass replaced.",
    fix: "Masking is deterministic within a branch — assert on shape, not values. For fixture columns that are genuinely non-sensitive, add a passthrough rule to your masking profile.",
  },
  {
    code: "RB-05",
    symptom: "Connection refused on branch endpoint",
    cause: "The branch was destroyed — its PR merged/closed, or TTL expired.",
    fix: "Branch credentials die with the branch by design. Push a new commit or reopen the PR to get a fresh branch. Check the audit log for the destruction cause.",
  },
  {
    code: "RB-06",
    symptom: "IAM role deployment fails",
    cause: "The deploying principal lacks iam:CreateRole, or SCP guardrails block role creation.",
    fix: "Run the CloudShell command as a principal with IAM admin once — the role itself stays minimal (describe + clone create account-wide, delete locked to stem-pr-* resources). Review the role's trust policy against your org's SCPs.",
  },
  {
    code: "RB-07",
    symptom: "AWS connect says it can't assume the role",
    cause: "IAM is eventually consistent — a just-created role can take ~30 seconds to become assumable. Otherwise the ExternalId in the stack doesn't match yours, or the stack deployed to a different account.",
    fix: "Wait 30 seconds and click Verify & Connect again. Still failing? Re-run the CloudShell command from the Connect page (it carries your current ExternalId) and confirm you're signed into the intended AWS account.",
  },
  {
    code: "RB-08",
    symptom: "GitHub sign-in fails with a state-mismatch error",
    cause: "The OAuth state cookie was lost — usually a stale tab that sat on GitHub's authorize page past the 10-minute window, or cookies blocked for the site.",
    fix: "Go back to /login and start again in the same tab. If it persists, allow cookies for the dashboard origin — the state cookie is the CSRF proof; sign-in is impossible without it.",
  },
]

const faqs = [
  {
    q: "I finished setup but the dashboard is empty. What now?",
    a: "That's expected — STEM only creates branches in response to pull requests. Open a PR on a repo where you installed the STEM App: make a change on a new branch, open the PR against the default branch, and within ~30 seconds a card appears and moves QUEUED → PROVISIONING → ACTIVE. On the Vercel free plan the pipeline steps on a daily cron, so use the Advance Pipeline button in the operator console to move it instantly. The dashboard's empty state and the Your First Branch section in the docs walk through every step.",
  },
  {
    q: "How do I connect my AWS Aurora cluster?",
    a: "On the Connect page, after installing the GitHub App: (1) open AWS CloudShell and paste the one command shown there — it deploys a least-privilege IAM role and prints its ARN; (2) paste the ARN back; (3) enter your Aurora source cluster ID, DB subnet group, and VPC security group (copy these from the RDS console). STEM verifies it can describe the cluster before saving. No long-lived AWS keys ever leave your account.",
  },
  {
    q: "Is raw production data ever readable from a branch?",
    a: "No. The masking pass runs inside the clone before any branch credentials are generated. There is no time window in which issued credentials can read unmasked rows.",
  },
  {
    q: "What does a branch cost while idle?",
    a: "Aurora clones are copy-on-write: an idle branch pays only for pages it has modified plus its compute when queried. A branch that is never queried after provisioning costs near zero in storage.",
  },
  {
    q: "Does STEM see my data?",
    a: "The control plane (Aurora DSQL) stores only metadata: branch states, timestamps, masking manifests, and audit events. Row data never leaves your AWS account — the masking pass executes inside your VPC.",
  },
  {
    q: "Can I branch a database that isn't Aurora?",
    a: "Today STEM requires Aurora PostgreSQL 13+ as the source, because sub-30-second provisioning depends on Aurora's copy-on-write clone primitive. RDS and self-hosted PostgreSQL are on the roadmap via snapshot-based branching with slower provision times.",
  },
  {
    q: "How do schema migrations interact with branches?",
    a: "Each branch is fully isolated — run migrations inside it freely. A merged migration reaches future branches automatically since each new branch clones from current production state.",
  },
  {
    q: "Is STEM open source?",
    a: "Yes. The control plane, GitHub Action, and masking engine are open source. Self-host the entire stack in your own AWS account using the deployment guide in the docs.",
  },
]

function RunbookEntry({ entry, index }: { entry: (typeof runbooks)[0]; index: number }) {
  return (
    <article className="group relative border-t border-border/30 py-8 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8">
      <div className="md:col-span-2 flex md:flex-col items-baseline md:items-start gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">{entry.code}</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60">
          runbook {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <div className="md:col-span-4">
        <h3 className="font-[var(--font-bebas)] text-2xl md:text-3xl tracking-tight leading-tight group-hover:text-accent transition-colors duration-300">
          {entry.symptom}
        </h3>
      </div>
      <div className="md:col-span-6 flex flex-col gap-3">
        <p className="font-mono text-xs leading-relaxed">
          <span className="text-foreground/90 uppercase tracking-widest text-[10px]">Likely cause — </span>
          <span className="text-muted-foreground">{entry.cause}</span>
        </p>
        <p className="font-mono text-xs leading-relaxed">
          <span className="text-accent uppercase tracking-widest text-[10px]">Resolution — </span>
          <span className="text-muted-foreground">{entry.fix}</span>
        </p>
      </div>
    </article>
  )
}

function FaqItem({ faq, open, onToggle }: { faq: (typeof faqs)[0]; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-t border-border/30">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-6 py-6 text-left group"
      >
        <span
          className={cn(
            "font-mono text-sm leading-relaxed transition-colors duration-200",
            open ? "text-accent" : "text-foreground group-hover:text-accent",
          )}
        >
          {faq.q}
        </span>
        <span
          className={cn(
            "font-mono text-lg text-muted-foreground transition-transform duration-300 shrink-0",
            open && "rotate-45 text-accent",
          )}
          aria-hidden="true"
        >
          +
        </span>
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <p className="pb-6 max-w-2xl font-mono text-xs text-muted-foreground leading-relaxed">{faq.a}</p>
        </div>
      </div>
    </div>
  )
}

export function SupportContent() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <div className="px-6 md:px-12 pb-32">
      {/* Page header */}
      <header className="py-16 md:py-20 max-w-4xl">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Support</span>
        <h1 className="mt-4 font-[var(--font-bebas)] text-5xl md:text-7xl tracking-tight leading-none text-balance">
          DIAGNOSE IT LIKE WE WOULD
        </h1>
        <p className="mt-6 max-w-xl font-mono text-sm text-muted-foreground leading-relaxed">
          These are the same runbooks our team uses. Most branch issues resolve in under a minute — start with the
          symptom, follow the resolution, escalate if it persists.
        </p>
      </header>

      {/* Quick paths */}
      <div className="mb-20 flex flex-col sm:flex-row gap-4 max-w-3xl">
        <Link
          href="/docs"
          className="flex-1 border border-border/40 px-6 py-5 group hover:border-accent/60 transition-colors duration-200"
        >
          <span className="block font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
            First time here?
          </span>
          <span className="font-mono text-sm text-foreground group-hover:text-accent transition-colors">
            Read the Quickstart →
          </span>
        </Link>
        <Link
          href="/dashboard"
          className="flex-1 border border-border/40 px-6 py-5 group hover:border-accent/60 transition-colors duration-200"
        >
          <span className="block font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
            Something looks wrong?
          </span>
          <span className="font-mono text-sm text-foreground group-hover:text-accent transition-colors">
            Check live branch state →
          </span>
        </Link>
        <a
          href="https://github.com/Andrew-Kevin-007/stem-app/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 border border-border/40 px-6 py-5 group hover:border-accent/60 transition-colors duration-200"
        >
          <span className="block font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
            Found a bug?
          </span>
          <span className="font-mono text-sm text-foreground group-hover:text-accent transition-colors">
            Open a GitHub issue →
          </span>
        </a>
      </div>

      {/* Runbooks */}
      <section className="mb-24" aria-labelledby="runbooks-heading">
        <div className="mb-10">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">01 / Runbooks</span>
          <h2 id="runbooks-heading" className="mt-3 font-[var(--font-bebas)] text-4xl md:text-5xl tracking-tight">
            TROUBLESHOOTING
          </h2>
        </div>
        <div className="border-b border-border/30">
          {runbooks.map((entry, i) => (
            <RunbookEntry key={entry.code} entry={entry} index={i} />
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl" aria-labelledby="faq-heading">
        <div className="mb-10">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">02 / FAQ</span>
          <h2 id="faq-heading" className="mt-3 font-[var(--font-bebas)] text-4xl md:text-5xl tracking-tight">
            FREQUENTLY ASKED
          </h2>
        </div>
        <div className="border-b border-border/30">
          {faqs.map((faq, i) => (
            <FaqItem key={i} faq={faq} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)} />
          ))}
        </div>
      </section>
    </div>
  )
}
