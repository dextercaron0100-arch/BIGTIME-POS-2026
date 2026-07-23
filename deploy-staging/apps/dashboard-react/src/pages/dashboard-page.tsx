import { Activity, Landmark, Receipt, Wallet } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { PageHeader } from '../components/ui/page-header'
import { SectionCard } from '../components/ui/section-card'
import { StatCard } from '../components/ui/stat-card'
import { StatusPill } from '../components/ui/status-pill'
import { useDashboardOverview } from '../hooks/use-dashboard-overview'
import { useReports } from '../hooks/use-reports'
import { formatCurrency, formatDateTime } from '../lib/utils'
import { useUiStore } from '../store/ui-store'

const SalesAreaChart = lazy(() =>
  import('../components/charts/sales-area-chart').then((module) => ({
    default: module.SalesAreaChart,
  })),
)

export function DashboardPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch)
  const overviewQuery = useDashboardOverview(selectedBranch)
  const reportsQuery = useReports()

  const overview = overviewQuery.data
  const series = reportsQuery.data?.series ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="POS overview"
        title="Live branch pulse"
        description="Monitor revenue, terminal health, and cashier activity from one place while the API scaffold exposes the matching feature modules."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Gross sales"
          value={formatCurrency(overview?.sales.grossSales ?? 0)}
          hint="Combined sales total for the active view"
        />
        <StatCard
          label="Transactions"
          value={String(overview?.sales.transactionCount ?? 0)}
          hint="Processed receipts today"
        />
        <StatCard
          label="Average basket"
          value={formatCurrency(overview?.sales.averageBasket ?? 0)}
          hint="Rolling basket size for current period"
        />
        <StatCard
          label="VAT due"
          value={formatCurrency(overview?.sales.vatAmount ?? 0)}
          hint="Accumulated vatable tax amount"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <SectionCard
          title="Weekly sales cadence"
          description="A quick read on how transactions and revenue are moving across the week."
          action={
            <div className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 text-sm text-[color:var(--muted)]">
              <Activity className="h-4 w-4 text-[color:var(--accent)]" />
              7-day sample
            </div>
          }
        >
          <div className="h-[320px]">
            <Suspense fallback={<ChartFallback />}>
              <SalesAreaChart data={series} />
            </Suspense>
          </div>
        </SectionCard>

        <SectionCard
          title="Terminal watch"
          description="Realtime connections, cashiers, and the last heartbeat captured by the dashboard."
          action={
            <div className="rounded-full bg-white/70 px-3 py-2 text-sm text-[color:var(--muted)]">
              {overview?.terminals.length ?? 0} active terminals
            </div>
          }
        >
          <div className="space-y-3">
            {overview?.terminals.map((terminal) => (
              <article
                key={terminal.id}
                className="rounded-3xl border border-[color:var(--border)] bg-white/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{terminal.name}</p>
                    <p className="text-sm text-[color:var(--muted)]">{terminal.cashierName}</p>
                  </div>
                  <StatusPill
                    tone={
                      terminal.status === 'ONLINE'
                        ? 'success'
                        : terminal.status === 'SYNCING'
                          ? 'warning'
                          : 'danger'
                    }
                    label={terminal.status}
                  />
                </div>
                <div className="mt-4 grid gap-2 text-sm text-[color:var(--muted)]">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-[color:var(--accent)]" />
                    {terminal.serialNumber}
                  </div>
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-[color:var(--accent)]" />
                    Last seen {formatDateTime(terminal.lastSeenAt)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Branch scoreboard"
        description="Daily gross by branch with open-shift visibility for quick balancing."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {overview?.branches.map((branch) => (
            <article key={branch.id} className="rounded-3xl bg-white/70 p-5">
              <p className="section-title text-xl font-bold">{branch.name}</p>
              <p className="mt-4 text-3xl font-bold">{formatCurrency(branch.grossSalesToday)}</p>
              <div className="mt-3 flex items-center gap-4 text-sm text-[color:var(--muted)]">
                <span className="inline-flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-[color:var(--accent)]" />
                  {branch.activeTerminals} terminals
                </span>
                <span>{branch.openShifts} open shifts</span>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

function ChartFallback() {
  return <div className="h-full rounded-3xl bg-white/60" />
}
