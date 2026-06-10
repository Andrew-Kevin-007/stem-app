"use client"

import { cn } from "@/lib/utils"
import type { PoolSlot } from "@/lib/stem-api"

const STATUS_STYLE: Record<PoolSlot["state"], { label: string; box: string; dot: string }> = {
  in_use: {
    label: "IN USE",
    box: "border-accent/50 bg-accent/10",
    dot: "bg-accent",
  },
  provisioning: {
    label: "PROVISIONING",
    box: "border-amber-500/40 bg-amber-500/5",
    dot: "bg-amber-500",
  },
  warm: {
    label: "WARM",
    box: "border-border/40 bg-card/30",
    dot: "bg-muted-foreground",
  },
}

// The pre-warm pool ships six slots; until the backend manages them the
// API returns an empty array and every slot reads as standby.
const STANDBY_SLOTS: PoolSlot[] = Array.from({ length: 6 }, (_, i) => ({
  slot_id: `slot-${String(i + 1).padStart(2, "0")}`,
  state: "warm",
}))

export function PoolSlots({ slots }: { slots: PoolSlot[] }) {
  const display = slots.length > 0 ? slots : STANDBY_SLOTS
  const inUse = display.filter((s) => s.state === "in_use").length

  return (
    <div className="px-6 md:px-12 py-8 border-b border-border/30">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground block mb-1">
            Telemetry / 03
          </span>
          <h3 className="font-[var(--font-bebas)] text-2xl tracking-tight">WARM CLUSTER POOL</h3>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
          <span className="text-accent">{inUse}</span> / {display.length} allocated
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {display.map((slot, i) => {
          const style = STATUS_STYLE[slot.state]
          return (
            <div
              key={slot.slot_id}
              className={cn(
                "relative border p-4 flex flex-col gap-3 transition-all duration-500",
                "animate-in fade-in zoom-in-95",
                style.box,
              )}
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards", animationDuration: "500ms" }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground">{slot.slot_id}</span>
                <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                  {slot.state !== "warm" && (
                    <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", style.dot)} />
                  )}
                  <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", style.dot)} />
                </span>
              </div>
              <span
                className={cn(
                  "font-mono text-[9px] uppercase tracking-[0.2em]",
                  slot.state === "in_use" && "text-accent",
                  slot.state === "provisioning" && "text-amber-500",
                  slot.state === "warm" && "text-muted-foreground",
                )}
              >
                {style.label}
              </span>
              {slot.branch_id && (
                <span className="font-mono text-[8px] text-muted-foreground/50 truncate">{slot.branch_id}</span>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-4 font-mono text-[10px] text-muted-foreground/60 leading-relaxed">
        Pre-warmed Aurora clusters waiting for assignment — this is how clones go live in under 30 seconds.
      </p>
    </div>
  )
}
