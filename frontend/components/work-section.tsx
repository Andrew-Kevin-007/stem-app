"use client"

import { useRef, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

/**
 * Pinned, scroll-scrubbed CI terminal.
 * Scrolling through the section replays a real pipeline run: log lines
 * appear in order and the three stages on the left activate as their
 * log lines pass.
 */
const logLines = [
  { text: "› webhook received: pull_request.opened #841", stage: 0 },
  { text: "› repo: acme/checkout-service · base: main", stage: 0 },
  { text: "› stem-ci queued · priority: warm-pool", stage: 0 },
  { text: "$ stem branch create --pr 841", stage: 1 },
  { text: "  aurora: copy-on-write clone from prod-cluster-7", stage: 1 },
  { text: "  storage shared · 0 bytes copied · 28s elapsed", stage: 1 },
  { text: "  endpoint: pr-841.clone.stem.dev ........ READY", stage: 1 },
  { text: "$ stem anonymize --profile strict", stage: 2 },
  { text: "  users.email ............ masked (sha-faker)", stage: 2 },
  { text: "  users.ssn .............. nulled", stage: 2 },
  { text: "  payments.card_number ... tokenized", stage: 2 },
  { text: "✓ branch live · 0 rows of real PII · posting to PR", stage: 2 },
]

const stages = [
  { number: "01", title: "PR OPENED", detail: "Webhook fires. Workflow queued against the warm pool." },
  { number: "02", title: "CLONE READY IN 28s", detail: "Aurora copy-on-write. Full schema, shared storage, zero copy." },
  { number: "03", title: "PII ANONYMIZED", detail: "Strict masking profile applied before the endpoint is exposed." },
]

export function WorkSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!sectionRef.current || !pinRef.current) return
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "+=1400",
        pin: pinRef.current,
        scrub: 0.4,
        onUpdate: (self) => setProgress(self.progress),
      })
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  const visibleCount = Math.floor(progress * (logLines.length + 1))
  const activeStage = visibleCount === 0 ? -1 : (logLines[Math.min(visibleCount, logLines.length) - 1]?.stage ?? -1)

  return (
    <section ref={sectionRef} id="pipeline" className="relative">
      <div ref={pinRef} className="min-h-screen flex flex-col justify-center py-20 pl-6 md:pl-28 pr-6 md:pr-12">
        {/* Header */}
        <div className="mb-12">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">02 / Pipeline</span>
          <h2 className="mt-4 font-[var(--font-bebas)] text-5xl md:text-7xl tracking-tight">
            SCROLL TO RUN THE PIPELINE
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-10 lg:gap-16 items-start max-w-6xl">
          {/* Left: stages */}
          <div className="flex flex-col">
            {stages.map((stage, i) => {
              const isActive = activeStage === i
              const isPast = activeStage > i
              return (
                <div key={stage.number} className="relative flex gap-5 pb-10 last:pb-0">
                  {/* Vertical progress rail */}
                  {i < stages.length - 1 && (
                    <div className="absolute left-[15px] top-8 bottom-2 w-px bg-border/40 overflow-hidden">
                      <div
                        className="w-full bg-accent transition-all duration-500 ease-out"
                        style={{ height: isPast ? "100%" : "0%" }}
                      />
                    </div>
                  )}
                  {/* Stage node */}
                  <div
                    className={cn(
                      "relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center border font-mono text-[10px] transition-all duration-400",
                      isActive
                        ? "border-accent bg-accent text-accent-foreground stem-ring"
                        : isPast
                          ? "border-accent text-accent"
                          : "border-border text-muted-foreground",
                    )}
                  >
                    {isPast ? "✓" : stage.number}
                  </div>
                  <div>
                    <h3
                      className={cn(
                        "font-[var(--font-bebas)] text-2xl md:text-3xl tracking-tight transition-colors duration-300",
                        isActive || isPast ? "text-foreground" : "text-muted-foreground/50",
                      )}
                    >
                      {stage.title}
                    </h3>
                    <p
                      className={cn(
                        "mt-2 font-mono text-xs leading-relaxed max-w-xs transition-colors duration-300",
                        isActive ? "text-muted-foreground" : "text-muted-foreground/40",
                      )}
                    >
                      {stage.detail}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right: terminal */}
          <div className="relative border border-border/60 bg-card/60 overflow-hidden stem-scan">
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                <span className="h-2 w-2 rounded-full bg-accent/70" />
                <span className="ml-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  stem-ci · run #841
                </span>
              </div>
              {/* Progress percentage */}
              <span className="font-mono text-[9px] text-accent tabular-nums">
                {Math.round(Math.min(progress, 1) * 100)}%
              </span>
            </div>

            <div className="px-5 py-4 font-mono text-[11px] md:text-xs leading-[1.9] min-h-[340px]">
              {logLines.map((line, i) => {
                const shown = i < visibleCount
                const isLatest = i === visibleCount - 1
                return (
                  <div
                    key={i}
                    className={cn(
                      "transition-all duration-300 whitespace-pre",
                      shown ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2",
                      line.text.startsWith("✓")
                        ? "text-accent"
                        : line.text.startsWith("$")
                          ? "text-foreground"
                          : "text-muted-foreground",
                    )}
                  >
                    {line.text}
                    {isLatest && <span className="stem-caret text-accent ml-1">▋</span>}
                  </div>
                )
              })}
              {visibleCount === 0 && (
                <span className="text-muted-foreground/50">
                  awaiting scroll input<span className="stem-caret text-accent ml-1">▋</span>
                </span>
              )}
            </div>

            {/* Bottom progress bar */}
            <div className="h-px w-full bg-border/40">
              <div
                className="h-full bg-accent transition-all duration-200"
                style={{ width: `${Math.min(progress, 1) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
