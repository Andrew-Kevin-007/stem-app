"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Tweens between values with an ease-out cubic whenever `value` changes,
 * so stats count up on load and visibly tick when polling brings new data.
 */
export function AnimatedNumber({
  value,
  format = (v) => String(Math.round(v)),
}: {
  value: number
  format?: (v: number) => string
}) {
  const [display, setDisplay] = useState(0)
  const from = useRef(0)

  useEffect(() => {
    const start = performance.now()
    const origin = from.current
    const delta = value - origin
    if (delta === 0) return

    let raf: number
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = origin + delta * eased
      setDisplay(next)
      from.current = next
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return <span className="tabular-nums">{format(display)}</span>
}
