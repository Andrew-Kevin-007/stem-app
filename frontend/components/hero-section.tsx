"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ScrambleTextOnHover } from "@/components/scramble-text"
import { AnimatedNoise } from "@/components/animated-noise"
import { BitmapChevron } from "@/components/bitmap-chevron"
import { HeroBranchViz } from "@/components/hero-branch-viz"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

const TERMINAL_LINE = "$ stem branch create --pr 841 --anonymize"

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const lettersRef = useRef<HTMLHeadingElement>(null)
  const [typed, setTyped] = useState("")
  const [typedDone, setTypedDone] = useState(false)

  // Letter-by-letter rise for the wordmark
  useEffect(() => {
    if (!lettersRef.current) return
    const letters = lettersRef.current.querySelectorAll("span[data-letter]")
    const ctx = gsap.context(() => {
      gsap.fromTo(
        letters,
        { yPercent: 110, rotate: 4 },
        { yPercent: 0, rotate: 0, duration: 0.9, stagger: 0.07, ease: "power4.out", delay: 0.15 },
      )
    }, lettersRef)
    return () => ctx.revert()
  }, [])

  // Terminal typing
  useEffect(() => {
    let i = 0
    const interval = setInterval(() => {
      i++
      setTyped(TERMINAL_LINE.slice(0, i))
      if (i >= TERMINAL_LINE.length) {
        clearInterval(interval)
        setTypedDone(true)
      }
    }, 45)
    return () => clearInterval(interval)
  }, [])

  // Parallax exit
  useEffect(() => {
    if (!sectionRef.current || !contentRef.current) return
    const ctx = gsap.context(() => {
      gsap.to(contentRef.current, {
        y: -100,
        opacity: 0,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      })
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative min-h-screen flex items-center pl-6 md:pl-28 pr-6 md:pr-12 py-24"
    >
      <AnimatedNoise opacity={0.03} />

      {/* Left vertical label */}
      <div className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 hidden md:block">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground -rotate-90 origin-left block whitespace-nowrap">
          DATABASE BRANCHING
        </span>
      </div>

      <div ref={contentRef} className="flex-1 w-full grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-16 items-center">
        {/* Left: copy */}
        <div>
          {/* Wordmark with per-letter mask reveal */}
          <h1
            ref={lettersRef}
            className="font-[var(--font-bebas)] text-[clamp(5rem,16vw,12rem)] tracking-tight leading-[0.85] flex overflow-hidden"
            aria-label="STEM"
          >
            {"STEM".split("").map((l, i) => (
              <span key={i} data-letter aria-hidden="true" className="inline-block will-change-transform">
                {l}
              </span>
            ))}
          </h1>

          <h2 className="font-[var(--font-bebas)] text-muted-foreground/70 text-[clamp(1.1rem,3vw,2rem)] mt-4 tracking-wide text-balance">
            Isolated database branches. Every PR. Zero PII.
          </h2>

          {/* Typing terminal strip */}
          <div className="mt-10 max-w-md border border-border/60 bg-card/50 relative overflow-hidden stem-scan">
            <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
              <span className="h-2 w-2 rounded-full bg-accent/70" />
              <span className="ml-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                stem-cli
              </span>
            </div>
            <div className="px-4 py-3 font-mono text-xs text-foreground/90">
              {typed}
              <span className="stem-caret text-accent">▋</span>
              {typedDone && (
                <div className="mt-1 text-muted-foreground">
                  <span className="text-accent">✓</span> clone ready in 28s — 5 columns masked
                </div>
              )}
            </div>
          </div>

          <div className="mt-12 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-3 border border-foreground px-6 py-3 font-mono text-xs uppercase tracking-widest text-foreground hover:bg-foreground hover:text-background transition-all duration-200"
            >
              <ScrambleTextOnHover text="Open Dashboard" as="span" duration={0.6} />
              <span className="text-lg">↗</span>
            </Link>
            <a
              href="https://github.com/Andrew-Kevin-007/stem-app"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-3 border border-foreground/20 px-6 py-3 font-mono text-xs uppercase tracking-widest text-foreground hover:border-accent hover:text-accent transition-all duration-200"
            >
              <ScrambleTextOnHover text="View on GitHub" as="span" duration={0.6} />
              <BitmapChevron className="transition-transform duration-[400ms] ease-in-out group-hover:rotate-45" />
            </a>
          </div>
        </div>

        {/* Right: animated branch diagram */}
        <div className="hidden lg:block h-[420px] border-l border-border/30 pl-8">
          <HeroBranchViz />
        </div>
      </div>

      {/* Floating info tag */}
      <div className="absolute bottom-8 right-8 md:bottom-12 md:right-12">
        <div className="border border-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          v1.0 / Beta
        </div>
      </div>
    </section>
  )
}
