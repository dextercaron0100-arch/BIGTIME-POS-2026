import { cn } from '../../lib/utils'

type StatusPillProps = {
  tone: 'success' | 'warning' | 'danger' | 'neutral'
  label: string
}

const toneClasses: Record<StatusPillProps['tone'], string> = {
  success: 'bg-emerald-100/80 text-emerald-800',
  warning: 'bg-amber-100/80 text-amber-800',
  danger: 'bg-rose-100/80 text-rose-800',
  neutral: 'bg-stone-200/70 text-stone-700',
}

export function StatusPill({ tone, label }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]',
        toneClasses[tone],
      )}
    >
      {label}
    </span>
  )
}
