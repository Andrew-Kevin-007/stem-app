"use client"

import { useState, useEffect, useCallback, type ReactNode } from "react"
import { cn } from "@/lib/utils"

const toc = [
  { id: "overview", label: "Overview" },
  { id: "quickstart", label: "Quickstart" },
  { id: "configuration", label: "Configuration" },
  { id: "anonymization", label: "Anonymization" },
  { id: "architecture", label: "Architecture" },
  { id: "lifecycle", label: "Branch Lifecycle" },
  { id: "limits", label: "Limits & Regions" },
]

function CodeBlock({ title, children }: { title?: string; children: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="my-6 border border-border/40 bg-card/40 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/30 px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {title ?? "shell"}
        </span>
        <button
          onClick={copy}
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-accent transition-colors"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-foreground/90">
        <code>{children}</code>
      </pre>
    </div>
  )
}

function DocSection({
  id,
  number,
  title,
  children,
}: {
  id: string
  number: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border/20 py-14 first:border-t-0 first:pt-4">
      <div className="flex items-baseline gap-4 mb-6">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent shrink-0">{number}</span>
        <h2 className="font-[var(--font-bebas)] text-3xl md:text-4xl tracking-tight">{title}</h2>
      </div>
      <div className="flex flex-col gap-4 font-mono text-sm text-muted-foreground leading-relaxed max-w-2xl">
        {children}
      </div>
    </section>
  )
}

function Para({ children }: { children: ReactNode }) {
  return <p>{children}</p>
}

function Definition({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 border-l-2 border-accent/40 pl-4 py-1">
      <dt className="font-mono text-xs uppercase tracking-widest text-foreground shrink-0 sm:w-44">{term}</dt>
      <dd className="font-mono text-xs text-muted-foreground leading-relaxed">{children}</dd>
    </div>
  )
}

