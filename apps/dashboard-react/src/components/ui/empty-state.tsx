import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

type EmptyStateProps = {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-16 text-center',
        className,
      )}
    >
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--header-tint)] text-[color:var(--muted)]">
          {icon}
        </div>
      )}
      <div>
        <p className="text-sm font-semibold text-[color:var(--ink)]">{title}</p>
        {description && (
          <p className="mt-1 text-xs text-[color:var(--muted)]">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
