"use client"

import { useState } from "react"
import { cn, timeAgo } from "@/lib/utils"
import { Lock, ChevronDown, Database, Copy, Check, ArrowUpRight } from "lucide-react"
import type { Branch } from "@/lib/stem-api"
import { STATE_CONFIG } from "@/lib/stem-api"

/** Representative before→after pair for a PII column, keyed off its name. */
function maskPair(col: string): { before: string; after: string } {
  const c = col.toLowerCase()
  if (c.includes("email")) return { before: "jane.doe@gmail.com", after: "fake_email@domain.com" }
  if (c.includes("phone")) return { before: "+1 (415) 555-0117", after: "+1-555-FAKE-NUM" }
  if (c.includes("name")) return { before: "Jane Doe", after: "Fake Name" }
  if (c.includes("card")) return { before: "4929 1834 7702 5511", after: "**** **** **** 4242" }
  if (c.includes("address")) return { before: "742 Evergreen Terrace", after: "123 Fake Street" }
  if (c.includes("ssn")) return { before: "545-87-1123", after: "***-**-****" }
  if (c.includes("ip")) return { before: "203.0.113.42", after: "0.0.0.0" }
  if (c.includes("tax")) return { before: "EIN 82-4291013", after: "EIN 00-0000000" }
  if (c.includes("transcript")) return { before: "“my card ending 4421…”", after: "[REDACTED]" }
  return { before: "raw value", after: "masked" }
}

const STAGE_SEGMENTS = ["CLONE", "INSTANCE", "LIVE"] as const

