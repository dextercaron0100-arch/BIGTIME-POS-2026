import { motion, useReducedMotion } from 'framer-motion'
import type { PropsWithChildren, ReactNode } from 'react'

type SectionCardProps = PropsWithChildren<{
  title: string
  description?: string
  action?: ReactNode
  /** Stagger index — each section enters slightly after the previous */
  staggerIndex?: number
}>

export function SectionCard({
  title,
  description,
  action,
  children,
  staggerIndex = 0,
}: SectionCardProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.section
      className="page-section glass-panel dashboard-panel-hover glow-card p-5 sm:p-6"
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.992 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.42,
        delay: staggerIndex * 0.06,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="section-title text-xl font-bold">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-[color:var(--muted)]">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </motion.section>
  )
}
