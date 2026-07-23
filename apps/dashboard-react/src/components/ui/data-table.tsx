import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  TableIcon,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { cn } from '../../lib/utils'
import { EmptyState } from './empty-state'

type DataTableProps<TData extends object> = {
  columns: Array<ColumnDef<TData>>
  data: TData[]
  isLoading?: boolean
  skeletonRows?: number
  enableSorting?: boolean
  enablePagination?: boolean
  pageSize?: number
  emptyTitle?: string
  emptyDescription?: string
  emptyIcon?: ReactNode
}

const skeletonWidths = ['w-32', 'w-24', 'w-40', 'w-20', 'w-36', 'w-28', 'w-16', 'w-44']

function SkeletonRows({ rowCount, colCount }: { rowCount: number; colCount: number }) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, rowIdx) => (
        <tr
          key={rowIdx}
          className="border-t border-[color:var(--border)]"
        >
          {Array.from({ length: colCount }).map((__, colIdx) => (
            <td key={colIdx} className="px-4 py-3.5">
              <div
                className={`h-3.5 rounded-full route-fallback-block ${
                  skeletonWidths[(rowIdx + colIdx) % skeletonWidths.length]
                }`}
                style={{ animationDelay: `${(rowIdx * colCount + colIdx) * 35}ms` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ChevronUp className="h-3 w-3" />
  if (sorted === 'desc') return <ChevronDown className="h-3 w-3" />
  return <ChevronsUpDown className="h-3 w-3 opacity-40" />
}

export function DataTable<TData extends object>({
  columns,
  data,
  isLoading = false,
  skeletonRows = 6,
  enableSorting = true,
  enablePagination = true,
  pageSize = 15,
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting your filters or date range.',
  emptyIcon,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(enableSorting && {
      getSortedRowModel: getSortedRowModel(),
      onSortingChange: setSorting,
      state: { sorting },
    }),
    ...(enablePagination && {
      getPaginationRowModel: getPaginationRowModel(),
      initialState: { pagination: { pageSize } },
    }),
  })

  const rows = table.getRowModel().rows
  const colCount = columns.length
  const showPagination =
    enablePagination && !isLoading && table.getPageCount() > 1

  return (
    <div className="overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--table-bg)]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-[color:var(--table-head-bg)] text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = enableSorting && header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        'px-4 py-3 font-semibold',
                        canSort &&
                          'cursor-pointer select-none transition-colors hover:text-[color:var(--ink)]',
                      )}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      {header.isPlaceholder ? null : (
                        <span className="inline-flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && <SortIcon sorted={sorted} />}
                        </span>
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <SkeletonRows rowCount={skeletonRows} colCount={colCount} />
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                {rows.map((row, i) => (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15, delay: Math.min(i * 0.018, 0.2) }}
                    className="border-t border-[color:var(--border)] transition-colors hover:bg-[color:var(--table-row-hover)]"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-[color:var(--ink)]">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && rows.length === 0 && (
        <EmptyState
          icon={emptyIcon ?? <TableIcon className="h-5 w-5" />}
          title={emptyTitle}
          description={emptyDescription}
        />
      )}

      {showPagination && (
        <div className="flex items-center justify-between border-t border-[color:var(--border)] px-4 py-2.5">
          <p className="text-xs text-[color:var(--muted)]">
            Page{' '}
            <span className="font-semibold text-[color:var(--ink)]">
              {table.getState().pagination.pageIndex + 1}
            </span>{' '}
            of{' '}
            <span className="font-semibold text-[color:var(--ink)]">
              {table.getPageCount()}
            </span>
            {' '}·{' '}
            <span className="font-semibold text-[color:var(--ink)]">
              {data.length}
            </span>{' '}
            total
          </p>
          <div className="flex items-center gap-1">
            {[
              {
                icon: ChevronsLeft,
                fn: () => table.setPageIndex(0),
                disabled: !table.getCanPreviousPage(),
                label: 'First',
              },
              {
                icon: ChevronLeft,
                fn: () => table.previousPage(),
                disabled: !table.getCanPreviousPage(),
                label: 'Previous',
              },
              {
                icon: ChevronRight,
                fn: () => table.nextPage(),
                disabled: !table.getCanNextPage(),
                label: 'Next',
              },
              {
                icon: ChevronsRight,
                fn: () => table.setPageIndex(table.getPageCount() - 1),
                disabled: !table.getCanNextPage(),
                label: 'Last',
              },
            ].map(({ icon: Icon, fn, disabled, label }) => (
              <button
                key={label}
                type="button"
                onClick={fn}
                disabled={disabled}
                aria-label={label}
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[color:var(--border)] text-[color:var(--muted)] transition',
                  disabled
                    ? 'cursor-not-allowed opacity-30'
                    : 'hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
