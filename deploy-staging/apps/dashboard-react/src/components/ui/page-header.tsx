type PageHeaderProps = {
  eyebrow: string
  title: string
  description: string
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--accent)]">
        {eyebrow}
      </p>
      <div className="space-y-1">
        <h1 className="section-title text-3xl font-bold sm:text-4xl">{title}</h1>
        <p className="max-w-3xl text-sm text-[color:var(--muted)] sm:text-base">
          {description}
        </p>
      </div>
    </div>
  )
}
