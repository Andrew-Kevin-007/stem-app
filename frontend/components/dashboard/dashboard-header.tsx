"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { utcTime } from "@/lib/utils"

export function DashboardHeader() {
  const [time, setTime] = useState<string>("")

  useEffect(() => {
    const update = () => setTime(utcTime())
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 md:px-12 py-4">
        {/* Left: wordmark + status dot */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="font-[var(--font-bebas)] text-2xl tracking-tight text-foreground hover:text-accent transition-colors"
          >
            STEM
          </Link>
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <Link
            href="/"
            className="hidden md:block font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Index
          </Link>
          <span className="hidden lg:inline-block border border-border/40 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            us-east-1 · aurora-pg <span className="text-accent/70">+</span> dsql
          </span>
        </div>

        {/* Right: nav + system status + clock */}
        <div className="flex items-center gap-6">
          <Link
            href="/docs"
            className="hidden md:block font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground transition-colors"
          >
            Docs
          </Link>
          <Link
            href="/support"
            className="hidden md:block font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground transition-colors"
          >
            Support
          </Link>
          <span className="hidden sm:block font-mono text-[10px] tracking-[0.2em] text-muted-foreground tabular-nums">
            {time || "--:--:--"} UTC
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">
            ALL SYSTEMS OPERATIONAL
          </span>
        </div>
      </div>
    </header>
  )
}
