"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Lock } from "lucide-react"
import { cn } from "@/lib/utils"

/** Only allow same-origin path redirects — never absolute URLs. */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw
  return "/dashboard"
}

export function LoginForm({ demoKey }: { demoKey: string | null }) {
  const router = useRouter()
  const next = safeNext(useSearchParams().get("next"))

  const [email, setEmail] = useState("")
  const [accessKey, setAccessKey] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, accessKey }),
      })
      if (res.ok) {
        router.replace(next)
        return
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? `Login failed (${res.status})`)
    } catch {
      setError("Network error — try again")
    }
    setSubmitting(false)
  }

  return (
    <div className="w-full max-w-md border border-border/40 bg-card/30 backdrop-blur-sm">
      {/* Header strip */}
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

      <form onSubmit={submit} className="flex flex-col gap-6 px-8 py-10">
        <div>
          <h1 className="font-[var(--font-bebas)] text-4xl tracking-tight">SIGN IN</h1>
          <p className="mt-2 font-mono text-xs text-muted-foreground leading-relaxed">
            Authenticate to view live branches and copy database connection credentials for your
            configuration.
          </p>
        </div>

        <label className="flex flex-col gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
            Email
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="border border-border/40 bg-background/60 px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-accent focus:outline-none transition-colors"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
            Access Key
          </span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={accessKey}
            onChange={(e) => setAccessKey(e.target.value)}
            placeholder="••••••••"
            className="border border-border/40 bg-background/60 px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-accent focus:outline-none transition-colors"
          />
        </label>

        {error && (
          <p
            role="alert"
            className="border border-destructive/40 bg-destructive/5 px-4 py-3 font-mono text-xs text-destructive"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className={cn(
            "inline-flex items-center justify-center gap-3 border px-6 py-3 font-mono text-xs uppercase tracking-widest transition-all duration-200",
            submitting
              ? "border-accent/40 text-accent cursor-wait"
              : "border-foreground/20 text-foreground hover:border-accent hover:text-accent hover:bg-accent/5",
          )}
        >
          {submitting && (
            <span
              className="h-3 w-3 animate-spin rounded-full border border-accent border-t-transparent"
              aria-hidden="true"
            />
          )}
          {submitting ? "Authenticating..." : "Sign In"}
        </button>

        {demoKey && (
          <p className="font-mono text-[10px] text-muted-foreground/70 leading-relaxed">
            <span className="text-accent">$</span> demo instance — use any email with access key{" "}
            <code className="text-accent">{demoKey}</code>
          </p>
        )}
      </form>
    </div>
  )
}
