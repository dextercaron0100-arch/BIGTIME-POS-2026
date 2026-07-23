import type { PropsWithChildren, ReactNode } from 'react'

type SectionCardProps = PropsWithChildren<{
  title: string
  description?: string
  action?: ReactNode
}>

export function SectionCard({ title, description, action, children }: SectionCardProps) {
  return (
    <section className="glass-panel p-5 sm:p-6">
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
    </section>
  )
}
