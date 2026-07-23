import { CalendarDays, RotateCcw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useReceipts } from '../../hooks/use-receipts'
import { fetchManagedUsers } from '../../lib/api-client'
import { buildCashierOptions } from '../../lib/cashier-options'
import { useUiStore } from '../../store/ui-store'

const defaultDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())

const shortDateFormatter = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function normalizeDateRange(startDate: string, endDate: string) {
  return parseLocalDate(startDate) <= parseLocalDate(endDate)
    ? { startDate, endDate }
    : { startDate: endDate, endDate: startDate }
}

function formatDateRangeLabel(startDate: string, endDate: string) {
  const formattedStart = shortDateFormatter.format(parseLocalDate(startDate))
  const formattedEnd = shortDateFormatter.format(parseLocalDate(endDate))
  return `${formattedStart} - ${formattedEnd}`
}

export function DateCashierToolbar() {
  const selectedBranch = useUiStore((state) => state.selectedBranch)
  const dateFilters = useUiStore((state) => state.dateFilters)
  const setDateFilters = useUiStore((state) => state.setDateFilters)
  const receiptsQuery = useReceipts(selectedBranch)
  const managedUsersQuery = useQuery({
    queryKey: ['managed-users', selectedBranch],
    queryFn: () => fetchManagedUsers(selectedBranch),
  })

  const [draftStartDate, setDraftStartDate] = useState(dateFilters.startDate)
  const [draftEndDate, setDraftEndDate] = useState(dateFilters.endDate)
  const [draftCashier, setDraftCashier] = useState(dateFilters.cashier)
  const [hasPendingEdits, setHasPendingEdits] = useState(false)

  const effectiveStartDate = hasPendingEdits ? draftStartDate : dateFilters.startDate
  const effectiveEndDate = hasPendingEdits ? draftEndDate : dateFilters.endDate
  const effectiveCashier = hasPendingEdits ? draftCashier : dateFilters.cashier

  const cashierOptions = useMemo(() => {
    return buildCashierOptions({
      receipts: receiptsQuery.data ?? [],
      managedUsers: managedUsersQuery.data ?? [],
      extraValues: [
        dateFilters.cashier !== 'all' ? dateFilters.cashier : '',
        effectiveCashier !== 'all' ? effectiveCashier : '',
      ],
    })
  }, [
    dateFilters.cashier,
    effectiveCashier,
    managedUsersQuery.data,
    receiptsQuery.data,
  ])

  const appliedRange = normalizeDateRange(dateFilters.startDate, dateFilters.endDate)

  const applyCashierFilter = (cashier: string) => {
    setDateFilters({
      startDate: appliedRange.startDate,
      endDate: appliedRange.endDate,
      cashier,
    })
  }

  const applyFilters = () => {
    const normalizedRange = normalizeDateRange(effectiveStartDate, effectiveEndDate)
    setDateFilters({
      startDate: normalizedRange.startDate,
      endDate: normalizedRange.endDate,
      cashier: effectiveCashier,
    })
    setHasPendingEdits(false)
  }

  const resetFilters = () => {
    setDraftStartDate(defaultDate)
    setDraftEndDate(defaultDate)
    setDraftCashier('all')
    setHasPendingEdits(false)
    setDateFilters({ startDate: defaultDate, endDate: defaultDate, cashier: 'all' })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="finance-toolbar-control w-full sm:w-auto sm:min-w-[300px]">
            <CalendarDays className="h-4 w-4 shrink-0 text-[#617a8c]" />
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <input
                type="date"
                value={effectiveStartDate}
                onChange={(event) => {
                  setHasPendingEdits(true)
                  setDraftStartDate(event.target.value)
                }}
                className="finance-toolbar-input min-w-0 flex-1 sm:w-[136px] sm:flex-none"
                aria-label="Start date"
              />
              <span className="shrink-0 text-[#617a8c]">–</span>
              <input
                type="date"
                value={effectiveEndDate}
                onChange={(event) => {
                  setHasPendingEdits(true)
                  setDraftEndDate(event.target.value)
                }}
                className="finance-toolbar-input min-w-0 flex-1 sm:w-[136px] sm:flex-none"
                aria-label="End date"
              />
            </div>
          </label>

          <label className="finance-toolbar-control w-full sm:w-auto sm:min-w-[220px]">
            <select
              value={effectiveCashier}
              onChange={(event) => {
                const nextCashier = event.target.value
                setHasPendingEdits(true)
                setDraftCashier(nextCashier)
                applyCashierFilter(nextCashier)
              }}
              className="finance-toolbar-input w-full"
              aria-label="Select cashier"
            >
              <option value="all">All Cashier</option>
              {cashierOptions.map((cashier) => (
                <option key={cashier} value={cashier}>
                  {cashier}
                </option>
              ))}
            </select>
          </label>

          <button type="button" onClick={applyFilters} className="finance-toolbar-search w-full sm:w-auto">
            <Search className="h-4 w-4" />
            Search
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetFilters}
            className="finance-toolbar-icon"
            aria-label="Reset filters"
            title="Reset filters"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="text-sm text-[#6c7f8f]">
        {formatDateRangeLabel(appliedRange.startDate, appliedRange.endDate)}
        {dateFilters.cashier === 'all'
          ? ' - All cashiers'
          : ` - ${dateFilters.cashier}`}
      </p>
      {receiptsQuery.isFetching ? (
        <p className="text-xs text-[#6c7f8f]">Syncing cashier list from live receipts...</p>
      ) : null}
      {receiptsQuery.isError ? (
        <p className="text-xs text-rose-600">Unable to load live cashiers from backend transactions.</p>
      ) : null}
    </div>
  )
}
