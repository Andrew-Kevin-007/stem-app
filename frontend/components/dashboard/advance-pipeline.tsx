"use client"

import { useState } from "react"
import { Play } from "lucide-react"
import { cn, utcClock } from "@/lib/utils"
import { advancePipeline } from "@/lib/stem-api"
import { pushFeed } from "@/lib/feed-bus"

type RunState = "idle" | "running" | "done" | "error"

interface Run {
  id: number
  time: string
  ok: boolean
}

/**
 * Sticky operator console — always on screen so the demo trigger is one
 * click away, with a log of every pipeline run this session.
 */
export function AdvancePipeline({ onAdvanced }: { onAdvanced?: () => void }) {
  const [state, setState] = useState<RunState>("idle")
  const [runs, setRuns] = useState<Run[]>([])

  const triggerPipeline = async () => {
    setState("running")
    try {
      // Spec: GET /api/cron/advance-pipeline → { ok: true }
      const data = await advancePipeline()
      if (!data.ok) throw new Error("Pipeline returned not-ok")
      setRuns((prev) => [...prev, { id: Date.now(), time: utcClock(), ok: true }].slice(-4))
      pushFeed({ text: "pipeline advanced — checking instance states", tone: "accent", source: "stem-ci" })
      setState("done")
      onAdvanced?.() // re-fetch dashboard immediately so the state change shows
      setTimeout(() => setState("idle"), 2500)
    } catch {
      setRuns((prev) => [...prev, { id: Date.now(), time: utcClock(), ok: false }].slice(-4))
      pushFeed({ text: "pipeline advance failed, check Vercel logs", tone: "error", source: "ERROR" })
      setState("error")
      setTimeout(() => setState("idle"), 2500)
    }
  }

  const lastRun = runs[runs.length - 1]

  return (
    <section
      className="sticky bottom-0 z-40 border-t border-border/40 bg-background/90 backdrop-blur-md"
      aria-label="Operator console"
    >
      <div className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center md:px-12">
        <div className="flex items-center gap-3">
          <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                state === "running" ? "bg-amber-500" : "bg-accent",
              )}
            />
            <span
              className={cn(
                "relative inline-flex h-1.5 w-1.5 rounded-full",
                state === "running" ? "bg-amber-500" : "bg-accent",
              )}
            />
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
            Operator Console
          </span>
        </div>

        <button
          onClick={triggerPipeline}
          disabled={state === "running"}
          className={cn(
            "inline-flex items-center justify-center gap-3 border px-6 py-3 font-mono text-xs uppercase tracking-widest transition-all duration-200",
            state === "running"
              ? "border-accent/40 text-accent cursor-wait"
              : state === "done"
                ? "border-accent bg-accent text-accent-foreground"
                : state === "error"
                  ? "border-destructive text-destructive"
                  : "border-foreground/20 text-foreground hover:border-accent hover:text-accent hover:bg-accent/5",
          )}
        >
          {state === "running" ? (
            <span
              className="h-3 w-3 animate-spin rounded-full border border-accent border-t-transparent"
              aria-hidden="true"
            />
          ) : (
            <Play className="h-3 w-3" aria-hidden="true" />
          )}
          {state === "running"
            ? "Running..."
            : state === "done"
              ? "Pipeline Advanced"
              : state === "error"
                ? "Failed — Retry"
                : "Advance Pipeline"}
        </button>

        {/* Session run log */}
        <div
          className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto font-mono text-[10px] text-muted-foreground tabular-nums"
          aria-live="polite"
        >
          {runs.length === 0 ? (
            <span className="text-muted-foreground/60">
              <span className="text-accent">$</span> no runs yet — trigger the cron manually
            </span>
          ) : (
            <>
              <span className="shrink-0 uppercase tracking-[0.2em]">
                Last run: <span className={lastRun.ok ? "text-accent" : "text-destructive"}>{lastRun.time}</span>
              </span>
              {runs.map((run) => (
                <span key={run.id} className="shrink-0 animate-in fade-in slide-in-from-bottom-1 duration-300">
                  <span className="text-muted-foreground/50">[{run.time}]</span>{" "}
                  {run.ok ? (
                    <span className="text-accent">→ ADVANCED</span>
                  ) : (
                    <span className="text-destructive">→ FAILED</span>
                  )}
                </span>
              ))}
            </>
          )}
        </div>

        <span className="hidden font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 lg:block">
          GET /api/cron/advance-pipeline
        </span>
      </div>
    </section>
  )
}
