"use client"

import { useRef, useEffect, useState, type ReactNode } from "react"

interface HighlightTextProps {
  children: ReactNode
  className?: string
  /** Stagger delay in ms before the highlight sweeps in */
  delay?: number
  /** Kept for backwards compatibility with existing call sites */
  parallaxSpeed?: number
}

/**
 * Scroll-triggered marker highlight.
 * Uses IntersectionObserver + CSS transitions instead of GSAP ScrollTrigger,
 * so it works reliably with Lenis smooth scrolling and never miscalculates
 * trigger positions on font/image load.
 */
export function HighlightText({ children, className = "", delay = 0 }: HighlightTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Activate when the phrase enters the lower 85% of the viewport;
          // deactivate only when it fully leaves, so it never flickers mid-read.
          setActive(entry.isIntersecting)
        }
      },
      { rootMargin: "0px 0px -15% 0px", threshold: 0 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <span ref={containerRef} className={`relative inline-block ${className}`}>
      <span
        aria-hidden="true"
        className="absolute bg-accent transition-transform duration-700 ease-[cubic-bezier(0.77,0,0.18,1)]"
        style={{
          left: "-0.1em",
          right: "-0.1em",
          top: "0.15em",
          bottom: "0.1em",
          transform: active ? "scaleX(1)" : "scaleX(0)",
          transformOrigin: active ? "left center" : "right center",
          transitionDelay: `${delay}ms`,
        }}
      />
      <span
        className="relative z-10 transition-colors duration-500"
        style={{
          color: active ? "oklch(0.08 0 0)" : "var(--foreground)",
          transitionDelay: `${delay + 250}ms`,
        }}
      >
        {children}
      </span>
    </span>
  )
}
