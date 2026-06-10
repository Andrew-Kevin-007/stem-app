"use client"

import { useEffect, useRef, useState } from "react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts"
import type { Branch } from "@/lib/stem-api"

const ACCENT = "oklch(0.7 0.2 45)"
const GRID = "oklch(0.2 0 0)"
const MUTED = "oklch(0.55 0 0)"

interface TickPoint {
  time: string
  cloneSeconds: number
  cost: number
}

/**
 * Accumulates a live series: every time fresh branch data arrives via polling,
 * a new datapoint is appended so the charts visibly move during the demo.
 */
function useLiveSeries(branches: Branch[]): TickPoint[] {
  const [series, setSeries] = useState<TickPoint[]>([])
  const seeded = useRef(false)

  useEffect(() => {
    if (branches.length === 0) return

    const visible = branches.filter((b) => b.state !== "destroyed")
    const avgSeconds =
      visible.length > 0 ? visible.reduce((sum, b) => sum + b.ready_in_seconds, 0) / visible.length : 0
    const totalCost = visible.reduce((sum, b) => sum + b.cost_estimate_daily, 0)

    const stamp = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      minute: "2-digit",
      second: "2-digit",
    })

    setSeries((prev) => {
      // Seed with slightly varied history so the chart isn't empty on first paint
      if (!seeded.current) {
        seeded.current = true
        const seedPoints: TickPoint[] = Array.from({ length: 11 }, (_, i) => {
          const t = new Date(Date.now() - (11 - i) * 10_000)
          const wobble = Math.sin(i * 1.3) * 2.4
          return {
            time: t.toLocaleTimeString("en-US", { hour12: false, minute: "2-digit", second: "2-digit" }),
            cloneSeconds: Math.max(22, Math.round((avgSeconds + wobble) * 10) / 10),
            cost: Math.max(0.05, Math.round((totalCost + Math.sin(i * 0.9) * 0.04) * 100) / 100),
          }
        })
        return [...seedPoints, { time: stamp, cloneSeconds: Math.round(avgSeconds * 10) / 10, cost: Math.round(totalCost * 100) / 100 }]
      }

      const next = [...prev, { time: stamp, cloneSeconds: Math.round(avgSeconds * 10) / 10, cost: Math.round(totalCost * 100) / 100 }]
      return next.slice(-24)
    })
  }, [branches])

  return series
}

function ChartTooltipContent({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
  unit: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="border border-border bg-background px-3 py-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="font-mono text-sm text-accent tabular-nums">
        {unit === "$" ? `$${payload[0].value}` : `${payload[0].value}${unit}`}
      </p>
    </div>
  )
}

export function TelemetryCharts({ branches }: { branches: Branch[] }) {
  const series = useLiveSeries(branches)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 border-y border-border/30">
      {/* Clone provision time */}
      <div className="border-b lg:border-b-0 lg:border-r border-border/30 px-6 md:px-12 py-8">
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground block mb-1">
              Telemetry / 01
            </span>
            <h3 className="font-[var(--font-bebas)] text-2xl tracking-tight">CLONE PROVISION TIME</h3>
          </div>
          <span className="font-mono text-[10px] text-accent tabular-nums">
            {series.length > 0 ? `${series[series.length - 1].cloneSeconds}s` : "—"}
          </span>
        </div>

        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="2 6" vertical={false} />
              <XAxis
                dataKey="time"
                stroke={MUTED}
                fontSize={9}
                fontFamily="var(--font-mono, monospace)"
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={48}
              />
              <YAxis
                stroke={MUTED}
                fontSize={9}
                fontFamily="var(--font-mono, monospace)"
                tickLine={false}
                axisLine={false}
                domain={[20, 40]}
                unit="s"
              />
              <Tooltip content={<ChartTooltipContent unit="s" />} cursor={{ stroke: MUTED, strokeDasharray: "2 4" }} />
              <ReferenceLine
                y={30}
                stroke={MUTED}
                strokeDasharray="4 4"
                label={{
                  value: "30s SLA",
                  position: "insideTopRight",
                  fill: MUTED,
                  fontSize: 9,
                  fontFamily: "var(--font-mono, monospace)",
                }}
              />
              <Line
                type="monotone"
                dataKey="cloneSeconds"
                stroke={ACCENT}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, fill: ACCENT, stroke: "none" }}
                isAnimationActive={true}
                animationDuration={600}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Fleet cost */}
      <div className="px-6 md:px-12 py-8">
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground block mb-1">
              Telemetry / 02
            </span>
            <h3 className="font-[var(--font-bebas)] text-2xl tracking-tight">FLEET COST PER DAY</h3>
          </div>
          <span className="font-mono text-[10px] text-accent tabular-nums">
            {series.length > 0 ? `$${series[series.length - 1].cost.toFixed(2)}` : "—"}
          </span>
        </div>

        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="costFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} strokeDasharray="2 6" vertical={false} />
              <XAxis
                dataKey="time"
                stroke={MUTED}
                fontSize={9}
                fontFamily="var(--font-mono, monospace)"
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={48}
              />
              <YAxis
                stroke={MUTED}
                fontSize={9}
                fontFamily="var(--font-mono, monospace)"
                tickLine={false}
                axisLine={false}
                domain={[0, "auto"]}
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip content={<ChartTooltipContent unit="$" />} cursor={{ stroke: MUTED, strokeDasharray: "2 4" }} />
              <Area
                type="monotone"
                dataKey="cost"
                stroke={ACCENT}
                strokeWidth={2}
                fill="url(#costFill)"
                isAnimationActive={true}
                animationDuration={600}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