function StageTracker({ state }: { state: Exclude<Branch["state"], "destroyed"> }) {
  // cluster_ready: clone done, instance queued · instance_creating: instance in flight · active: all done
  const doneCount = state === "active" ? 3 : 1
  const currentIdx = state === "active" ? -1 : 1
  const inFlight = state === "instance_creating"

  return (
    <div className="flex gap-2" aria-label={`Pipeline stage: ${STATE_CONFIG[state].label}`}>
      {STAGE_SEGMENTS.map((label, i) => {
        const done = i < doneCount
        const current = i === currentIdx
        return (
          <div key={label} className="flex-1">
            <div
              className={cn(
                "relative h-[3px] w-full overflow-hidden",
                done ? "bg-accent" : current ? (inFlight ? "bg-amber-500/15" : "bg-border/60") : "bg-border/40",
              )}
            >
              {current && inFlight && (
                <div
                  className="absolute inset-y-0 left-0 w-1/3 animate-[shimmer_1.4s_ease-in-out_infinite] bg-amber-500/80"
                  aria-hidden="true"
                />
              )}
              {current && !inFlight && <div className="absolute inset-0 animate-pulse bg-muted-foreground/30" aria-hidden="true" />}
            </div>
            <span
              className={cn(
                "mt-1.5 block font-mono text-[8px] uppercase tracking-[0.2em]",
                done ? "text-accent/80" : current ? (inFlight ? "text-amber-500/80" : "text-muted-foreground") : "text-muted-foreground/50",
              )}
            >
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function BranchCard({ branch, index }: { branch: Branch; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  if (branch.state === "destroyed") return null

  const config = STATE_CONFIG[branch.state]
  const isQueued = branch.state === "cluster_ready"
  const hasEndpoint = branch.endpoint.length > 0
  const prUrl = `https://github.com/${branch.owner}/${branch.repo}/pull/${branch.pr_number}`

  const copyEndpoint = async () => {
    if (!hasEndpoint) return
    try {
      await navigator.clipboard.writeText(branch.endpoint)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // clipboard unavailable (e.g. insecure context) — fail quiet
    }
  }

  return (
    <article
      className={cn(
        "group relative border bg-card/30 p-6 md:p-8 flex flex-col gap-6 overflow-hidden",
        "transition-all duration-500 ease-out hover:-translate-y-1 hover:bg-card/60",
        "animate-in fade-in slide-in-from-bottom-4",
        config.tone === "accent" && "border-border/40 hover:border-accent/60",
        config.tone === "amber" && "border-amber-500/30 hover:border-amber-500/60",
        config.tone === "muted" && "border-border/30 opacity-70 hover:opacity-100 hover:border-border/60",
      )}
      style={{ animationDelay: `${index * 100}ms`, animationFillMode: "backwards", animationDuration: "600ms" }}
    >
      {/* Top row: PR number + state badge */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 hover:text-accent transition-colors"
          >
            <h3 className="font-mono text-3xl md:text-4xl font-bold tracking-tight">PR #{branch.pr_number}</h3>
            <ArrowUpRight
              className="h-4 w-4 text-muted-foreground/50 transition-all duration-300 group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden="true"
            />
          </a>
          <p className="mt-1 font-mono text-xs text-muted-foreground/70 truncate">
            {branch.owner} / {branch.repo}
          </p>
        </div>

        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-2 border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest",
            config.tone === "accent" && "border-accent/40 text-accent",
            config.tone === "amber" && "border-amber-500/40 text-amber-500",
            config.tone === "muted" && "border-border text-muted-foreground",
          )}
        >
          <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
            {config.tone !== "muted" && (
              <span
                className={cn(
                  "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                  config.tone === "accent" ? "bg-accent" : "bg-amber-500",
                )}
              />
            )}
            <span
              className={cn(
                "relative inline-flex h-1.5 w-1.5 rounded-full",
                config.tone === "accent" && "bg-accent",
                config.tone === "amber" && "bg-amber-500",
                config.tone === "muted" && "bg-muted-foreground",
              )}
            />
          </span>
          {config.label}
        </span>
      </div>

      {/* Pipeline stage tracker */}
      <StageTracker state={branch.state} />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 border-y border-border/30 py-4">
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
            Ready In
          </span>
          <span className="font-mono text-lg text-foreground tabular-nums">
            {isQueued ? "—" : `${branch.ready_in_seconds}s`}
          </span>
        </div>
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
            Cost / Day
          </span>
          <span className="font-mono text-lg text-foreground tabular-nums">
            ${branch.cost_estimate_daily.toFixed(2)}
          </span>
        </div>
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
            Opened
          </span>
          <span className="font-mono text-lg text-foreground tabular-nums">{timeAgo(branch.created_at)}</span>
        </div>
      </div>

      {/* Endpoint + copy */}
      <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground/70 min-w-0">
        <Database className="h-3 w-3 shrink-0 text-accent/60" aria-hidden="true" />
        <span className={cn("truncate", !hasEndpoint && "uppercase tracking-[0.2em] text-muted-foreground/50")}>
          {hasEndpoint ? branch.endpoint : "Endpoint pending"}
        </span>
        <button
          onClick={copyEndpoint}
          disabled={!hasEndpoint}
          aria-label={copied ? "Endpoint copied" : "Copy endpoint to clipboard"}
          className={cn(
            "ml-auto shrink-0 border p-1.5 transition-all duration-200",
            !hasEndpoint
              ? "border-border/20 text-muted-foreground/30 cursor-not-allowed"
              : copied
                ? "border-accent/60 text-accent"
                : "border-border/40 text-muted-foreground hover:border-accent/60 hover:text-accent",
          )}
        >
          {copied ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
        </button>
      </div>

      {/* Expandable PII section — before → after masking */}
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="flex w-full items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/80 hover:text-accent transition-colors"
        >
          <span className="inline-flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            {branch.anonymized_columns.length} COLUMNS ANONYMIZED
          </span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform duration-300", expanded && "rotate-180")}
            aria-hidden="true"
          />
        </button>

        <div
          className={cn(
            "grid transition-all duration-300 ease-out",
            expanded ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <ul className="overflow-hidden space-y-3">
            {branch.anonymized_columns.map((col, i) => {
              const pair = maskPair(col)
              return (
                <li
                  key={col}
                  className={cn(
                    "border-l-2 border-accent/40 pl-3 font-mono",
                    expanded && "animate-in fade-in slide-in-from-left-2",
                  )}
                  style={expanded ? { animationDelay: `${i * 70}ms`, animationFillMode: "backwards" } : undefined}
                >
                  <span className="block text-xs text-foreground/80">{col}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px]">
                    <span className="text-muted-foreground/50 line-through decoration-destructive/50">
                      {pair.before}
                    </span>
                    <span className="text-accent/60" aria-hidden="true">
                      →
                    </span>
                    <span className="text-accent">{pair.after}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {/* Clone ID */}
      <p className="font-mono text-[10px] text-muted-foreground/50 truncate">{branch.clone_cluster_id}</p>

      {/* Corner accent on hover */}
      <div className="absolute top-0 right-0 w-12 h-12 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute top-0 right-0 w-full h-[1px] bg-accent" />
        <div className="absolute top-0 right-0 w-[1px] h-full bg-accent" />
      </div>
    </article>
  )
}