export function DocsContent() {
  const [activeId, setActiveId] = useState("overview")

  const onScroll = useCallback(() => {
    const probe = window.scrollY + window.innerHeight * 0.3
    let current = toc[0].id
    for (const { id } of toc) {
      const el = document.getElementById(id)
      if (el && el.offsetTop <= probe) current = id
    }
    setActiveId(current)
  }, [])

  useEffect(() => {
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [onScroll])

  return (
    <div className="px-6 md:px-12 pb-32">
      {/* Page header */}
      <header className="py-16 md:py-20 max-w-4xl">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Documentation</span>
        <h1 className="mt-4 font-[var(--font-bebas)] text-5xl md:text-7xl tracking-tight leading-none text-balance">
          SHIP AGAINST PRODUCTION-SHAPED DATA
        </h1>
        <p className="mt-6 max-w-xl font-mono text-sm text-muted-foreground leading-relaxed">
          STEM provisions an isolated, PII-anonymized clone of your production database for every pull request.
          This guide covers installation, configuration, the anonymization engine, and the AWS architecture
          underneath it.
        </p>
      </header>

      <div className="flex gap-12">
        {/* Sticky TOC */}
        <aside className="hidden lg:block w-52 shrink-0">
          <nav className="sticky top-24 flex flex-col gap-1" aria-label="Table of contents">
            <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-3">
              On this page
            </span>
            {toc.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className={cn(
                  "border-l-2 py-1.5 pl-4 font-mono text-xs transition-colors duration-200",
                  activeId === id
                    ? "border-accent text-accent"
                    : "border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/40",
                )}
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="min-w-0 flex-1 max-w-3xl">
          <DocSection id="overview" number="01" title="OVERVIEW">
            <Para>
              Testing against an empty seed database hides the bugs that matter: slow queries on real data volumes,
              migrations that lock hot tables, and edge cases that only exist in production rows. Testing against
              production itself exposes customer PII to every reviewer on the pull request.
            </Para>
            <Para>
              STEM removes that trade-off. When a pull request opens, STEM creates a copy-on-write clone of your
              Aurora PostgreSQL cluster, runs its anonymization engine over every column classified as sensitive,
              and posts the connection string to the PR — typically in under 30 seconds.
            </Para>
            <dl className="flex flex-col gap-3 mt-2">
              <Definition term="Branch">
                An isolated database clone tied to one pull request. Created on open, destroyed on merge or close.
              </Definition>
              <Definition term="Warm pool">
                Pre-provisioned Aurora clone capacity that lets branches activate in seconds instead of minutes.
              </Definition>
              <Definition term="Masking pass">
                The anonymization run that replaces PII with format-preserving synthetic values before any
                credentials are issued.
              </Definition>
            </dl>
          </DocSection>

          <DocSection id="quickstart" number="02" title="QUICKSTART">
            <Para>
              STEM is a GitHub App plus a control plane that reaches your AWS account through a scoped IAM role.
              No CLI, no workflow files — three steps from zero to first branch:
            </Para>
            <Para>
              <span className="text-foreground">Step 1 — Sign in with GitHub.</span> Go to{" "}
              <a href="/login" className="text-accent hover:underline">
                /login
              </a>{" "}
              and authenticate. STEM reads your public profile only — repository access is granted in the next
              step, never through OAuth scopes.
            </Para>
            <Para>
              <span className="text-foreground">Step 2 — Install the STEM App.</span> From the{" "}
              <a href="/connect" className="text-accent hover:underline">
                Connect
              </a>{" "}
              page, install the GitHub App on the repositories that should get database branches. The App requests{" "}
              <span className="text-foreground">Pull requests: write</span> (to post the branch comment) and{" "}
              <span className="text-foreground">Contents: read</span> — nothing else. Webhooks fire automatically;
              there is no workflow file to add.
            </Para>
            <Para>
              <span className="text-foreground">Step 3 — Connect AWS (two parts).</span> Still on the Connect
              page: first open AWS CloudShell, paste the single command shown there, and copy back the Role ARN it
              prints. Then name your source Aurora cluster (cluster ID, subnet group, security group, region) so
              STEM knows what to clone. Your PR clones provision in <span className="text-foreground">your</span>{" "}
              account, billed to you. The command deploys a CloudFormation stack containing one least-privilege IAM
              role:
            </Para>
            <CodeBlock title="what the role allows">{`describe / list      account-wide (RDS has no resource scoping here)
clone create         RestoreDBClusterToPointInTime, CreateDBInstance
modify / delete      ONLY resources named stem-pr-* — your source
                     cluster is read-only to STEM, never modified
trust                STEM's account only, gated by your ExternalId`}</CodeBlock>
            <Para>
              Open a pull request on a connected repo. stem-ci posts a comment with the branch endpoint when the
              masking pass completes — typically under 30 seconds. Watch it live on the{" "}
              <a href="/dashboard" className="text-accent hover:underline">
                dashboard
              </a>
              .
            </Para>
          </DocSection>

          <DocSection id="configuration" number="03" title="CONFIGURATION">
            <Para>
              <span className="text-accent uppercase tracking-widest text-[10px]">Roadmap — </span>
              per-repo configuration ships as a <span className="text-foreground">stem.config.json</span> at the
              repository root. In the current release every branch uses the production-safe defaults shown below;
              the file is not yet read.
            </Para>
            <CodeBlock title="stem.config.json">{`{
  "cluster": "prod-aurora-pg",
  "region": "us-east-1",
  "ttl_hours": 72,
  "warm_pool_size": 3,
  "masking_profile": "default",
  "destroy_on": ["merged", "closed"],
  "comment_template": "compact"
}`}</CodeBlock>
            <dl className="flex flex-col gap-3">
              <Definition term="ttl_hours">
                Hard expiry for a branch even if the PR stays open. Prevents forgotten clones from accruing cost.
              </Definition>
              <Definition term="warm_pool_size">
                Number of pre-warmed clones held ready. Higher values reduce p99 provision time at higher standing
                cost.
              </Definition>
              <Definition term="destroy_on">
                PR events that trigger teardown. Branch storage is reclaimed within minutes of destruction.
              </Definition>
            </dl>
          </DocSection>

          <DocSection id="anonymization" number="04" title="ANONYMIZATION">
            <Para>
              The masking pass runs inside the clone before any credentials exist, so raw PII is never reachable
              from a branch. Columns are classified by name patterns, PostgreSQL type, and a sampling heuristic, then
              masked with format-preserving strategies:
            </Para>
            <dl className="flex flex-col gap-3">
              <Definition term="email">
                Replaced with deterministic synthetic addresses. Uniqueness constraints survive; the same source
                value maps to the same masked value within a branch.
              </Definition>
              <Definition term="card / iban">
                Replaced with checksum-valid test numbers. Luhn passes, payment processors reject.
              </Definition>
              <Definition term="name / address">
                Replaced from synthetic dictionaries, preserving length distribution and character set.
              </Definition>
              <Definition term="free text">
                Columns flagged as free-form are shredded with token-level replacement to defeat re-identification.
              </Definition>
            </dl>
            <Para>
              Overrides live in the masking profile. Mark columns as <span className="text-foreground">passthrough</span>{" "}
              (never masked) or <span className="text-foreground">drop</span> (nulled entirely):
            </Para>
            <CodeBlock title="masking-profile.yml">{`version: 1
rules:
  - table: users
    column: email
    strategy: synthetic_email
  - table: support_tickets
    column: body
    strategy: token_shred
  - table: feature_flags
    column: "*"
    strategy: passthrough`}</CodeBlock>
          </DocSection>

          <DocSection id="architecture" number="05" title="ARCHITECTURE">
            <Para>STEM is built on two AWS database services with deliberately separated responsibilities:</Para>
            <Para>
              <span className="text-foreground">Aurora PostgreSQL — the data plane.</span> Branches are Aurora
              copy-on-write clones. A clone shares unchanged pages with the source cluster, so creating one moves no
              data and costs storage only for pages the branch actually modifies. This is what makes sub-30-second
              provisioning physically possible on multi-terabyte databases.
            </Para>
            <Para>
              <span className="text-foreground">Aurora DSQL — the control plane.</span> Branch metadata — state
              machines, TTL clocks, masking manifests, audit events — lives in Aurora DSQL. Its serverless,
              multi-region consistency means the control plane has no instances to manage and survives regional
              failure without losing track of a single branch.
            </Para>
            <Para>
              The two planes never share credentials. A compromise of the control plane cannot read branch data; the
              data plane has no knowledge of GitHub tokens.
            </Para>
          </DocSection>

          <DocSection id="lifecycle" number="06" title="BRANCH LIFECYCLE">
            <Para>Every branch moves through a strict state machine, visible live on the dashboard:</Para>
            <CodeBlock title="states">{`queued        PR opened, waiting for warm-pool capacity
provisioning  Aurora clone attaching, masking pass running
active        credentials issued, posted to the PR
destroyed     PR merged/closed or TTL expired; storage reclaimed`}</CodeBlock>
            <Para>
              Transitions are recorded in the audit log with actor, timestamp, and cause. There is no manual state —
              a branch cannot be kept alive past its TTL without a new PR event.
            </Para>
          </DocSection>

          <DocSection id="limits" number="07" title="LIMITS & REGIONS">
            <dl className="flex flex-col gap-3">
              <Definition term="Clone limit">
                Aurora supports up to 15 clones per source cluster. STEM queues PRs beyond that and activates them
                FIFO as branches are destroyed.
              </Definition>
              <Definition term="Regions">
                Available in every region offering both Aurora PostgreSQL and Aurora DSQL. The control plane is
                multi-region by default.
              </Definition>
              <Definition term="Engine support">
                Aurora PostgreSQL 13 and newer. MySQL support is on the public roadmap.
              </Definition>
              <Definition term="Branch size">
                No practical limit — copy-on-write means a branch of a 10 TB cluster starts at near-zero incremental
                storage.
              </Definition>
            </dl>
          </DocSection>
        </div>
      </div>
    </div>
  )
}
