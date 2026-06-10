"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Github, Lock, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard"
}

const ERRORS: Record<string, string> = {
  oauth_unconfigured: "GitHub sign-in isn't configured on this deployment.",
  access_denied: "GitHub authorization was cancelled.",
  state_mismatch: "Security check failed (state mismatch). Please try again.",
  missing_code: "GitHub didn't return an authorization code. Try again.",
  exchange_failed: "Couldn't complete GitHub sign-in. Try again.",
}

export function LoginForm({ oauthEnabled }: { oauthEnabled: boolean }) {
  const router = useRouter()
  const params = useSearchParams()
  const next = safeNext(params.get("next"))
  const urlError = params.get("error")

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(urlError ? (ERRORS[urlError] ?? "Sign-in failed.") : null)

  const startDemo = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/demo", { method: "POST" })
      if (res.ok) return router.replace(next)
      setError("Demo mode is disabled on this deployment.")
    } catch {
      setError("Network error — try again.")
    }
    setBusy(false)
  }

  return (
    <div className="w-full max-w-md border border-border/40 bg-card/30 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border/30 px-8 py-4">
        <Link
          href="/"
          className="font-[var(--font-bebas)] text-2xl tracking-tight text-foreground hover:text-accent transition-colors"
        >
          STEM
        </Link>
        <span className="inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
          <Lock className="h-3 w-3 text-accent" aria-hidden="true" />
          Operator Access
        </span>
      </div>

      <div className="flex flex-col gap-6 px-8 py-10">
        <div>
          <h1 className="font-[var(--font-bebas)] text-4xl tracking-tight">SIGN IN</h1>
          <p className="mt-2 font-mono text-xs text-muted-foreground leading-relaxed">
            Authenticate with GitHub to view live branches and connect the repositories and AWS
            account STEM provisions clones in.
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="border border-destructive/40 bg-destructive/5 px-4 py-3 font-mono text-xs text-destructive"
          >
            {error}
          </p>
        )}

        {oauthEnabled ? (
          <a
            href={`/api/auth/github?next=${encodeURIComponent(next)}`}
            className="inline-flex items-center justify-center gap-3 border border-foreground/20 bg-foreground px-6 py-3.5 font-mono text-xs uppercase tracking-widest text-background hover:bg-accent hover:text-accent-foreground hover:border-accent transition-all duration-200"
          >
            <Github className="h-4 w-4" aria-hidden="true" />
            Continue with GitHub
          </a>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              disabled
              title="Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to enable GitHub sign-in"
              className="inline-flex items-center justify-center gap-3 border border-border/40 px-6 py-3.5 font-mono text-xs uppercase tracking-widest text-muted-foreground/50 cursor-not-allowed"
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              Continue with GitHub
            </button>
            <button
              type="button"
              onClick={startDemo}
              disabled={busy}
              className={cn(
                "inline-flex items-center justify-center gap-3 border px-6 py-3 font-mono text-xs uppercase tracking-widest transition-all duration-200",
                busy
                  ? "border-accent/40 text-accent cursor-wait"
                  : "border-foreground/20 text-foreground hover:border-accent hover:text-accent hover:bg-accent/5",
              )}
            >
              {busy && (
                <span
                  className="h-3 w-3 animate-spin rounded-full border border-accent border-t-transparent"
                  aria-hidden="true"
                />
              )}
              {busy ? "Starting…" : "Continue in demo mode"}
            </button>
            <p className="font-mono text-[10px] text-muted-foreground/70 leading-relaxed">
              <span className="text-accent">$</span> GitHub sign-in not configured — set{" "}
              <code className="text-accent">GITHUB_CLIENT_ID</code> /{" "}
              <code className="text-accent">GITHUB_CLIENT_SECRET</code> to enable it.
            </p>
          </div>
        )}

        <div className="flex items-start gap-2 border-t border-border/20 pt-5 font-mono text-[10px] text-muted-foreground/70 leading-relaxed">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent/70" aria-hidden="true" />
          <span>
            STEM requests your public GitHub profile only. Repository access is granted separately
            when you install the STEM App on the repos you choose. Sessions are encrypted (AES-256-GCM),
            httpOnly, and expire in 12 hours.
          </span>
        </div>
      </div>
    </div>
  )
}
