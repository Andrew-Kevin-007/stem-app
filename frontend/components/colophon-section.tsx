"use client"

import { useRef, useEffect } from "react"
import Link from "next/link"
import { ScrambleTextOnHover } from "@/components/scramble-text"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

const architectures = [
  {
    title: "Aurora PostgreSQL",
    description: "Copy-on-write clones. Row-level isolation. Enterprise-grade consistency.",
  },
  {
    title: "Aurora DSQL",
    description: "Globally consistent metadata. Serverless scaling. No cold starts.",
  },
]

export function ColophonSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sectionRef.current) return

    const ctx = gsap.context(() => {
      // Header slide in
      if (headerRef.current) {
        gsap.from(headerRef.current, {
          x: -60,
          opacity: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: headerRef.current,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        })
      }

      // Cards fade up with stagger
      if (cardsRef.current) {
        const cards = cardsRef.current.querySelectorAll("article")
        gsap.from(cards, {
          y: 40,
          opacity: 0,
          duration: 0.8,
          stagger: 0.15,
          ease: "power3.out",
          scrollTrigger: {
            trigger: cardsRef.current,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        })
      }

      // Footer fade in
      if (footerRef.current) {
        gsap.from(footerRef.current, {
          y: 20,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: footerRef.current,
            start: "top 95%",
            toggleActions: "play none none reverse",
          },
        })
      }
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <>
      {/* Architecture Section */}
      <section ref={sectionRef} id="aws" className="relative py-32 pl-6 md:pl-28 pr-6 md:pr-12">
        {/* Section header */}
        <div ref={headerRef} className="mb-16">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">05 / Infrastructure</span>
          <h2 className="mt-4 font-[var(--font-bebas)] text-5xl md:text-7xl tracking-tight">BUILT ON AWS</h2>
        </div>

        {/* Architecture cards */}
        <div ref={cardsRef} className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl">
          {architectures.map((arch) => (
            <article
              key={arch.title}
              className="group relative border border-border/40 p-8 bg-card/30 hover:bg-card/60 transition-all duration-300"
            >
              {/* AWS Badge */}
              <div className="absolute top-4 right-4 px-2 py-1 border border-accent/40 rounded text-[8px] font-mono uppercase tracking-widest text-accent">
                AWS
              </div>

              {/* Content */}
              <div>
                <h3 className="font-[var(--font-bebas)] text-2xl md:text-3xl tracking-tight mb-4 text-foreground group-hover:text-accent transition-colors duration-300">
                  {arch.title}
                </h3>
                <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                  {arch.description}
                </p>
              </div>

              {/* Bottom accent line */}
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-accent/0 via-accent to-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </article>
          ))}
        </div>
      </section>

      {/* Footer CTA Section */}
      <section
        ref={footerRef}
        id="footer-cta"
        className="relative overflow-hidden border-t border-border/20 bg-card/20"
      >
        {/* Subtle top status strip */}
        <div className="flex items-center justify-between border-b border-border/20 px-6 md:px-28 py-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Pipeline Online
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground hidden sm:block">
            v1.0 / Beta
          </span>
        </div>

        <div className="py-24 md:py-32 pl-6 md:pl-28 pr-6 md:pr-12 flex flex-col items-start gap-12">
          {/* Headline */}
          <h2 className="font-[var(--font-bebas)] text-[clamp(3rem,9vw,8rem)] tracking-tight leading-[0.9] text-balance">
            OPEN A PR.
            <br />
            <span className="text-accent">STEM</span> HANDLES THE REST.
          </h2>

          {/* CTA Button */}
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-4 bg-foreground text-background px-10 py-5 font-mono text-xs uppercase tracking-widest hover:bg-accent hover:text-accent-foreground transition-all duration-200"
          >
            <ScrambleTextOnHover text="View Dashboard" as="span" duration={0.6} />
            <span className="text-lg transition-transform duration-300 group-hover:translate-x-1">→</span>
          </Link>

          {/* Footer columns */}
          <div className="w-full mt-12 grid grid-cols-2 sm:grid-cols-4 gap-8 pt-10 border-t border-border/20">
            <div>
              <h4 className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-4">Product</h4>
              <ul className="flex flex-col gap-2.5">
                <li>
                  <Link
                    href="/dashboard"
                    className="font-mono text-xs text-foreground/80 hover:text-accent transition-colors"
                  >
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link href="/docs" className="font-mono text-xs text-foreground/80 hover:text-accent transition-colors">
                    Documentation
                  </Link>
                </li>
                <li>
                  <a
                    href="/#pipeline"
                    className="font-mono text-xs text-foreground/80 hover:text-accent transition-colors"
                  >
                    How It Works
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-4">Developers</h4>
              <ul className="flex flex-col gap-2.5">
                <li>
                  <a
                    href="https://github.com/Andrew-Kevin-007/stem-app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-foreground/80 hover:text-accent transition-colors"
                  >
                    GitHub ↗
                  </a>
                </li>
                <li>
                  <Link href="/docs" className="font-mono text-xs text-foreground/80 hover:text-accent transition-colors">
                    Docs
                  </Link>
                </li>
                <li>
                  <Link
                    href="/support"
                    className="font-mono text-xs text-foreground/80 hover:text-accent transition-colors"
                  >
                    Support
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-4">Trust</h4>
              <ul className="flex flex-col gap-2.5">
                <li>
                  <a href="/#trust" className="font-mono text-xs text-foreground/80 hover:text-accent transition-colors">
                    Security
                  </a>
                </li>
                <li>
                  <span className="font-mono text-xs text-foreground/80">Privacy Policy</span>
                </li>
                <li>
                  <span className="font-mono text-xs text-foreground/80">DPA</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-4">Stack</h4>
              <ul className="flex flex-col gap-2.5">
                <li>
                  <span className="font-mono text-xs text-foreground/80">AWS Aurora PostgreSQL</span>
                </li>
                <li>
                  <span className="font-mono text-xs text-foreground/80">AWS Aurora DSQL</span>
                </li>
                <li>
                  <span className="font-mono text-xs text-foreground/80">Vercel</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Copyright bar */}
          <div className="w-full flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-8 border-t border-border/20">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              © 2025 STEM. Isolated branches. Zero PII.
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">Built in 28 seconds. Just like our clones.</p>
          </div>
        </div>

        {/* Giant watermark wordmark */}
        <div
          className="pointer-events-none select-none overflow-hidden border-t border-border/10"
          aria-hidden="true"
        >
          <span className="block font-[var(--font-bebas)] text-[clamp(8rem,28vw,24rem)] leading-[0.78] tracking-tight text-foreground/[0.04] text-center -mb-[0.1em]">
            STEM
          </span>
        </div>
      </section>
    </>
  )
}
