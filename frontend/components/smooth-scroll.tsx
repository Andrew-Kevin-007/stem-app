"use client"

import type React from "react"

import { useEffect, useRef } from "react"
import Lenis from "lenis"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    // Respect users who ask for reduced motion — no smooth-scroll hijack.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      smoothWheel: true,
    })
    lenisRef.current = lenis

    // Keep ScrollTrigger in lockstep with Lenis. Both the listener and the
    // ticker callback are NAMED so cleanup removes the exact references —
    // the previous code removed `lenis.raf` (never the anonymous wrapper that
    // was added), leaking a ticker callback per remount and desyncing every
    // pinned/scrubbed ScrollTrigger (the pipeline scroll demo).
    const onScroll = () => ScrollTrigger.update()
    lenis.on("scroll", onScroll)

    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    // Pins are measured at mount; refresh once Lenis is driving the scroll.
    ScrollTrigger.refresh()

    return () => {
      lenis.off("scroll", onScroll)
      gsap.ticker.remove(raf)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  return <>{children}</>
}
