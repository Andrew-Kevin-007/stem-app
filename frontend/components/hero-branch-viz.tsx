"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Hand-drawn SVG git-branch diagram.
 * The main trunk runs vertically; PR branches fork off, get an anonymized
 * clone node, and merge back. Lines draw themselves with stroke-dashoffset,
 * staggered, then data "flows" along them as animated dashes.
 */
export function HeroBranchViz() {
  const ref = useRef<SVGSVGElement>(null)
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 300)
    return () => clearTimeout(t)
  }, [])

  // path lengths are approximate but generous; stroke-dasharray uses them
  const branches = [
    { d: "M 60 40 L 60 120 C 60 150 90 150 120 150 L 200 150", delay: 0.2, label: "pr-841", y: 150 },
    { d: "M 60 200 C 60 240 100 240 140 240 L 200 240", delay: 0.8, label: "pr-839", y: 240 },
    { d: "M 60 300 C 60 330 84 330 120 330 L 200 330", delay: 1.4, label: "pr-836", y: 330 },
  ]

  return (
    <svg
      ref={ref}
      viewBox="0 0 320 420"
      className="w-full h-full"
      fill="none"
      aria-label="Diagram of database branches forking from a production trunk"
      role="img"
    >
      {/* main trunk */}
      <line
        x1="60"
        y1="10"
        x2="60"
        y2="410"
        stroke="oklch(0.35 0 0)"
        strokeWidth="2"
        strokeDasharray="400"
        strokeDashoffset={drawn ? 0 : 400}
        style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.6,0,0.2,1)" }}
      />
      {/* trunk label */}
      <text x="44" y="405" fill="oklch(0.55 0 0)" fontSize="9" fontFamily="monospace" textAnchor="end">
        prod
      </text>
      {/* trunk commits */}
      {[40, 200, 300].map((y) => (
        <circle key={y} cx="60" cy={y} r="4" fill="oklch(0.08 0 0)" stroke="oklch(0.55 0 0)" strokeWidth="1.5" />
      ))}

      {branches.map((b, i) => (
        <g key={b.label}>
          {/* branch path: draws in */}
          <path
            d={b.d}
            stroke="oklch(0.7 0.2 45)"
            strokeWidth="1.5"
            strokeDasharray="260"
            strokeDashoffset={drawn ? 0 : 260}
            style={{
              transition: `stroke-dashoffset 1.1s cubic-bezier(0.6,0,0.2,1) ${b.delay}s`,
            }}
          />
          {/* flowing data dashes on top, fade in after draw */}
          <path
            d={b.d}
            stroke="oklch(0.7 0.2 45 / 0.5)"
            strokeWidth="1.5"
            className="stem-dash-flow"
            style={{
              opacity: drawn ? 1 : 0,
              transition: `opacity 0.5s linear ${b.delay + 1}s`,
            }}
          />
          {/* clone node */}
          <g
            style={{
              opacity: drawn ? 1 : 0,
              transition: `opacity 0.4s ease ${b.delay + 0.9}s`,
            }}
          >
            <rect
              x="200"
              y={b.y - 14}
              width="96"
              height="28"
              fill="oklch(0.12 0 0)"
              stroke="oklch(0.7 0.2 45 / 0.6)"
              strokeWidth="1"
            />
            <circle cx="214" cy={b.y} r="3" fill="oklch(0.7 0.2 45)">
              <animate attributeName="opacity" values="1;0.3;1" dur={`${1.6 + i * 0.4}s`} repeatCount="indefinite" />
            </circle>
            <text x="224" y={b.y + 3} fill="oklch(0.85 0 0)" fontSize="10" fontFamily="monospace">
              {b.label}
            </text>
          </g>
          {/* anonymized tag under node */}
          <text
            x="200"
            y={b.y + 28}
            fill="oklch(0.55 0 0)"
            fontSize="8"
            fontFamily="monospace"
            style={{
              opacity: drawn ? 1 : 0,
              transition: `opacity 0.4s ease ${b.delay + 1.2}s`,
            }}
          >
            pii: masked
          </text>
        </g>
      ))}
    </svg>
  )
}
