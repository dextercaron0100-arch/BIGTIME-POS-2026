import { lazy, Suspense } from 'react'
import { PageHeader } from '../components/ui/page-header'
import { SectionCard } from '../components/ui/section-card'
import { useReports } from '../hooks/use-reports'

const TransactionBarChart = lazy(() =>
  import('../components/charts/transaction-bar-chart').then((module) => ({
    default: module.TransactionBarChart,
  })),
)

export function ReportsPage() {
  const reportsQuery = useReports()
  const data = reportsQuery.data

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operational reporting"
        title="Sales, branch, and queue output"
        description="This dashboard module mirrors the reporting section in the architecture, from sales trend analysis through background export queues."
      />

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <SectionCard
          title="Transaction density"
          description="A branch-facing view of volume shifts that often precede staffing or stock changes."
        >
          <div className="h-[320px]">
            <Suspense fallback={<ChartFallback />}>
              <TransactionBarChart data={data?.series ?? []} />
            </Suspense>
          </div>
        </SectionCard>

        <SectionCard
          title="Worker queues"
          description="BullMQ-backed jobs stay out of the main API process and are scoped to imports, reports, and BIR filing output."
        >
          <div className="space-y-3">
            {data?.queues?.map((queue) => (
              <article key={queue.name} className="rounded-3xl bg-[color:var(--surface-soft)] p-4">
                <p className="section-title text-lg font-bold">{queue.name}</p>
                <p className="mt-1 text-sm text-[color:var(--muted)]">{queue.description}</p>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

function ChartFallback() {
  return <div className="h-full rounded-3xl bg-[color:var(--surface-soft)]" />
}
