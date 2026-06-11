"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Cloud, Github, LogOut, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PublicSession } from "@/lib/auth"

// Rendered by the dashboard page (not a /components dashboard widget) so the
// existing dashboard components stay untouched. Fixed top-right, it surfaces
// the signed-in identity, connection health, and sign-out.
export function AccountMenu() {
  const router = useRouter()
  const [session, setSession] = useState<PublicSession | null>(null)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d: { session: PublicSession | null }) => setSession(d.session))
      .catch(() => setSession(null))
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  if (!session) return null

  const ghOk = session.installations > 0
  const awsOk = !!session.aws

  return (
    <div ref={ref} className="fixed right-4 top-3 z-[60]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 border border-border/40 bg-background/80 px-2.5 py-1.5 backdrop-blur-sm hover:border-accent/60 transition-colors"
      >
        {session.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
        ) : (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 font-mono text-[9px] text-accent">
            {session.login.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="font-mono text-[10px] text-muted-foreground max-w-[120px] truncate">{session.login}</span>
        <span className="flex items-center gap-1" aria-hidden="true">
          <span className={cn("h-1.5 w-1.5 rounded-full", ghOk ? "bg-accent" : "bg-muted-foreground/40")} />
          <span className={cn("h-1.5 w-1.5 rounded-full", awsOk ? "bg-accent" : "bg-muted-foreground/40")} />
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 border border-border/40 bg-background/95 backdrop-blur-md">
          <div className="border-b border-border/30 px-4 py-3">
            <p className="font-mono text-xs text-foreground truncate">{session.name ?? session.login}</p>
            {session.email && <p className="font-mono text-[10px] text-muted-foreground truncate">{session.email}</p>}
          </div>
          <div className="flex flex-col px-4 py-3 gap-2.5 font-mono text-[10px]">
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Github className="h-3.5 w-3.5" aria-hidden="true" />
              {ghOk ? (
                <span className="text-accent">
                  {session.installations} repo install{session.installations === 1 ? "" : "s"}
                </span>
              ) : (
                <span>No repo access</span>
              )}
            </span>
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Cloud className="h-3.5 w-3.5" aria-hidden="true" />
              {awsOk ? (
                <span className="text-accent">
                  AWS {session.aws!.accountId}
                  {session.aws!.verified ? " · verified" : ""}
                </span>
              ) : (
                <span>AWS not connected</span>
              )}
            </span>
          </div>
          <div className="flex flex-col border-t border-border/30">
            <Link
              href="/connect"
              className="inline-flex items-center gap-2 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-accent/5 hover:text-accent transition-colors"
            >
              <Settings className="h-3.5 w-3.5" aria-hidden="true" /> Manage connections
            </Link>
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" })
                router.replace("/login")
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-destructive/5 hover:text-destructive transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
