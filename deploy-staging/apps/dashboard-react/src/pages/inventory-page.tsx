import type { InventorySummary } from '@apex-pos/shared-types'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowRightLeft } from 'lucide-react'
import { DataTable } from '../components/ui/data-table'
import { PageHeader } from '../components/ui/page-header'
import { SectionCard } from '../components/ui/section-card'
import { StatusPill } from '../components/ui/status-pill'
import { useInventory } from '../hooks/use-inventory'
import { useUiStore } from '../store/ui-store'

const inventoryColumns: Array<ColumnDef<InventorySummary>> = [
  { accessorKey: 'itemName', header: 'Item' },
  { accessorKey: 'warehouseName', header: 'Warehouse' },
  { accessorKey: 'quantityOnHand', header: 'On hand' },
  { accessorKey: 'reorderPoint', header: 'Reorder point' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <StatusPill
        tone={
          row.original.status === 'HEALTHY'
            ? 'success'
            : row.original.status === 'LOW'
              ? 'warning'
              : 'danger'
        }
        label={row.original.status}
      />
    ),
  },
]

export function InventoryPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch)
  const inventoryQuery = useInventory(selectedBranch)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Warehouse operations"
        title="Stock visibility and movement rules"
        description="Track branch inventory, reorder pressure, and the approval-sensitive transfers that support offline terminals."
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.4fr]">
        <SectionCard
          title="Transfer blueprint"
          description="The API scaffold keeps stock movements append-only and reserves pull-out actions for supervisor authorization."
        >
          <div className="space-y-4 rounded-3xl bg-white/70 p-5">
            <div className="flex items-center gap-3">
              <ArrowRightLeft className="h-5 w-5 text-[color:var(--accent)]" />
              <p className="font-semibold">Warehouse A to Warehouse B</p>
            </div>
            <p className="text-sm text-[color:var(--muted)]">
              Transfers create paired stock-movement records and preserve a complete audit trail for later Z-reading and pull-out reporting.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Current stock levels"
          description="Low and out-of-stock items appear immediately so replenishment decisions happen before service slows down."
        >
          <DataTable columns={inventoryColumns} data={inventoryQuery.data ?? []} />
        </SectionCard>
      </div>
    </div>
  )
}
