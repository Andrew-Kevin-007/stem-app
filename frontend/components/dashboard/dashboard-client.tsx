"use client"

import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { Toaster, toast } from "sonner"
import { fetchDashboard, DASHBOARD_URL, STATE_RANK, type BranchState, type DashboardData } from "@/lib/stem-api"
import { cn, utcClock } from "@/lib/utils"
import { BranchCard } from "@/components/dashboard/branch-card"
import { PipelineRail } from "@/components/dashboard/pipeline-rail"
import { TelemetryCharts } from "@/components/dashboard/telemetry-charts"
import { PoolSlots } from "@/components/dashboard/pool-slots"
import { ActivityFeed } from "@/components/dashboard/activity-feed"
import { AdvancePipeline } from "@/components/dashboard/advance-pipeline"
import { AnimatedNumber } from "@/components/dashboard/animated-number"
import { FirstRunGuide } from "@/components/dashboard/first-run-guide"
import { AlertTriangle } from "lucide-react"

const EMPTY: DashboardData = { branches: [], poolSlots: [] }

const TOAST_COPY: Partial<Record<BranchState, (pr: number) => string>> = {
  active: (pr) => `PR #${pr} is ACTIVE — endpoint live, PII masked`,
  instance_creating: (pr) => `PR #${pr} provisioning — instance spinning up`,
  masking_failed: (pr) => `PR #${pr} held — no PII columns detected, masking config required`,
  destroyed: (pr) => `PR #${pr} closed — clone destroyed, env var removed`,
}

/** Fires a toast whenever a branch transitions state between polls. */
function useStateToasts(data: DashboardData | undefined) {
  const prev = useRef<Map<string, BranchState>>(new Map())

  useEffect(() => {
    if (!data) return
    for (const b of data.branches) {
      const last = prev.current.get(b.clone_cluster_id)
      // only announce transitions, never the initial snapshot
      if (last && last !== b.state) {
        const copy = TOAST_COPY[b.state]
        if (copy) {
          toast(copy(b.pr_number), {
            description:
              b.state === "active"
                ? b.endpoint
                : b.state === "destroyed"
                  ? b.clone_cluster_id
                  : "copy-on-write clone in progress",
          })
        }
      }
      prev.current.set(b.clone_cluster_id, b.state)
    }
  }, [data])
}

