import { animate, useInView, useMotionValue, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

type StatCardProps = {
  label: string
  value: string
  hint: string
  /** Optional raw numeric value — when provided the number animates up from 0 on first view */
  rawValue?: number
}

/** Extracts prefix, suffix and numeric portion from a formatted string like "₱1,234.56" or "143" */
function parseFormattedValue(formatted: string) {
  const match = formatted.match(/^([^0-9\-]*)([0-9,]+\.?[0-9]*)([^0-9]*)$/)
  if (!match) return { prefix: '', suffix: '', numeric: 0 }
  const [, prefix, numStr, suffix] = match
  return { prefix, suffix, numeric: parseFloat(numStr.replace(/,/g, '')) || 0 }
}

function reformat(value: number, reference: string): string {
  const { prefix, suffix } = parseFormattedValue(reference)
  const decimalMatch = reference.match(/\.(\d+)/)
  const decimals = decimalMatch ? decimalMatch[1].length : 0
  const formatted = new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
  return `${prefix}${formatted}${suffix}`
}

function AnimatedNumber({ value, rawValue }: { value: string; rawValue: number }) {
  const prefersReducedMotion = useReducedMotion()
  const ref = useRef<HTMLParagraphElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-5% 0px' })
  const motionVal = useMotionValue(0)
  const [display, setDisplay] = useState(reformat(0, value))

  useEffect(() => {
    if (!isInView) return
    if (prefersReducedMotion) {
      setDisplay(value)
      return
    }
    const controls = animate(motionVal, rawValue, {
      duration: 1.1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplay(reformat(latest, value)),
      onComplete: () => setDisplay(value),
    })
    return () => controls.stop()
  }, [isInView, rawValue, value, motionVal, prefersReducedMotion])

  return (
    <p ref={ref} className="mt-4 section-title text-3xl font-bold tabular-nums">
      {display}
    </p>
  )
}

export function StatCard({ label, value, hint, rawValue }: StatCardProps) {
  return (
    <article className="glass-panel-strong dashboard-panel-hover motion-card motion-enter glow-card p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
        {label}
      </p>
      {rawValue !== undefined ? (
        <AnimatedNumber value={value} rawValue={rawValue} />
      ) : (
        <p className="mt-4 section-title text-3xl font-bold">{value}</p>
      )}
      <p className="mt-2 text-sm text-[color:var(--muted)]">{hint}</p>
    </article>
  )
}
