import type { EmployeeSummary } from '@apex-pos/shared-types'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../components/ui/data-table'
import { PageHeader } from '../components/ui/page-header'
import { SectionCard } from '../components/ui/section-card'
import { useEmployees } from '../hooks/use-employees'
import { formatCurrency } from '../lib/utils'
import { useUiStore } from '../store/ui-store'

const employeeColumns: Array<ColumnDef<EmployeeSummary>> = [
  { accessorKey: 'fullName', header: 'Employee' },
  { accessorKey: 'position', header: 'Position' },
  { accessorKey: 'hoursThisWeek', header: 'Hours this week' },
  {
    accessorKey: 'rate',
    header: 'Rate',
    cell: ({ row }) => formatCurrency(row.original.rate),
  },
]

export function EmployeesPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch)
  const employeesQuery = useEmployees(selectedBranch)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="HR and scheduling"
        title="Employee and time-card monitoring"
        description="The HR module stays aligned with branch assignments, rate configuration, and time-entry aggregation."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.3fr]">
        <SectionCard
          title="Work-hour highlights"
          description="A quick view of branch staffing before deeper review."
        >
          <div className="space-y-3">
            {employeesQuery.data?.map((employee) => (
              <article key={employee.id} className="rounded-3xl bg-[color:var(--surface-soft)] p-4">
                <p className="font-semibold">{employee.fullName}</p>
                <p className="text-sm text-[color:var(--muted)]">{employee.position}</p>
                <div className="mt-3 text-sm text-[color:var(--muted)]">
                  {employee.hoursThisWeek} hours this week
                </div>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Employee ledger"
          description="Table view for payroll review, branch assignment, and staffing audit."
        >
          <DataTable columns={employeeColumns} data={employeesQuery.data ?? []} />
        </SectionCard>
      </div>
    </div>
  )
}