export function DashboardClient({ testRepo }: { testRepo?: string }) {
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data, error, isLoading, mutate } = useSWR<DashboardData>(DASHBOARD_URL, fetchDashboard, {
    refreshInterval: 10_000, // poll every 10s — branches change state
    revalidateOnFocus: true,
    keepPreviousData: true,
    onSuccess: () => {
      // stamp the poll + flash the indicator dot white for a beat
      setLastUpdated(utcClock())
      setFlash(true)
      if (flashTimer.current) clearTimeout(flashTimer.current)
      flashTimer.current = setTimeout(() => setFlash(false), 350)
    },
  })

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current)
    },
    [],
  )

  useStateToasts(data)

  const { branches, poolSlots } = data ?? EMPTY
  const visible = branches
    .filter((b) => b.state !== "destroyed")
    .sort(
      (a, b) =>
        STATE_RANK[a.state] - STATE_RANK[b.state] ||
        (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0),
    )
  const active = visible.filter((b) => b.state === "active")

  const totalMasked = visible.reduce((sum, b) => sum + b.anonymized_columns.length, 0)
  const totalCost = visible.reduce((sum, b) => sum + b.cost_estimate_daily, 0)
  const avgReady =
    active.length > 0 ? Math.round(active.reduce((sum, b) => sum + b.ready_in_seconds, 0) / active.length) : 0

  const stats: { label: string; value: number | null; format: (v: number) => string }[] = [
    { label: "Active Branches", value: active.length, format: (v) => String(Math.round(v)).padStart(2, "0") },
    { label: "Avg Ready Time", value: active.length > 0 ? avgReady : null, format: (v) => `${Math.round(v)}s` },
    { label: "PII Columns Masked", value: totalMasked, format: (v) => String(Math.round(v)) },
    { label: "Daily Cost", value: totalCost, format: (v) => `$${v.toFixed(2)}` },
  ]

  /* ── Error state (no data at all) ───────────────────── */
  if (error && !data) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-32">
        <div className="border border-accent/40 bg-accent/5 px-10 py-12 text-center max-w-md">
          <AlertTriangle className="mx-auto mb-6 h-8 w-8 text-accent" aria-hidden="true" />
          <h2 className="font-mono text-sm uppercase tracking-[0.3em] text-accent mb-3">
            UNABLE TO REACH STEM API
          </h2>
          <p className="font-mono text-xs text-muted-foreground leading-relaxed mb-8">
            The dashboard could not connect to the backend. Retrying automatically every 10 seconds.
          </p>
          <button
            onClick={() => mutate()}
            className="border border-foreground/20 px-6 py-3 font-mono text-xs uppercase tracking-widest text-foreground hover:border-accent hover:text-accent transition-all"
          >
            Retry Now
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Degraded state — keep showing the last good snapshot while retrying */}
      {error && data && (
        <div
          className="border-b border-accent/40 bg-accent/5 px-6 md:px-12 py-2.5 font-mono text-[10px] uppercase tracking-[0.25em] text-accent"
          role="status"
        >
          UNABLE TO REACH STEM API — showing last known state, retrying every 10s
        </div>
      )}

      {/* Stats strip — numbers tween on every poll */}
      <div className="grid grid-cols-2 md:grid-cols-4 border-b border-border/30">
        {stats.map((stat) => (
          <div key={stat.label} className="border-r border-border/30 last:border-r-0 px-6 md:px-12 py-6">
            <span className="block font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
              {stat.label}
            </span>
            <span className="font-mono text-2xl md:text-3xl text-foreground tabular-nums">
              {isLoading && !data ? (
                "··"
              ) : stat.value === null ? (
                "—"
              ) : (
                <AnimatedNumber value={stat.value} format={stat.format} />
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Live pipeline rail — branches glide between stages */}
      <PipelineRail branches={visible} />

      {/* Live telemetry charts */}
      <TelemetryCharts branches={visible} />

      {/* Warm pool — empty array renders the six standby slots */}
      <PoolSlots slots={poolSlots} />

      {/* Event stream */}
      <ActivityFeed branches={visible} />

      {/* Active branches */}
      <section className="flex-1 px-6 md:px-12 py-12">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Branches</span>
            <h1 className="mt-3 font-[var(--font-bebas)] text-4xl md:text-6xl tracking-tight">DATABASE BRANCHES</h1>
          </div>
          <div className="hidden md:flex flex-col items-end gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground tabular-nums">
              <span className="text-accent">{active.length}</span> live / {visible.length} tracked
            </span>
            <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                    flash ? "bg-white" : "bg-accent",
                  )}
                />
                <span
                  className={cn(
                    "relative inline-flex h-1.5 w-1.5 rounded-full transition-colors duration-150",
                    flash ? "bg-white" : "bg-accent",
                  )}
                />
              </span>
              Polling every 10s
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 tabular-nums">
              {lastUpdated ? `Last updated ${lastUpdated}` : "Awaiting first poll…"}
            </span>
          </div>
        </div>

        {isLoading && !data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-80 animate-pulse border border-border/30 bg-card/20" aria-hidden="true" />
            ))}
          </div>
        ) : visible.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {visible.map((branch, index) => (
              <BranchCard key={branch.clone_cluster_id} branch={branch} index={index} />
            ))}
          </div>
        ) : (
          <FirstRunGuide testRepo={testRepo} />
        )}
      </section>

      {/* Sticky operator console */}
      <AdvancePipeline onAdvanced={() => mutate()} />

      {/* State-transition toasts, styled to match the terminal aesthetic */}
      <Toaster
        position="bottom-right"
        theme="dark"
        offset={88}
        toastOptions={{
          style: {
            borderRadius: 0,
            background: "oklch(0.1 0 0)",
            border: "1px solid oklch(0.7 0.2 45 / 0.4)",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "12px",
            color: "oklch(0.95 0 0)",
          },
        }}
      />
    </>
  )
}
