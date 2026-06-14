"use client"

import { useRef, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

/**
 * Trust section: an interactive masking inspector.
 * A single switch flips a data table between what production holds (RAW)
 * and what STEM serves to a branch (MASKED). Compliance alignment line items
 * and count-up metrics flank it.
 */
const rows = [
  { col: "users.email", raw: "jane.doe@gmail.com", masked: "u_8f2a@masked.stem" },
  { col: "users.full_name", raw: "Jane Allison Doe", masked: "Vesper Aldrin" },
  { col: "users.ssn", raw: "545-87-1123", masked: "NULL" },
  { col: "payments.card", raw: "4242 4242 4242 4242", masked: "tok_9Xa4 ····" },
  { col: "orders.address", raw: "221B Baker St, London", masked: "14 Synthetic Way" },
]

const compliance = [
  { label: "GDPR Art. 32 — pseudonymisation", status: "ALIGNED" },
  { label: "HIPAA §164.514 — de-identification", status: "ALIGNED" },
  { label: "SOC 2 — least-privilege access", status: "BY DESIGN" },
  { label: "PCI DSS — cardholder data isolation", status: "BY DESIGN" },
  { label: "Audit log — every branch state change", status: "ENABLED" },
]

const metrics = [
  { value: 28, suffix: "s", label: "median clone time" },
  { value: 0, suffix: "", label: "rows of real PII served" },
  { value: 100, suffix: "%", label: "branches auto-destroyed on merge" },
]

export function TrustSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const metricsRef = useRef<HTMLDivElement>(null)
  const [masked, setMasked] = useState(true)

  useEffect(() => {
    if (!sectionRef.current || !headerRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        headerRef.current,
        { x: -60, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: headerRef.current, start: "top 85%", toggleActions: "play none none reverse" },
        },
      )

      // Count-up metrics
      const counters = metricsRef.current?.querySelectorAll("[data-count]")
      counters?.forEach((el) => {
        const target = Number(el.getAttribute("data-count"))
        const obj = { val: 0 }
        gsap.to(obj, {
          val: target,
          duration: 1.6,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 90%", toggleActions: "play none none reverse" },
          onUpdate: () => {
            el.textContent = String(Math.round(obj.val))
          },
        })
      })
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} id="trust" className="relative py-32 pl-6 md:pl-28 pr-6 md:pr-12">
      {/* Header */}
      <div ref={headerRef} className="mb-16">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">04 / Trust</span>
        <h2 className="mt-4 font-[var(--font-bebas)] text-5xl md:text-7xl tracking-tight">
          WHAT YOUR BRANCHES ACTUALLY SEE
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-12 max-w-6xl items-start">
        {/* Masking inspector */}
        <div className="border border-border/60 bg-card/40">
          {/* Inspector toolbar with the RAW/MASKED switch */}
          <div className="flex items-center justify-between border-b border-border/40 px-5 py-3">
            <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
              masking inspector
            </span>
            <div className="flex items-center border border-border/60 font-mono text-[10px] uppercase tracking-widest">
              <button
                type="button"
                onClick={() => setMasked(false)}
                className={cn(
                  "px-4 py-1.5 transition-colors duration-200",
                  !masked ? "bg-destructive/20 text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={!masked}
              >
                RAW
              </button>
              <button
                type="button"
                onClick={() => setMasked(true)}
                className={cn(
                  "px-4 py-1.5 transition-colors duration-200",
                  masked ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={masked}
              >
                MASKED
              </button>
            </div>
          </div>

          {/* Data table */}
          <div className="px-5 py-4">
            <div className="grid grid-cols-[1fr_1.3fr] gap-x-6 font-mono text-[11px] md:text-xs">
              <span className="pb-3 text-[9px] uppercase tracking-[0.3em] text-muted-foreground">column</span>
              <span className="pb-3 text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
                {masked ? "branch value" : "production value"}
              </span>
              {rows.map((row) => (
                <RowValue key={row.col} row={row} masked={masked} />
              ))}
            </div>
          </div>

          {/* Inspector footer */}
          <div className="border-t border-border/40 px-5 py-3 font-mono text-[10px] text-muted-foreground flex items-center justify-between">
            <span>
              profile: <span className="text-accent">strict</span>
            </span>
            <span className={cn("transition-colors duration-300", masked ? "text-accent" : "text-destructive")}>
              {masked ? "✓ safe for review" : "× never leaves production"}
            </span>
          </div>
        </div>

        {/* Right column: compliance ledger + metrics */}
        <div className="flex flex-col gap-10">
          <div className="border-l border-border/40 pl-6">
            <h3 className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-5">
              compliance alignment
            </h3>
            <ul className="flex flex-col gap-3">
              {compliance.map((item) => (
                <li key={item.label} className="flex items-baseline justify-between gap-4 font-mono text-[11px]">
                  <span className="text-foreground/80 leading-relaxed">{item.label}</span>
                  <span className="shrink-0 text-accent text-[9px] tracking-widest">{item.status}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Metrics */}
          <div ref={metricsRef} className="flex flex-col gap-6">
            {metrics.map((m) => (
              <div key={m.label} className="flex items-baseline gap-4 border-b border-border/30 pb-4">
                <span className="font-[var(--font-bebas)] text-5xl md:text-6xl text-foreground leading-none tabular-nums">
                  <span data-count={m.value}>0</span>
                  {m.suffix}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {m.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function RowValue({ row, masked }: { row: (typeof rows)[0]; masked: boolean }) {
  return (
    <>
      <span className="py-2.5 border-t border-border/30 text-muted-foreground">{row.col}</span>
      <span className="py-2.5 border-t border-border/30 relative overflow-hidden">
        {/* Both values stacked; flip between them */}
        <span
          className={cn(
            "block transition-all duration-500",
            masked ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 absolute inset-0",
          )}
        >
          <span className="text-accent">{row.masked}</span>
        </span>
        <span
          className={cn(
            "block transition-all duration-500",
            !masked ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 absolute inset-0",
          )}
        >
          <span className="text-destructive-foreground/90">{row.raw}</span>
        </span>
      </span>
    </>
  )
}
