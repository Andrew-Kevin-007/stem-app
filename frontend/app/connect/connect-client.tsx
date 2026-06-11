"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Copy, Download, ExternalLink, Github, Cloud, Database, ShieldCheck, Terminal } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PublicSession } from "@/lib/auth"

interface AwsProps {
  externalId: string
  stemAccountId: string | null
  shellCommand: string
  shellUrl: string
  consoleUrl: string
  stsConfigured: boolean
}

function StepBadge({ done, n }: { done: boolean; n: number }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]",
        done ? "border-accent bg-accent text-accent-foreground" : "border-border/50 text-muted-foreground",
      )}
    >
      {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : n}
    </span>
  )
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="inline-flex shrink-0 items-center gap-1.5 border border-border/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:border-accent hover:text-accent transition-colors"
      aria-label={`Copy ${label}`}
    >
      {copied ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

export function ConnectClient({
  session,
  oauthEnabled,
  installUrl,
  aws,
}: {
  session: PublicSession
  oauthEnabled: boolean
  installUrl: string
  aws: AwsProps
}) {
  const router = useRouter()
  const githubConnected = session.installations > 0
  const roleConnected = !!session.aws
  const clusterConnected = !!session.aws?.clusterConnected

  const [roleArn, setRoleArn] = useState("")
  const [awsBusy, setAwsBusy] = useState(false)
  const [awsError, setAwsError] = useState<string | null>(null)
  const [awsOk, setAwsOk] = useState<string | null>(
    session.aws ? `Connected — account ${session.aws.accountId}${session.aws.verified ? " (verified)" : ""}` : null,
  )

  const submitAws = async (e: React.FormEvent) => {
    e.preventDefault()
    setAwsBusy(true)
    setAwsError(null)
    setAwsOk(null)
    try {
      const res = await fetch("/api/aws/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleArn }),
      })
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; accountId?: string; verified?: boolean; error?: string }
        | null
      if (res.ok && data?.ok) {
        setAwsOk(`Connected — account ${data.accountId}${data.verified ? " (verified)" : " (saved, not yet verified)"}`)
        router.refresh()
      } else {
        setAwsError(data?.error ?? `Connect failed (${res.status})`)
      }
    } catch {
      setAwsError("Network error — try again.")
    }
    setAwsBusy(false)
  }

  // Step 3 — Aurora source cluster
  const [cluster, setCluster] = useState({
    clusterId: session.aws?.clusterId ?? "",
    subnetGroup: "",
    securityGroupId: "",
    region: "us-east-1",
    masterUser: "postgres",
    database: "postgres",
  })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [clusterBusy, setClusterBusy] = useState(false)
  const [clusterError, setClusterError] = useState<string | null>(null)
  const [clusterOk, setClusterOk] = useState<string | null>(
    session.aws?.clusterConnected ? `Cluster connected — ${session.aws.clusterId}` : null,
  )

  const submitCluster = async (e: React.FormEvent) => {
    e.preventDefault()
    setClusterBusy(true)
    setClusterError(null)
    setClusterOk(null)
    try {
      const res = await fetch("/api/aws/cluster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cluster),
      })
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; clusterId?: string; error?: string }
        | null
      if (res.ok && data?.ok) {
        setClusterOk(`Cluster connected — ${data.clusterId}`)
        router.refresh()
      } else {
        setClusterError(data?.error ?? `Cluster connect failed (${res.status})`)
      }
    } catch {
      setClusterError("Network error — try again.")
    }
    setClusterBusy(false)
  }

  const field = (k: keyof typeof cluster) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setCluster((c) => ({ ...c, [k]: e.target.value }))

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between">
        <Link
          href="/"
          className="font-[var(--font-bebas)] text-3xl tracking-tight text-foreground hover:text-accent transition-colors"
        >
          STEM
        </Link>
        <div className="flex items-center gap-4">
          {session.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.avatarUrl} alt="" className="h-7 w-7 rounded-full border border-border/40" />
          )}
          <span className="font-mono text-[11px] text-muted-foreground">{session.login}</span>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" })
              router.replace("/login")
            }}
            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <div>
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Onboarding</span>
        <h1 className="mt-3 font-[var(--font-bebas)] text-5xl tracking-tight">CONNECT YOUR STACK</h1>
        <p className="mt-3 max-w-2xl font-mono text-xs text-muted-foreground leading-relaxed">
          Two grants and you&apos;re live: repository access (clone-per-PR + comments) and scoped
          access to the AWS account that hosts your source database.
        </p>
      </div>

      {/* Step 1 — GitHub App install */}
      <section className="border border-border/40 bg-card/30 p-6 md:p-8">
        <div className="flex items-start gap-4">
          <StepBadge done={githubConnected} n={1} />
          <div className="flex-1">
            <h2 className="inline-flex items-center gap-2 font-[var(--font-bebas)] text-2xl tracking-tight">
              <Github className="h-5 w-5 text-accent" aria-hidden="true" /> GitHub Repository Access
            </h2>
            <p className="mt-2 font-mono text-xs text-muted-foreground leading-relaxed">
              Install the STEM GitHub App on the repositories you want PR database branches for.
              STEM requests <span className="text-foreground/80">Pull requests: write</span> and{" "}
              <span className="text-foreground/80">Contents: read</span> — nothing more.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {githubConnected ? (
                <span className="inline-flex items-center gap-2 font-mono text-[11px] text-accent">
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Installed on {session.installations} account{session.installations === 1 ? "" : "s"}
                </span>
              ) : (
                <a
                  href={installUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border border-foreground/20 px-5 py-2.5 font-mono text-[11px] uppercase tracking-widest text-foreground hover:border-accent hover:text-accent transition-colors"
                >
                  Install STEM App <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
              <button
                type="button"
                onClick={() => oauthEnabled && (window.location.href = "/api/auth/github?next=/connect")}
                disabled={!oauthEnabled}
                className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors disabled:opacity-40"
              >
                Refresh status
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Step 2 — AWS cross-account role */}
      <section className="border border-border/40 bg-card/30 p-6 md:p-8">
        <div className="flex items-start gap-4">
          <StepBadge done={roleConnected} n={2} />
          <div className="flex-1 min-w-0">
            <h2 className="inline-flex items-center gap-2 font-[var(--font-bebas)] text-2xl tracking-tight">
              <Cloud className="h-5 w-5 text-accent" aria-hidden="true" /> AWS Account Access
            </h2>
            <p className="mt-2 font-mono text-xs text-muted-foreground leading-relaxed">
              One command in AWS CloudShell creates a least-privilege IAM role STEM can assume — no
              access keys ever leave your account, and STEM can only delete resources named{" "}
              <code className="text-accent">stem-pr-*</code>.
            </p>

            <ol className="mt-5 flex flex-col gap-5">
              <li className="flex flex-col gap-2 border-l-2 border-border/40 pl-4">
                <span className="font-mono text-[11px] text-foreground/80">
                  1. Open AWS CloudShell (you&apos;re signed into AWS — it&apos;s the terminal icon, or use this
                  link)
                </span>
                <a
                  href={aws.shellUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-2 border border-border/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-foreground hover:border-accent hover:text-accent transition-colors"
                >
                  <Terminal className="h-3 w-3" aria-hidden="true" /> Open CloudShell{" "}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </li>

              <li className="flex flex-col gap-2 border-l-2 border-border/40 pl-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[11px] text-foreground/80">
                    2. Paste this command — it deploys the role and prints your Role ARN
                  </span>
                  <CopyButton value={aws.shellCommand} label="CloudShell command" />
                </div>
                <pre className="overflow-x-auto border border-border/30 bg-background/60 p-3 font-mono text-[10px] leading-relaxed text-foreground/90">
                  <code>{aws.shellCommand}</code>
                </pre>
              </li>

              <li className="flex flex-col gap-2 border-l-2 border-border/40 pl-4">
                <span className="font-mono text-[11px] text-foreground/80">
                  3. Paste the printed ARN (the last line of output)
                </span>
                <form onSubmit={submitAws} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    value={roleArn}
                    onChange={(e) => setRoleArn(e.target.value)}
                    placeholder="arn:aws:iam::123456789012:role/stem-access-role"
                    className="min-w-0 flex-1 border border-border/40 bg-background/60 px-4 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-accent focus:outline-none transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={awsBusy || !roleArn}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 border px-5 py-2.5 font-mono text-[11px] uppercase tracking-widest transition-all duration-200",
                      awsBusy
                        ? "border-accent/40 text-accent cursor-wait"
                        : "border-foreground/20 text-foreground hover:border-accent hover:text-accent hover:bg-accent/5 disabled:opacity-40",
                    )}
                  >
                    {awsBusy ? "Verifying…" : roleConnected ? "Reconnect" : "Verify & Connect"}
                  </button>
                </form>
                {awsError && (
                  <p role="alert" className="font-mono text-[11px] text-destructive">
                    {awsError}
                  </p>
                )}
                {awsOk && (
                  <p className="inline-flex items-center gap-2 font-mono text-[11px] text-accent">
                    <Check className="h-4 w-4" aria-hidden="true" /> {awsOk}
                  </p>
                )}
                {!aws.stsConfigured && (
                  <p className="font-mono text-[10px] text-muted-foreground/60">
                    Operator note: control-plane AWS credentials aren&apos;t set on this deployment,
                    so ARNs are saved without live STS verification.
                  </p>
                )}
              </li>
            </ol>

            {/* Manual fallback */}
            <details className="mt-6 border-t border-border/20 pt-4">
              <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-accent transition-colors">
                Prefer the console? Manual CloudFormation path
              </summary>
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="/api/aws/cloudformation-template"
                    className="inline-flex items-center gap-2 border border-border/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-foreground hover:border-accent hover:text-accent transition-colors"
                  >
                    <Download className="h-3 w-3" aria-hidden="true" /> Download template (ExternalId baked in)
                  </a>
                  <a
                    href={aws.consoleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 border border-border/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-foreground hover:border-accent hover:text-accent transition-colors"
                  >
                    Open CloudFormation <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-muted-foreground">Your ExternalId:</span>
                  <code className="truncate font-mono text-[11px] text-accent">{aws.externalId}</code>
                  <CopyButton value={aws.externalId} label="ExternalId" />
                </div>
                <p className="font-mono text-[10px] text-muted-foreground/60 leading-relaxed">
                  Upload the template as a new stack, deploy, then paste the RoleArn stack output above.
                </p>
              </div>
            </details>
          </div>
        </div>
      </section>

      {/* Step 3 — Aurora source cluster */}
      <section
        className={cn(
          "border border-border/40 bg-card/30 p-6 md:p-8 transition-opacity",
          !roleConnected && "opacity-50 pointer-events-none",
        )}
      >
        <div className="flex items-start gap-4">
          <StepBadge done={clusterConnected} n={3} />
          <div className="flex-1 min-w-0">
            <h2 className="inline-flex items-center gap-2 font-[var(--font-bebas)] text-2xl tracking-tight">
              <Database className="h-5 w-5 text-accent" aria-hidden="true" /> Aurora Source Cluster
            </h2>
            <p className="mt-2 font-mono text-xs text-muted-foreground leading-relaxed">
              Point STEM at the Aurora PostgreSQL cluster to clone per PR. We verify the role can
              see it (<code className="text-accent">rds:DescribeDBClusters</code>) before saving —
              your source cluster is only ever read from, never modified.
            </p>

            <form onSubmit={submitCluster} className="mt-5 flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
                    Source cluster ID
                  </span>
                  <input
                    value={cluster.clusterId}
                    onChange={field("clusterId")}
                    placeholder="my-aurora-cluster"
                    className="border border-border/40 bg-background/60 px-3 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-accent focus:outline-none transition-colors"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
                    DB subnet group
                  </span>
                  <input
                    value={cluster.subnetGroup}
                    onChange={field("subnetGroup")}
                    placeholder="default-vpc-xxxx"
                    className="border border-border/40 bg-background/60 px-3 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-accent focus:outline-none transition-colors"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
                    VPC security group ID
                  </span>
                  <input
                    value={cluster.securityGroupId}
                    onChange={field("securityGroupId")}
                    placeholder="sg-0123abcd4567ef89"
                    className="border border-border/40 bg-background/60 px-3 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-accent focus:outline-none transition-colors"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
                    AWS region
                  </span>
                  <select
                    value={cluster.region}
                    onChange={field("region")}
                    className="border border-border/40 bg-background/60 px-3 py-2.5 font-mono text-xs text-foreground focus:border-accent focus:outline-none transition-colors"
                  >
                    {["us-east-1", "us-east-2", "us-west-2", "eu-west-1", "eu-central-1", "ap-south-1", "ap-southeast-1", "ap-southeast-2"].map(
                      (r) => (
                        <option key={r} value={r} className="bg-background">
                          {r}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>

              {/* Advanced: master user + db name, both sensibly defaulted */}
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="self-start font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-accent transition-colors"
              >
                {showAdvanced ? "− Hide" : "+ Advanced"} (master user · database)
              </button>
              {showAdvanced && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
                      Master username
                    </span>
                    <input
                      value={cluster.masterUser}
                      onChange={field("masterUser")}
                      placeholder="postgres"
                      className="border border-border/40 bg-background/60 px-3 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-accent focus:outline-none transition-colors"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
                      Database name
                    </span>
                    <input
                      value={cluster.database}
                      onChange={field("database")}
                      placeholder="postgres"
                      className="border border-border/40 bg-background/60 px-3 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-accent focus:outline-none transition-colors"
                    />
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={clusterBusy || !cluster.clusterId || !roleConnected}
                className={cn(
                  "self-start inline-flex items-center justify-center gap-2 border px-5 py-2.5 font-mono text-[11px] uppercase tracking-widest transition-all duration-200",
                  clusterBusy
                    ? "border-accent/40 text-accent cursor-wait"
                    : "border-foreground/20 text-foreground hover:border-accent hover:text-accent hover:bg-accent/5 disabled:opacity-40",
                )}
              >
                {clusterBusy ? "Verifying…" : clusterConnected ? "Update cluster" : "Verify & Save cluster"}
              </button>
              {clusterError && (
                <p role="alert" className="font-mono text-[11px] text-destructive">
                  {clusterError}
                </p>
              )}
              {clusterOk && (
                <p className="inline-flex items-center gap-2 font-mono text-[11px] text-accent">
                  <Check className="h-4 w-4" aria-hidden="true" /> {clusterOk}
                </p>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* Continue */}
      <div className="flex items-center justify-between border-t border-border/20 pt-6">
        <span className="inline-flex items-center gap-2 font-mono text-[10px] text-muted-foreground/70">
          <ShieldCheck className="h-3.5 w-3.5 text-accent/70" aria-hidden="true" />
          Cross-account role · ExternalId-scoped · deletes locked to stem-pr-*
        </span>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-3 bg-foreground px-6 py-3 font-mono text-xs uppercase tracking-widest text-background hover:bg-accent hover:text-accent-foreground transition-all duration-200"
        >
          Go to dashboard →
        </Link>
      </div>
    </>
  )
}
