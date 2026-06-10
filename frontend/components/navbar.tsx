"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const sectionLinks = [
  { id: "problem", label: "Problem" },
  { id: "pipeline", label: "Pipeline" },
  { id: "proof", label: "Proof" },
  { id: "trust", label: "Trust" },
  { id: "aws", label: "AWS" },
]

const pageLinks = [
  { href: "/docs", label: "Docs" },
  { href: "/support", label: "Support" },
]

export function Navbar() {
  const pathname = usePathname()
  const isHome = pathname === "/"
  const [scrolled, setScrolled] = useState(false)
  const [progress, setProgress] = useState(0)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  // Scroll-position based section spy — reliable for tall sections,
  // unlike IntersectionObserver thresholds.
  const onScroll = useCallback(() => {
    const y = window.scrollY
    setScrolled(y > 24)

    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    setProgress(docHeight > 0 ? Math.min(1, y / docHeight) : 0)

    if (!isHome) return

    // Active section = last section whose top has crossed the 40% viewport line
    const probe = y + window.innerHeight * 0.4
    let current: string | null = null
    for (const { id } of sectionLinks) {
      const el = document.getElementById(id)
      if (el && el.offsetTop <= probe) current = id
    }
    setActiveSection(current)
  }, [isHome])

  useEffect(() => {
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [onScroll])

  // Close mobile menu when route changes
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const scrollTo = (id: string) => {
    setMenuOpen(false)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-[background-color,border-color] duration-300",
        scrolled || menuOpen
          ? "bg-background/90 backdrop-blur-md border-b border-border/40"
          : "bg-transparent border-b border-transparent",
      )}
    >
      <nav className="flex items-center justify-between px-6 md:px-12 h-16" aria-label="Primary">
        {/* Wordmark */}
        <Link href="/" className="group flex items-center gap-3" aria-label="STEM home">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <span className="font-[var(--font-bebas)] text-2xl tracking-tight leading-none group-hover:text-accent transition-colors duration-200">
            STEM
          </span>
        </Link>

        {/* Desktop: section links — smooth scroll on home, real anchors elsewhere */}
        <div className="hidden lg:flex items-center gap-1">
          {sectionLinks.map(({ id, label }) => (
            <a
              key={id}
              href={`/#${id}`}
              onClick={(e) => {
                if (isHome) {
                  e.preventDefault()
                  scrollTo(id)
                  window.history.replaceState(null, "", `#${id}`)
                }
              }}
              className={cn(
                "relative px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors duration-200",
                activeSection === id ? "text-accent" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              <span
                className={cn(
                  "absolute bottom-0 left-3 right-3 h-px bg-accent transition-transform duration-300 origin-left",
                  activeSection === id ? "scale-x-100" : "scale-x-0",
                )}
              />
            </a>
          ))}
        </div>

        {/* Desktop: page links + CTA */}
        <div className="hidden md:flex items-center gap-6">
          {pageLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "font-mono text-[10px] uppercase tracking-[0.2em] transition-colors duration-200",
                pathname.startsWith(href) ? "text-accent" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
          <a
            href="https://github.com/Andrew-Kevin-007/stem-app"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            GitHub
          </a>
          <Link
            href="/dashboard"
            className="border border-foreground/30 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground hover:bg-foreground hover:text-background transition-all duration-200"
          >
            Dashboard ↗
          </Link>
        </div>

        {/* Mobile: hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-label="Toggle navigation menu"
        >
          <span
            className={cn(
              "block h-px w-5 bg-foreground transition-transform duration-300",
              menuOpen && "translate-y-[3.5px] rotate-45",
            )}
          />
          <span
            className={cn(
              "block h-px w-5 bg-foreground transition-transform duration-300",
              menuOpen && "-translate-y-[3px] -rotate-45",
            )}
          />
        </button>
      </nav>

      {/* Scroll progress hairline */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-border/20" aria-hidden="true">
        <div
          className="h-full bg-accent transition-[width] duration-150 ease-out"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border/30 bg-background/95 backdrop-blur-md px-6 py-6 flex flex-col gap-1">
          {sectionLinks.map(({ id, label }) => (
            <a
              key={id}
              href={`/#${id}`}
              onClick={(e) => {
                if (isHome) {
                  e.preventDefault()
                  scrollTo(id)
                  window.history.replaceState(null, "", `#${id}`)
                }
              }}
              className={cn(
                "py-3 text-left font-mono text-xs uppercase tracking-[0.2em] border-b border-border/20 transition-colors",
                activeSection === id ? "text-accent" : "text-muted-foreground",
              )}
            >
              {label}
            </a>
          ))}
          {pageLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="py-3 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground border-b border-border/20"
            >
              {label}
            </Link>
          ))}
          <Link
            href="/dashboard"
            className="mt-4 border border-foreground/30 px-4 py-3 text-center font-mono text-xs uppercase tracking-[0.2em] text-foreground"
          >
            Open Dashboard ↗
          </Link>
        </div>
      )}
    </header>
  )
}
