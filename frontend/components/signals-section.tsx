"use client"

import { useRef, useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

/**
 * The problem section as an "exposure ledger".
 * Each row reads like an audit log entry. The leaked value is covered by a
 * redaction bar that slides away on hover — making the visitor feel the
 * exact moment of exposure the product prevents.
 */
const incidents = [
  {
    number: "01",
    title: "SHARED CREDS",
    leak: "postgres://admin:pr0d-s3cret@prod-db:5432",
    note: "Every dev on your team has prod DB access. All of them. Always.",
  },
  {
    number: "02",
    title: "PII EXPOSURE",
    leak: "jane.doe@gmail.com · 4242 4242 4242 4242",
    note: "Real emails. Real cards. In a PR open to 12 contractors.",
  },
  {
    number: "03",
    title: "AUDIT RISK",
    leak: "SSN 545-87-1123 visible in PR #841 diff",
    note: "GDPR. HIPAA. SOC 2. One leak during a PR review. You fail.",
  },
  {
    number: "04",
    title: "SLOW REVIEWS",
    leak: "staging is 47 days behind production",
    note: '"Works on my machine" is not a test environment. It\'s a liability.',
  },
]

export function SignalsSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const [isHovering, setIsHovering] = useState(false)

  // Orange cursor follower (original micro-interaction)
  useEffect(() => {
    if (!sectionRef.current || !cursorRef.current) return
    const section = sectionRef.current
    const cursor = cursorRef.current

    const handleMouseMove = (e: MouseEvent) => {
      const rect = section.getBoundingClientRect()
      gsap.to(cursor, {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        duration: 0.5,
        ease: "power3.out",
      })
    }
    const handleMouseEnter = () => setIsHovering(true)
    const handleMouseLeave = () => setIsHovering(false)

    section.addEventListener("mousemove", handleMouseMove)
    section.addEventListener("mouseenter", handleMouseEnter)
    section.addEventListener("mouseleave", handleMouseLeave)
    return () => {
      section.removeEventListener("mousemove", handleMouseMove)
      section.removeEventListener("mouseenter", handleMouseEnter)
      section.removeEventListener("mouseleave", handleMouseLeave)
    }
  }, [])

  useEffect(() => {
    if (!sectionRef.current || !headerRef.current || !listRef.current) return
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

      // Rows wipe in from alternating sides with a clip reveal
      const rows = listRef.current?.querySelectorAll(".ledger-row")
      rows?.forEach((row, i) => {
        gsap.fromTo(
          row,
          { clipPath: i % 2 === 0 ? "inset(0 100% 0 0)" : "inset(0 0 0 100%)", opacity: 0.4 },
          {
            clipPath: "inset(0 0% 0 0%)",
            opacity: 1,
            duration: 0.9,
            ease: "power3.inOut",
            scrollTrigger: { trigger: row, start: "top 88%", toggleActions: "play none none reverse" },
          },
        )
      })
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section id="problem" ref={sectionRef} className="relative py-32 pl-6 md:pl-28 pr-6 md:pr-12">
      {/* Orange cursor follower */}
      <div
        ref={cursorRef}
        className={cn(
          "pointer-events-none absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 z-50",
          "w-12 h-12 rounded-full border-2 border-accent bg-accent",
          "transition-opacity duration-300",
          isHovering ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Section header */}
      <div ref={headerRef} className="mb-16 flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">01 / The Problem</span>
          <h2 className="mt-4 font-[var(--font-bebas)] text-5xl md:text-7xl tracking-tight">
            YOUR PROD DATA IS LEAKING
          </h2>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground max-w-[220px] leading-relaxed">
          Hover any entry to see what your reviewers see
        </p>
      </div>

      {/* Exposure ledger */}
      <div ref={listRef} className="max-w-5xl border-t border-border/40">
        {incidents.map((incident, i) => (
          <div
            key={incident.number}
            className={cn(
              "ledger-row group/row relative border-b border-border/40 py-8 md:py-10",
              "grid grid-cols-1 md:grid-cols-[80px_1.1fr_1.4fr] gap-4 md:gap-8 items-baseline",
              "transition-colors duration-300 hover:bg-card/40",
            )}
          >
            {/* Index — oversized, half-cropped */}
            <span
              className={cn(
                "font-[var(--font-bebas)] text-5xl md:text-6xl leading-none select-none",
                "text-transparent transition-colors duration-500 group-hover/row:text-accent",
              )}
              style={{ WebkitTextStroke: "1px oklch(0.4 0 0)" }}
              aria-hidden="true"
            >
              {incident.number}
            </span>

            {/* Title + note */}
            <div>
              <h3 className="font-[var(--font-bebas)] text-3xl md:text-4xl tracking-tight transition-colors duration-300 group-hover/row:text-accent">
                {incident.title}
              </h3>
              <p className="mt-3 font-mono text-xs text-muted-foreground leading-relaxed max-w-sm">{incident.note}</p>
            </div>

            {/* The leak — redacted until hover */}
            <div className="font-mono text-xs md:text-sm">
              <span className="text-muted-foreground/60 mr-3 uppercase tracking-widest text-[9px]">exposed:</span>
              <span className="stem-redacted text-accent break-all">{incident.leak}</span>
            </div>

            {/* Row marker line */}
            <div className="absolute left-0 top-0 bottom-0 w-px bg-accent scale-y-0 origin-top transition-transform duration-500 group-hover/row:scale-y-100" />
          </div>
        ))}
      </div>

      {/* Punchline */}
      <p className="mt-12 max-w-5xl text-right font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        STEM redacts all of it — <span className="text-accent">before the clone ever exists</span>
      </p>
    </section>
  )
}
