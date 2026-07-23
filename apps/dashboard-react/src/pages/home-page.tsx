import { Wrench } from 'lucide-react'
import { PageHeader } from '../components/ui/page-header'

export function HomePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Back-office portal"
        title="Home"
        description="A unified home view for quick summaries and shortcuts across the system."
      />

      <div className="glass-panel rounded-3xl p-10 flex flex-col items-center justify-center gap-5 text-center min-h-80">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 ring-1 ring-amber-500/30">
          <Wrench className="h-7 w-7 text-amber-400" />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <p className="text-lg font-semibold text-(--text-primary)">
            Under Maintenance
          </p>
          <p className="text-sm text-(--muted)">
            This section is currently being built. Check back soon.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-400">
          Coming Soon
        </span>
      </div>
    </div>
  )
}
