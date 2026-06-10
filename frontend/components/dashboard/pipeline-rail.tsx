"use client"

import { LayoutGroup, motion, AnimatePresence } from "framer-motion"
import { GitPullRequest } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Branch, BranchState } from "@/lib/stem-api"

/**
 * The product story, live: four pipeline stages laid out as a rail.
 * Each open PR is a chip parked in the column matching its backend state.
 * When the cron advances a branch, the chip physically glides to the next
 * column via framer-motion layoutId animations — judges watch the pipeline move.
 */

const STAGES = [
  { index: "02", title: "CLONE READY", caption: "RestoreDBClusterToPointInTime", state: "cluster_ready" as const },
  { index: "03", title: "PROVISIONING", caption: "db instance + PII anonymization", state: "instance_creating" as const },
  { index: "04", title: "ACTIVE", caption: "DATABASE_URL injected · PR comment posted", state: "active" as const },
]

const TONE: Record<Exclude<BranchState, "destroyed">, { chip: string; dot: string; ping: boolean }> = {
  cluster_ready: { chip: "border-border/50 bg-card/40 text-muted-foreground", dot: "bg-muted-foreground", ping: false },
  instance_creating: { chip: "border-amber-500/40 bg-amber-500/5 text-amber-500", dot: "bg-amber-500", ping: true },
  active: { chip: "border-accent/50 bg-accent/5 text-accent", dot: "bg-accent", ping: true },
}

function BranchChip({ branch }: { branch: Branch }) {
  if (branch.state === "destroyed") return null
  const tone = TONE[branch.state]

  return (
    <motion.div
      layout
      layoutId={branch.clone_cluster_id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ layout: { duration: 0.65, ease: [0.2, 0.8, 0.2, 1] }, duration: 0.4 }}
      className={cn("flex items-center gap-3 border px-3 py-2.5", tone.chip)}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
        {tone.ping && (
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", tone.dot)} />
        )}
        <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", tone.dot)} />
      </span>
      <span className="font-mono text-xs font-bold tracking-tight text-foreground">PR #{branch.pr_number}</span>
      <span className="ml-auto truncate font-mono text-[9px] text-muted-foreground/70">{branch.repo}</span>
    </motion.div>
  )
}

export function PipelineRail({ branches }: { branches: Branch[] }) {
  const visible = branches.filter((b) => b.state !== "destroyed")

  return (
    <section className="border-b border-border/30 px-6 md:px-12 py-8" aria-label="Live provisioning pipeline">
      <div className="mb-8 flex items-baseline justify-between">
        <div>
          <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground block mb-1">
            Telemetry / 00
          </span>
          <h3 className="font-[var(--font-bebas)] text-2xl tracking-tight">LIVE PIPELINE</h3>
        </div>
        <span className="hidden sm:block font-mono text-[10px] text-muted-foreground tabular-nums">
          <span className="text-accent">{visible.length}</span> branch{visible.length === 1 ? "" : "es"} in flight
        </span>
      </div>

      <LayoutGroup>
        <div className="relative">
          {/* Flowing connector behind the stage nodes */}
          <div className="stem-flow-line absolute left-0 right-0 top-[5px] hidden h-px lg:block" aria-hidden="true" />

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-4 lg:gap-6">
            {/* Stage 01 — the webhook source */}
            <div className="relative">
              <div className="relative mb-4 flex items-center gap-3 lg:bg-background lg:pr-4 lg:w-fit">
                <span className="relative flex h-[11px] w-[11px] shrink-0" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
                  <span className="relative inline-flex h-[11px] w-[11px] rounded-full border-2 border-accent bg-background" />
                </span>
                <div>
                  <span className="block font-mono text-[8px] uppercase tracking-[0.3em] text-muted-foreground">
                    Stage 01
                  </span>
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-foreground">
                    PR Opened
                  </span>
                </div>
              </div>
              <p className="mb-4 font-mono text-[9px] leading-relaxed text-muted-foreground/60">
                GitHub webhook · HMAC SHA256 verified
              </p>
              <div className="flex min-h-[60px] items-start">
                <div className="flex w-full items-center gap-3 border border-dashed border-border/50 bg-card/20 px-3 py-2.5">
                  <GitPullRequest className="h-3.5 w-3.5 shrink-0 text-accent/70" aria-hidden="true" />
                  <span className="font-mono text-[10px] text-muted-foreground">
                    stem-ci<span className="text-muted-foreground/50"> · listening for webhooks</span>
                  </span>
                  <span className="stem-caret ml-auto text-accent" aria-hidden="true">
                    ▋
                  </span>
                </div>
              </div>
            </div>

            {/* Stages 02–04 — chips live in the column matching their state */}
            {STAGES.map((stage) => {
              const here = visible.filter((b) => b.state === stage.state)
              return (
                <div key={stage.state} className="relative">
                  <div className="relative mb-4 flex items-center gap-3 lg:bg-background lg:pr-4 lg:w-fit">
                    <span
                      className={cn(
                        "relative inline-flex h-[11px] w-[11px] shrink-0 rounded-full border-2 bg-background",
                        here.length > 0 ? "border-accent" : "border-border",
                      )}
                      aria-hidden="true"
                    />
                    <div>
                      <span className="block font-mono text-[8px] uppercase tracking-[0.3em] text-muted-foreground">
                        Stage {stage.index}
                      </span>
                      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-foreground">
                        {stage.title}
                        {here.length > 0 && <span className="ml-2 text-accent tabular-nums">{here.length}</span>}
                      </span>
                    </div>
                  </div>
                  <p className="mb-4 font-mono text-[9px] leading-relaxed text-muted-foreground/60">{stage.caption}</p>
                  <div className="flex min-h-[60px] flex-col gap-2">
                    <AnimatePresence mode="popLayout">
                      {here.map((branch) => (
                        <BranchChip key={branch.clone_cluster_id} branch={branch} />
                      ))}
                    </AnimatePresence>
                    {here.length === 0 && (
                      <div
                        className="flex h-[38px] items-center justify-center border border-dashed border-border/30 font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground/40"
                        aria-hidden="true"
                      >
                        —
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </LayoutGroup>
    </section>
  )
}
