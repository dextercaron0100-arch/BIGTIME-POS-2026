import type { ReceiptRecord } from '@apex-pos/shared-types'
import type { ColumnDef } from '@tanstack/react-table'
import { useDeferredValue } from 'react'
import { DataTable } from '../components/ui/data-table'
import { PageHeader } from '../components/ui/page-header'
import { SectionCard } from '../components/ui/section-card'
import { StatusPill } from '../components/ui/status-pill'
import { useReceipts } from '../hooks/use-receipts'
import { formatCurrency, formatDateTime } from '../lib/utils'
import { useUiStore } from '../store/ui-store'

const receiptColumns: Array<ColumnDef<ReceiptRecord>> = [
  { accessorKey: 'orNumber', header: 'OR No.' },
  { accessorKey: 'refNumber', header: 'Reference' },
  { accessorKey: 'cashierName', header: 'Cashier' },
  { accessorKey: 'paymentMethod', header: 'Payment' },
  {
    accessorKey: 'total',
    header: 'Total',
    cell: ({ row }) => formatCurrency(row.original.total),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <StatusPill
        tone={row.original.status === 'VOID' ? 'danger' : 'success'}
        label={row.original.status}
      />
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Issued',
    cell: ({ row }) => formatDateTime(row.original.createdAt),
  },
]

export function ReceiptsPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch)
  const globalSearch = useUiStore((state) => state.globalSearch)
  const deferredSearch = useDeferredValue(globalSearch.toLowerCase())
  const receiptsQuery = useReceipts(selectedBranch)

  const filteredReceipts = (receiptsQuery.data ?? []).filter((receipt) => {
    if (!deferredSearch) {
      return true
    }

    return (
      receipt.refNumber.toLowerCase().includes(deferredSearch) ||
      String(receipt.orNumber).includes(deferredSearch) ||
      receipt.cashierName.toLowerCase().includes(deferredSearch)
    )
  })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Transaction history"
        title="Receipt traceability"
        description="Search by OR number, payment method, or cashier to validate sales flow and investigate voids or returns."
      />

      <SectionCard
        title="Receipts ledger"
        description="The sample dataset mirrors the receipt lookup screens defined in the architecture."
        action={
          <div className="rounded-full bg-white/70 px-3 py-2 text-sm text-[color:var(--muted)]">
            {filteredReceipts.length} visible receipts
          </div>
        }
      >
        <DataTable columns={receiptColumns} data={filteredReceipts} />
      </SectionCard>
    </div>
  )
}
