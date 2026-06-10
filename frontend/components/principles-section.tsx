"use client"

import { useRef, useEffect } from "react"
import { HighlightText } from "@/components/highlight-text"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Image from "next/image"

gsap.registerPlugin(ScrollTrigger)

const principles = [
  {
    number: "01",
    label: "SPEED",
    titleParts: [
      { text: "CLONED IN ", highlight: false },
      { text: "28 SECONDS", highlight: true },
    ],
    description: "Aurora copy-on-write clones spin up before your CI finishes installing dependencies.",
    align: "left",
  },
  {
    number: "02",
    label: "PRIVACY",
    titleParts: [
      { text: "ZERO ", highlight: false },
      { text: "PII", highlight: true },
      { text: " EXPOSED", highlight: false },
    ],
    description: "Emails, cards, names — masked automatically. Real schema, fake secrets.",
    align: "right",
  },
  {
    number: "03",
    label: "AUTOMATION",
    titleParts: [
      { text: "EVERY ", highlight: false },
      { text: "PULL REQUEST", highlight: true },
    ],
    description: "No tickets. No DBA approvals. Open a PR and the branch is already waiting for you.",
    align: "left",
  },
]

export function PrinciplesSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const principlesRef = useRef<HTMLDivElement>(null)
  const proofRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sectionRef.current || !headerRef.current || !principlesRef.current) return

    const ctx = gsap.context(() => {
      // Header slide in
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

      // Each principle slides in from its aligned side
      const articles = principlesRef.current?.querySelectorAll("article")
      articles?.forEach((article, index) => {
        const isRight = principles[index].align === "right"
        gsap.from(article, {
          x: isRight ? 80 : -80,
          opacity: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: article,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        })
      })

      // Proof block slides in from right
      if (proofRef.current) {
        gsap.from(proofRef.current, {
          x: 80,
          opacity: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: proofRef.current,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        })
      }
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} id="proof" className="relative py-32 pl-6 md:pl-28 pr-6 md:pr-12">
      {/* Section header */}
      <div ref={headerRef} className="mb-24">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">03 / Proof</span>
        <h2 className="mt-4 font-[var(--font-bebas)] text-5xl md:text-7xl tracking-tight">STEM IN ACTION</h2>
      </div>

      {/* Staggered principles */}
      <div ref={principlesRef} className="space-y-24 md:space-y-32">
        {principles.map((principle, index) => (
          <article
            key={index}
            className={`flex flex-col ${
              principle.align === "right" ? "items-end text-right" : "items-start text-left"
            }`}
          >
            {/* Annotation label */}
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-4">
              {principle.number} / {principle.label}
            </span>

            <h3 className="font-[var(--font-bebas)] text-4xl md:text-6xl lg:text-8xl tracking-tight leading-none">
              {principle.titleParts.map((part, i) =>
                part.highlight ? (
                  <HighlightText key={i} parallaxSpeed={0.6}>
                    {part.text}
                  </HighlightText>
                ) : (
                  <span key={i}>{part.text}</span>
                ),
              )}
            </h3>

            {/* Description */}
            <p className="mt-6 max-w-md font-mono text-sm text-muted-foreground leading-relaxed">
              {principle.description}
            </p>

            {/* Decorative line */}
            <div className={`mt-8 h-[1px] bg-border w-24 md:w-48 ${principle.align === "right" ? "mr-0" : "ml-0"}`} />
          </article>
        ))}
      </div>

      {/* The receipt — real PR comment */}
      <div ref={proofRef} className="mt-32 flex flex-col items-end text-right">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-4">
          03.1 / RECEIPT
        </span>

        <h3 className="font-[var(--font-bebas)] text-4xl md:text-6xl lg:text-8xl tracking-tight leading-none">
          NOT A <HighlightText parallaxSpeed={0.6}>MOCKUP</HighlightText>
        </h3>

        <div className="mt-12 w-full max-w-3xl group relative">
          <div className="relative bg-card border border-border/40 p-4 md:p-8 transition-all duration-500 group-hover:border-accent/60 group-hover:-translate-y-1">
            <Image
              src="/stem-pr-proof.png"
              alt="STEM bot comment posted on GitHub PR #8"
              width={800}
              height={400}
              className="w-full h-auto"
            />
            {/* Corner line micro-interaction */}
            <div className="absolute top-0 right-0 w-12 h-12 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <div className="absolute top-0 right-0 w-full h-[1px] bg-accent" />
              <div className="absolute top-0 right-0 w-[1px] h-full bg-accent" />
            </div>
          </div>
        </div>

        <p className="mt-6 font-mono text-xs text-muted-foreground">
          stem-ci posted this 28 seconds after the PR was opened
        </p>

        <div className="mt-8 h-[1px] bg-border w-24 md:w-48" />
      </div>
    </section>
  )
}
