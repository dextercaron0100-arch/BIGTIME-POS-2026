type StatCardProps = {
  label: string
  value: string
  hint: string
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <article className="glass-panel-strong animate-rise p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
        {label}
      </p>
      <p className="mt-4 section-title text-3xl font-bold">{value}</p>
      <p className="mt-2 text-sm text-[color:var(--muted)]">{hint}</p>
    </article>
  )
}
