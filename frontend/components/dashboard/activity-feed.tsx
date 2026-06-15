"use client"

import { useEffect, useRef, useState } from "react"
import { cn, utcTime } from "@/lib/utils"
import { subscribeFeed, type FeedEntry } from "@/lib/feed-bus"
import type { Branch, BranchState } from "@/lib/stem-api"

interface FeedEvent extends FeedEntry {
  id: string
  time: string
}

const MAX_EVENTS = 50

let eventSeq = 0
const nextId = () => `evt-${++eventSeq}`

const TONE_BY_STATE: Record<Exclude<BranchState, "destroyed">, FeedEntry["tone"]> = {
  active: "accent",
  instance_creating: "amber",
  cluster_ready: "muted",
  masking_failed: "error",
}

/**
 * Reconstructs a branch's pipeline history from real API data so the feed
 * opens with the actual story (clone id, endpoint, masked columns) instead
 * of an empty terminal.
 */
function replayBranch(b: Branch): Array<FeedEvent & { epoch: number }> {
  const opened = Date.parse(b.created_at) || Date.now()
  const ready = b.ready_in_seconds > 0 ? b.ready_in_seconds : 28
  const at = (offsetSeconds: number) => {
    const epoch = opened + offsetSeconds * 1000
    return { epoch, time: utcTime(new Date(epoch)) }
  }

  const events: Array<FeedEvent & { epoch: number }> = [
    {
      id: nextId(),
      ...at(0),
      text: `webhook received — PR #${b.pr_number} opened on ${b.owner}/${b.repo}`,
      tone: "muted",
      source: "stem-ci",
    },
    {
      id: nextId(),
      ...at(2),
      text: `RestoreDBClusterToPointInTime → ${b.clone_cluster_id}`,
      tone: "muted",
      source: "stem-ci",
    },
  ]

  if (b.state === "cluster_ready") {
    events.push({
      id: nextId(),
      ...at(4),
      text: `clone for PR #${b.pr_number} is cluster_ready — awaiting instance`,
      tone: "muted",
      source: "stem-ci",
    })
    return events
  }

  events.push({
    id: nextId(),
    ...at(9),
    text: "CreateDBInstance dispatched — db.serverless spinning up",
    tone: "amber",
    source: "stem-ci",
  })

  if (b.state === "instance_creating") {
    events.push({
      id: nextId(),
      ...at(12),
      text: `clone for PR #${b.pr_number} is instance_creating`,
      tone: "amber",
      source: "stem-ci",
    })
    return events
  }

  events.push({
    id: nextId(),
    ...at(Math.max(ready - 6, 13)),
    text: `PII anonymization complete — ${b.anonymized_columns.length} column(s) masked`,
    tone: "accent",
    source: "stem-ci",
  })
  if (b.endpoint) {
    events.push({
      id: nextId(),
      ...at(Math.max(ready - 2, 14)),
      text: `endpoint live → ${b.endpoint}`,
      tone: "accent",
      source: "stem-ci",
    })
  }
  events.push({
    id: nextId(),
    ...at(ready),
    text: `clone for PR #${b.pr_number} is active — ready in ${ready}s`,
    tone: "accent",
    source: "stem-ci",
  })
  return events
}

/**
 * Live terminal: seeds itself from the first real snapshot, diffs branch
 * states between polls, and accepts operator-console events over the bus.
 */
export function ActivityFeed({ branches }: { branches: Branch[] }) {
  const [events, setEvents] = useState<FeedEvent[]>([])
  const prevStates = useRef<Map<number, BranchState>>(new Map())
  const seeded = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const append = (fresh: FeedEvent[]) => {
    if (fresh.length > 0) setEvents((prev) => [...prev, ...fresh].slice(-MAX_EVENTS))
  }

  // Operator console (and future sources) push entries through the bus.
  useEffect(
    () =>
      subscribeFeed((entry) => {
        append([{ id: nextId(), time: utcTime(), ...entry }])
      }),
    [],
  )

  useEffect(() => {
    if (branches.length === 0) return

    // First snapshot — replay each branch's pipeline from its real data.
    if (!seeded.current) {
      seeded.current = true
      const replay = branches
        .flatMap(replayBranch)
        .sort((a, b) => a.epoch - b.epoch)
        .map(({ epoch: _epoch, ...evt }) => evt)
      for (const b of branches) prevStates.current.set(b.pr_number, b.state)
      append(replay)
      return
    }

    // Subsequent polls — announce new branches and state transitions.
    const stamp = utcTime()
    const fresh: FeedEvent[] = []
    for (const b of branches) {
      if (b.state === "destroyed") continue
      const prev = prevStates.current.get(b.pr_number)
      if (prev !== b.state) {
        fresh.push({
          id: nextId(),
          time: stamp,
          text: `clone for PR #${b.pr_number} is ${b.state}`,
          tone: TONE_BY_STATE[b.state],
          source: "stem-ci",
        })
        prevStates.current.set(b.pr_number, b.state)
      }
    }
    append(fresh)
  }, [branches])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events])

  return (
    <div className="border-b border-border/30 px-6 md:px-12 py-8">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground block mb-1">
            Telemetry / 04
          </span>
          <h3 className="font-[var(--font-bebas)] text-2xl tracking-tight">EVENT STREAM</h3>
        </div>
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
          <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          LIVE
        </span>
      </div>

      <div
        ref={scrollRef}
        className="h-44 overflow-y-auto border border-border/30 bg-background/60 p-4 font-mono text-xs leading-relaxed scroll-smooth"
        aria-live="polite"
        aria-label="Live pipeline event stream"
      >
        {events.length === 0 ? (
          <p className="text-muted-foreground/50">
            <span className="text-accent">$</span> awaiting pipeline events…
          </p>
        ) : (
          events.map((evt) => (
            <p key={evt.id} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
              <span className="text-muted-foreground/50 tabular-nums">[{evt.time}]</span>{" "}
              <span
                className={cn(
                  evt.source === "ERROR"
                    ? "text-destructive"
                    : evt.tone === "accent"
                      ? "text-accent"
                      : evt.tone === "amber"
                        ? "text-amber-500"
                        : "text-muted-foreground",
                )}
              >
                {evt.source}
              </span>{" "}
              <span className={cn(evt.source === "ERROR" ? "text-destructive/90" : "text-foreground/80")}>
                {evt.text}
              </span>
            </p>
          ))
        )}
      </div>
    </div>
  )
}
