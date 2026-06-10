"use client"

/**
 * Editorial marquee strip — the product's vital signs scrolling on loop.
 * Pure CSS animation (pauses on hover, disabled under reduced motion).
 */

const ITEMS = [
  "ISOLATED DB BRANCHES",
  "READY IN ~28 SECONDS",
  "ZERO PII EXPOSURE",
  "GDPR · HIPAA · SOC 2",
  "AURORA POSTGRESQL",
  "AURORA DSQL",
  "COPY-ON-WRITE CLONES",
  "~$0.11 / DAY PER CLONE",
  "AUTO-DESTROY ON MERGE",
]

function Strip({ ariaHidden }: { ariaHidden?: boolean }) {
  return (
    <div className="flex shrink-0 items-center" aria-hidden={ariaHidden || undefined}>
      {ITEMS.map((item) => (
        <span key={item} className="flex items-center whitespace-nowrap">
          <span className="font-[var(--font-bebas)] text-2xl md:text-3xl tracking-wide text-foreground/70">
            {item}
          </span>
          <span className="mx-8 text-accent text-xs" aria-hidden="true">
            ◆
          </span>
        </span>
      ))}
    </div>
  )
}

export function MarqueeTicker() {
  return (
    <section
      className="relative overflow-hidden border-y border-border/30 bg-card/20 py-5"
      aria-label="STEM capabilities"
    >
      <div className="stem-marquee flex w-max">
        <Strip />
        <Strip ariaHidden />
      </div>

      {/* Edge fades */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent"
        aria-hidden="true"
      />
    </section>
  )
}
