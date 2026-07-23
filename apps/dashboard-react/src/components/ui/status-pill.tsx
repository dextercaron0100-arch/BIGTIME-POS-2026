import { cn } from '../../lib/utils'

type StatusPillProps = {
  tone: 'success' | 'warning' | 'danger' | 'neutral'
  label: string
  /** Show an animated pulse dot — good for live / online statuses */
  live?: boolean
}

const toneClasses: Record<StatusPillProps['tone'], string> = {
  success: 'bg-emerald-500/18 text-emerald-300 border border-emerald-400/30',
  warning: 'bg-amber-500/18 text-amber-300 border border-amber-400/30',
  danger: 'bg-rose-500/18 text-rose-300 border border-rose-400/30',
  neutral: 'bg-slate-400/15 text-slate-200 border border-slate-300/30',
}

const dotColors: Record<StatusPillProps['tone'], string> = {
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger: 'bg-rose-400',
  neutral: 'bg-slate-400',
}

export function StatusPill({ tone, label, live = false }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]',
        toneClasses[tone],
      )}
    >
      {live && (
        <span className="relative flex h-2 w-2 shrink-0">
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              dotColors[tone],
            )}
          />
          <span
            className={cn('relative inline-flex h-2 w-2 rounded-full', dotColors[tone])}
          />
        </span>
      )}
      {label}
    </span>
  )
}
