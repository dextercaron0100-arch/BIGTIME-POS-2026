import type { ReceiptRecord, ReportPoint } from '@apex-pos/shared-types'
import {
  ArrowUpRight,
  ArrowDownRight,
  BadgeDollarSign,
  CreditCard,
  Landmark,
  Monitor,
  Receipt,
  ShoppingCart,
  Wallet,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRealtimeConnected } from '../lib/realtime'
import { FinanceMonitorPanel } from '../components/dashboard/finance-monitor-panel'
import { SectionCard } from '../components/ui/section-card'
import { StatusPill } from '../components/ui/status-pill'
import { useCatalog } from '../hooks/use-catalog'
import { useDashboardOverview } from '../hooks/use-dashboard-overview'
import { useReceipts } from '../hooks/use-receipts'
import { fetchManagedUsers } from '../lib/api-client'
import { normalizeCashierName } from '../lib/cashier-options'
import { formatCurrency, formatDateTime } from '../lib/utils'
import {
  createBirTerminalReading,
  useBirTerminalReadingStore,
} from '../store/bir-terminal-reading-store'
import { useUiStore } from '../store/ui-store'

const TopSellingItemsChart = lazy(() =>
  import('../components/charts/top-selling-items-chart').then((m) => ({
    default: m.TopSellingItemsChart,
  })),
)
const TopSellingCategoriesChart = lazy(() =>
  import('../components/charts/top-selling-categories-chart').then((m) => ({
    default: m.TopSellingCategoriesChart,
  })),
)
const CostRevenueChart = lazy(() =>
  import('../components/charts/cost-revenue-chart').then((m) => ({
    default: m.CostRevenueChart,
  })),
)
const PaymentSourceChart = lazy(() =>
  import('../components/charts/payment-source-chart').then((m) => ({
    default: m.PaymentSourceChart,
  })),
)

const wholeNumberFormatter = new Intl.NumberFormat('en-PH')
const manilaDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const manilaHourFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  hour: '2-digit',
  hourCycle: 'h23',
})

const hourLabels = [
  '1:00 AM',
  '3:00 AM',
  '5:00 AM',
  '7:00 AM',
  '9:00 AM',
  '11:00 AM',
  '1:00 PM',
  '3:00 PM',
  '5:00 PM',
  '7:00 PM',
  '9:00 PM',
  '11:00 PM',
]

type DashboardReceipt = ReceiptRecord & {
  type?: 'SALE' | 'REFUND'
  taxAmount?: number
  payments?: Array<{
    method?: string
    amount?: number
  }>
}

type MetricValues = {
  txnCount: number
  grossSales: number
  includedTax: number
  addedTax: number
  serviceFee: number
  diningOptionFee: number
  discount: number
  refund: number
  netSales: number
  payIn: number
  payOut: number
  itemCost: number
  grossProfit: number
  redeemedPoints: number
}

const emptyMetricValues: MetricValues = {
  txnCount: 0,
  grossSales: 0,
  includedTax: 0,
  addedTax: 0,
  serviceFee: 0,
  diningOptionFee: 0,
  discount: 0,
  refund: 0,
  netSales: 0,
  payIn: 0,
  payOut: 0,
  itemCost: 0,
  grossProfit: 0,
  redeemedPoints: 0,
}

type CatalogSnapshotLike = {
  categories?: Array<{ id: string; name: string }>
  items?: Array<{
    id?: string
    name: string
    categoryId: string
    sku?: string
    barcode?: string
  }>
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function normalizeDateRange(startDate: string, endDate: string) {
  return parseLocalDate(startDate) <= parseLocalDate(endDate)
    ? { startDate, endDate }
    : { startDate: endDate, endDate: startDate }
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2))
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function asManilaDayKey(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const parts = manilaDayFormatter.formatToParts(new Date(value))
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (!year || !month || !day) {
    return value.slice(0, 10)
  }

  return `${year}-${month}-${day}`
}

function resolveReceiptKind(receipt: DashboardReceipt): 'SALE' | 'REFUND' {
  const rawType = typeof receipt.type === 'string' ? receipt.type.toUpperCase() : ''

  if (rawType === 'SALE' || rawType === 'REFUND') {
    return rawType
  }

  if (receipt.status === 'RETURNED') {
    return 'REFUND'
  }

  if (typeof receipt.refNumber === 'string' && receipt.refNumber.toUpperCase().startsWith('REFUND-')) {
    return 'REFUND'
  }

  return 'SALE'
}

function normalizeItemName(name: string) {
  return name.trim().toLowerCase()
}

function resolveCatalogItemKey(value: unknown) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().toLowerCase()
}

function normalizePaymentLabel(method: string | undefined) {
  const normalized = method?.toUpperCase() ?? ''

  if (normalized === 'CASH') {
    return 'Cash'
  }
  if (normalized === 'CARD') {
    return 'Card'
  }
  if (normalized === 'GCASH') {
    return 'GCash'
  }
  if (normalized === 'MAYA') {
    return 'Maya'
  }
  return 'Others'
}

function getTwoHourBucketLabel(timestamp: string) {
  const date = new Date(timestamp)

  if (Number.isNaN(date.getTime())) {
    return hourLabels[0]
  }

  const hour = Number(manilaHourFormatter.format(date))

  if (!Number.isFinite(hour)) {
    return hourLabels[0]
  }

  const bucketIndex = Math.max(0, Math.min(Math.floor(hour / 2), hourLabels.length - 1))
  return hourLabels[bucketIndex]
}

function buildSeriesFromBuckets(
  hourlyBuckets: Map<string, MetricValues>,
  metricKey: keyof MetricValues,
  integer = false,
): ReportPoint[] {
  return hourLabels.map((label) => {
    const bucket = hourlyBuckets.get(label) ?? emptyMetricValues
    const value = bucket[metricKey]

    return {
      label,
      sales: integer ? Math.max(0, Math.round(value)) : roundCurrency(value),
      transactions: Math.max(0, Math.round(bucket.txnCount)),
    }
  })
}

function formatShortDateLabel(dayKey: string) {
  return parseLocalDate(dayKey).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
  })
}

function toDayKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function listTrailingDayKeys(endDate: string, count: number) {
  const end = parseLocalDate(endDate)
  const keys: string[] = []

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const current = new Date(end)
    current.setDate(end.getDate() - offset)
    keys.push(toDayKey(current))
  }

  return keys
}

function createEmptyMetricValues(): MetricValues {
  return { ...emptyMetricValues }
}

function formatPoints(value: number) {
  return `${wholeNumberFormatter.format(Math.round(value))} pts`
}

function ChartFallback() {
  return <div className="h-[280px] animate-pulse rounded-2xl bg-[color:var(--header-tint)]" />
}

function KpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  gradient,
  trend,
  trendLabel,
}: {
  label: string
  value: string
  subtitle?: string
  icon: typeof Receipt
  gradient: string
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
}) {
  return (
    <article className={`group relative overflow-hidden rounded-[24px] bg-gradient-to-br ${gradient} p-5 shadow-md transition hover:shadow-lg hover:-translate-y-0.5`}>
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-white/75">
            {label}
          </p>
          <p className="section-title text-[1.85rem] font-bold leading-none tracking-[-0.03em] text-white">
            {value}
          </p>
          {subtitle && (
            <p className="text-[0.8rem] text-white/70">{subtitle}</p>
          )}
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 transition group-hover:scale-105 group-hover:bg-white/25">
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
      {trend && trendLabel && (
        <div className="mt-3 flex items-center gap-1.5">
          {trend === 'up' ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-white" />
          ) : trend === 'down' ? (
            <ArrowDownRight className="h-3.5 w-3.5 text-white/80" />
          ) : null}
          <span className="text-xs font-semibold text-white/90">{trendLabel}</span>
        </div>
      )}
      <div className="pointer-events-none absolute -right-6 -bottom-6 h-28 w-28 rounded-full bg-white/10 transition group-hover:bg-white/15" />
    </article>
  )
}

function SyncPostureCard({
  overview,
  wsConnected,
}: {
  overview: ReturnType<typeof useDashboardOverview>['data']
  wsConnected: boolean
}) {
  const onlineTerminals = overview?.terminals?.filter((t) => t.status === 'ONLINE').length ?? 0
  const totalTerminals = overview?.terminals?.length ?? 0

  return (
    <div className="motion-enter rounded-[24px] border border-[color:var(--border)] bg-white px-6 py-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
            Sync Posture
          </p>
          <p className="mt-2 section-title text-2xl font-bold">{onlineTerminals} of {totalTerminals} online</p>
          <p className="mt-1.5 text-sm text-[color:var(--muted)]">
            {wsConnected
              ? 'Realtime sync active. Dashboard and POS terminals are connected.'
              : 'Connecting to realtime sync\u2026'}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-2.5 text-sm font-medium text-[color:var(--muted)]">
          <span
            className={`h-2.5 w-2.5 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-amber-400'} animate-pulse`}
          />
          {wsConnected ? 'Live' : 'Reconnecting'}
        </div>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch)
  const appliedFilters = useUiStore((state) => state.dateFilters)
  const wsConnected = useRealtimeConnected()
  const receiptsQuery = useReceipts(selectedBranch)
  const catalogQuery = useCatalog(selectedBranch)
  const overviewQuery = useDashboardOverview(selectedBranch)
  const overview = overviewQuery.data
  const receipts = useMemo(
    () => (receiptsQuery.data ?? []) as DashboardReceipt[],
    [receiptsQuery.data],
  )
  const managedUsersQuery = useQuery({
    queryKey: ['managed-users', selectedBranch],
    queryFn: () => fetchManagedUsers(selectedBranch),
  })
  const managedUsers = managedUsersQuery.data ?? []
  const catalogData = (catalogQuery.data ?? undefined) as CatalogSnapshotLike | undefined
  const birReadings = useBirTerminalReadingStore((state) => state.readings)
  const ensureBirReadings = useBirTerminalReadingStore((state) => state.ensureSeeded)
  const addBirReading = useBirTerminalReadingStore((state) => state.addReading)

  const [birNotice, setBirNotice] = useState<string | null>(null)

  useEffect(() => {
    ensureBirReadings()
  }, [ensureBirReadings])

  useEffect(() => {
    if (!birNotice) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setBirNotice(null)
    }, 3200)

    return () => window.clearTimeout(timeoutId)
  }, [birNotice])

  const itemCategoryLookup = useMemo(() => {
    const categoryById = new Map<string, string>()
    const categoryLookup = new Map<string, string>()
    const catalogItemLookup = new Map<
      string,
      { name: string; categoryName: string }
    >()

    for (const category of catalogData?.categories ?? []) {
      if (category?.id && category?.name) {
        categoryById.set(category.id, category.name)
      }
    }

    for (const item of catalogData?.items ?? []) {
      if (!item?.name) {
        continue
      }

      const normalizedItemName = normalizeItemName(item.name)
      const categoryName = categoryById.get(item.categoryId) ?? 'Uncategorized'
      const canonicalName = item.name.trim()

      categoryLookup.set(normalizedItemName, categoryName)

      const record = { name: canonicalName, categoryName }
      const keys = [
        resolveCatalogItemKey(item.id),
        resolveCatalogItemKey(item.name),
        resolveCatalogItemKey(item.sku),
        resolveCatalogItemKey(item.barcode),
      ].filter(Boolean)

      for (const key of keys) {
        catalogItemLookup.set(key, record)
      }
    }

    return { categoryLookup, catalogItemLookup }
  }, [catalogData])

  const appliedRange = normalizeDateRange(appliedFilters.startDate, appliedFilters.endDate)

  const filteredReceipts = useMemo(() => {
    return receipts.filter((receipt) => {
      const dayKey = asManilaDayKey(receipt.createdAt)

      if (dayKey < appliedRange.startDate || dayKey > appliedRange.endDate) {
        return false
      }

      if (
        appliedFilters.cashier !== 'all' &&
        normalizeCashierName(receipt.cashierName, managedUsers) !== appliedFilters.cashier
      ) {
        return false
      }

      return true
    })
  }, [
    appliedFilters.cashier,
    appliedRange.endDate,
    appliedRange.startDate,
    managedUsers,
    receipts,
  ])

  const {
    metricValues,
    seriesByMetric,
    topSellingItems,
    topSellingCategories,
    costRevenueData,
    paymentSourceData,
  } = useMemo(() => {
    const values = createEmptyMetricValues()
    const hourlyBuckets = new Map<string, MetricValues>()
    const itemTotals = new Map<string, { revenue: number; quantity: number }>()
    const categoryTotals = new Map<string, number>()
    const paymentTotals = new Map<string, number>()
    const dailyRevenue = new Map<string, number>()

    for (const label of hourLabels) {
      hourlyBuckets.set(label, createEmptyMetricValues())
    }

    for (const receipt of filteredReceipts) {
      const kind = resolveReceiptKind(receipt)
      const isVoidedSale = kind === 'SALE' && receipt.status === 'VOID'
      const sign = kind === 'REFUND' ? -1 : isVoidedSale ? 0 : 1

      if (sign === 0) {
        continue
      }

      const total = asNumber(receipt.total)
      const vatAmount = asNumber(receipt.vatAmount ?? receipt.taxAmount)
      const discountAmount = asNumber(receipt.discountAmount)
      const bucketLabel = getTwoHourBucketLabel(receipt.createdAt)
      const bucket = hourlyBuckets.get(bucketLabel) ?? createEmptyMetricValues()
      const dayKey = asManilaDayKey(receipt.createdAt)

      if (sign > 0) {
        values.txnCount += 1
        bucket.txnCount += 1

        values.grossSales += total
        bucket.grossSales += total

        values.includedTax += vatAmount
        bucket.includedTax += vatAmount

        values.discount += discountAmount
        bucket.discount += discountAmount

        values.netSales += total
        bucket.netSales += total
      } else {
        const refundAmount = Math.abs(total)
        const refundTax = Math.abs(vatAmount)

        values.refund += refundAmount
        bucket.refund += refundAmount

        values.netSales -= refundAmount
        bucket.netSales -= refundAmount

        values.includedTax -= refundTax
        bucket.includedTax -= refundTax
      }

      dailyRevenue.set(dayKey, (dailyRevenue.get(dayKey) ?? 0) + total * sign)

      const lineItems = Array.isArray(receipt.items) ? receipt.items : []
      for (const item of lineItems) {
        const lineItemMeta = item as {
          itemId?: unknown
          id?: unknown
          sku?: unknown
          barcode?: unknown
          name?: unknown
        }
        const resolvedCatalogItem =
          itemCategoryLookup.catalogItemLookup.get(
            resolveCatalogItemKey(lineItemMeta.itemId),
          ) ??
          itemCategoryLookup.catalogItemLookup.get(
            resolveCatalogItemKey(lineItemMeta.id),
          ) ??
          itemCategoryLookup.catalogItemLookup.get(
            resolveCatalogItemKey(lineItemMeta.sku),
          ) ??
          itemCategoryLookup.catalogItemLookup.get(
            resolveCatalogItemKey(lineItemMeta.barcode),
          ) ??
          itemCategoryLookup.catalogItemLookup.get(
            resolveCatalogItemKey(lineItemMeta.name),
          )
        const itemName =
          resolvedCatalogItem?.name ??
          (typeof item.name === 'string' && item.name.trim().length > 0
            ? item.name.trim()
            : 'Unnamed item')
        const quantity = asNumber(item.qty)
        const price = asNumber(item.price)

        if (quantity <= 0 || price < 0) {
          continue
        }

        const revenueDelta = quantity * price * sign
        const quantityDelta = quantity * sign
        const itemTotalsRow = itemTotals.get(itemName) ?? { revenue: 0, quantity: 0 }

        itemTotalsRow.revenue += revenueDelta
        itemTotalsRow.quantity += quantityDelta
        itemTotals.set(itemName, itemTotalsRow)

        const categoryName =
          resolvedCatalogItem?.categoryName ??
          itemCategoryLookup.categoryLookup.get(normalizeItemName(itemName)) ??
          'Uncategorized'
        categoryTotals.set(categoryName, (categoryTotals.get(categoryName) ?? 0) + revenueDelta)
      }

      const payments = Array.isArray(receipt.payments) ? receipt.payments : []
      if (payments.length > 0) {
        for (const payment of payments) {
          const paymentName = normalizePaymentLabel(payment.method)
          const amount = asNumber(payment.amount)
          paymentTotals.set(paymentName, (paymentTotals.get(paymentName) ?? 0) + amount * sign)
        }
      } else {
        const paymentName = normalizePaymentLabel(receipt.paymentMethod)
        paymentTotals.set(paymentName, (paymentTotals.get(paymentName) ?? 0) + total * sign)
      }

      hourlyBuckets.set(bucketLabel, bucket)
    }

    values.grossSales = roundCurrency(values.grossSales)
    values.includedTax = roundCurrency(values.includedTax)
    values.discount = roundCurrency(values.discount)
    values.refund = roundCurrency(values.refund)
    values.netSales = roundCurrency(values.netSales)
    values.grossProfit = roundCurrency(values.netSales - values.itemCost)

    const topSellingItems = Array.from(itemTotals.entries())
      .map(([name, totals]) => ({
        name,
        revenue: roundCurrency(totals.revenue),
        quantity: Math.max(0, Math.round(totals.quantity)),
      }))
      .filter((item) => item.revenue > 0 && item.quantity > 0)
      .sort((left, right) => right.revenue - left.revenue)
      .slice(0, 5)

    const topSellingCategories = Array.from(categoryTotals.entries())
      .map(([name, revenue]) => ({ name, revenue: roundCurrency(revenue) }))
      .filter((category) => category.revenue > 0)
      .sort((left, right) => right.revenue - left.revenue)
      .slice(0, 5)

    const costRatioBase = overview?.sales.grossSales ?? 0
    const estimatedCostRate =
      costRatioBase > 0 ? (overview?.sales.itemCost ?? 0) / costRatioBase : 0
    const visibleDayKeys = listTrailingDayKeys(appliedRange.endDate, 7)

    const costRevenueData = visibleDayKeys.map((dayKey) => {
      const revenue = roundCurrency(Math.max(dailyRevenue.get(dayKey) ?? 0, 0))
      const cost = roundCurrency(revenue * estimatedCostRate)

      return {
        label: formatShortDateLabel(dayKey),
        revenue,
        cost,
      }
    })

    const paymentSourceData = Array.from(paymentTotals.entries())
      .map(([name, amount]) => ({
        name,
        amount: roundCurrency(Math.max(amount, 0)),
      }))
      .filter((entry) => entry.amount > 0)
      .sort((left, right) => right.amount - left.amount)

    const seriesByMetric: Record<string, ReportPoint[]> = {
      'Txn Count': buildSeriesFromBuckets(hourlyBuckets, 'txnCount', true),
      'Gross Sale': buildSeriesFromBuckets(hourlyBuckets, 'grossSales'),
      'Included Tax': buildSeriesFromBuckets(hourlyBuckets, 'includedTax'),
      'Added Tax': buildSeriesFromBuckets(hourlyBuckets, 'addedTax'),
      'Service Fee': buildSeriesFromBuckets(hourlyBuckets, 'serviceFee'),
      'Dining Option Fee': buildSeriesFromBuckets(hourlyBuckets, 'diningOptionFee'),
      'Discount': buildSeriesFromBuckets(hourlyBuckets, 'discount'),
      'Refund': buildSeriesFromBuckets(hourlyBuckets, 'refund'),
      'Net Sales': buildSeriesFromBuckets(hourlyBuckets, 'netSales'),
      'Pay In': buildSeriesFromBuckets(hourlyBuckets, 'payIn'),
      'Pay Out': buildSeriesFromBuckets(hourlyBuckets, 'payOut'),
      'Item Cost': buildSeriesFromBuckets(hourlyBuckets, 'itemCost'),
      'Gross Profit': buildSeriesFromBuckets(hourlyBuckets, 'grossProfit'),
      'Redeemed Points': buildSeriesFromBuckets(hourlyBuckets, 'redeemedPoints', true),
    }

    return {
      metricValues: values,
      seriesByMetric,
      topSellingItems,
      topSellingCategories,
      costRevenueData,
      paymentSourceData,
    }
  }, [appliedRange.endDate, filteredReceipts, itemCategoryLookup, overview?.sales.grossSales, overview?.sales.itemCost])

  const metrics = [
    {
      label: 'Txn Count',
      value: wholeNumberFormatter.format(metricValues.txnCount),
      hint: 'Processed receipts in the selected time window',
      format: 'integer' as const,
    },
    {
      label: 'Gross Sale',
      value: formatCurrency(metricValues.grossSales),
      hint: 'Inclusive sales before discounts and refunds',
      format: 'currency' as const,
    },
    {
      label: 'Included Tax',
      value: formatCurrency(metricValues.includedTax),
      hint: 'Tax already embedded in selling prices',
      format: 'currency' as const,
    },
    {
      label: 'Added Tax',
      value: formatCurrency(metricValues.addedTax),
      hint: 'Extra tax charged on top of line items',
      format: 'currency' as const,
    },
    {
      label: 'Service Fee',
      value: formatCurrency(metricValues.serviceFee),
      hint: 'Service charges captured in the period',
      format: 'currency' as const,
    },
    {
      label: 'Dining Option Fee',
      value: formatCurrency(metricValues.diningOptionFee),
      hint: 'Dining-mode surcharge recorded separately',
      format: 'currency' as const,
    },
    {
      label: 'Discount',
      value: formatCurrency(metricValues.discount),
      hint: 'Applied discounts across all selected receipts',
      format: 'currency' as const,
    },
    {
      label: 'Refund',
      value: formatCurrency(metricValues.refund),
      hint: 'Refunded or returned receipts in the range',
      format: 'currency' as const,
    },
    {
      label: 'Net Sales',
      value: formatCurrency(metricValues.netSales),
      hint: 'Sales after refunds and discounts',
      format: 'currency' as const,
    },
    {
      label: 'Pay In',
      value: formatCurrency(metricValues.payIn),
      hint: 'Drawer cash additions during the shift',
      format: 'currency' as const,
    },
    {
      label: 'Pay Out',
      value: formatCurrency(metricValues.payOut),
      hint: 'Drawer cash removals during the shift',
      format: 'currency' as const,
    },
    {
      label: 'Item Cost',
      value: formatCurrency(metricValues.itemCost),
      hint: 'Inventory cost feed not yet included in the transaction payload',
      format: 'currency' as const,
    },
    {
      label: 'Gross Profit',
      value: formatCurrency(metricValues.grossProfit),
      hint: 'Computed as net sales minus current item cost value',
      format: 'currency' as const,
    },
    {
      label: 'Redeemed Points',
      value: formatPoints(metricValues.redeemedPoints),
      hint: 'Loyalty points used by customers',
      format: 'points' as const,
    },
  ]
  const visibleBirReadings = useMemo(() => {
    const scopedRows =
      selectedBranch === 'all'
        ? birReadings
        : birReadings.filter((reading) => reading.branchId === selectedBranch)

    return [...scopedRows].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
  }, [birReadings, selectedBranch])

  const recentBirReadings = visibleBirReadings.slice(0, 6)

  const terminalReadingSummary = useMemo(() => {
    const summary = new Map<
      string,
      {
        lastX?: string
        lastZ?: string
        lastOrRange?: string
      }
    >()

    for (const reading of visibleBirReadings) {
      const current = summary.get(reading.terminalId) ?? {}

      if (reading.readingType === 'X' && !current.lastX) {
        current.lastX = reading.readingNumber
      }

      if (reading.readingType === 'Z' && !current.lastZ) {
        current.lastZ = reading.readingNumber
      }

      if (!current.lastOrRange) {
        current.lastOrRange = `${reading.beginningOr}-${reading.endingOr}`
      }

      summary.set(reading.terminalId, current)
    }

    return summary
  }, [visibleBirReadings])

  const xReadingCount = visibleBirReadings.filter(
    (reading) => reading.readingType === 'X',
  ).length
  const zReadingCount = visibleBirReadings.filter(
    (reading) => reading.readingType === 'Z',
  ).length

  function handleGenerateReading(
    terminal: NonNullable<typeof overview>['terminals'][number],
    readingType: 'X' | 'Z',
  ) {
    const nextReading = createBirTerminalReading(
      {
        id: terminal.id,
        branchId: terminal.branchId,
        name: terminal.name,
        serialNumber: terminal.serialNumber,
        cashierName: terminal.cashierName,
      },
      readingType,
      birReadings,
    )

    addBirReading(nextReading)
    setBirNotice(
      `${nextReading.readingNumber} generated for ${terminal.name} (${terminal.serialNumber}).`,
    )
  }

  const avgTicket = metricValues.txnCount > 0
    ? roundCurrency(metricValues.grossSales / metricValues.txnCount)
    : 0

  const recentTxns = filteredReceipts.slice(0, 5)

  return (
    <div className="space-y-6">
      {receiptsQuery.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Live transaction sync is unavailable. Dashboard totals are using the last successful data pull.
        </div>
      ) : null}
      {overviewQuery.isError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Terminal status feed is unavailable right now. Realtime branch and terminal cards may be incomplete.
        </div>
      ) : null}

      {/* KPI Hero Cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Gross Sales"
          value={formatCurrency(metricValues.grossSales)}
          subtitle={`${wholeNumberFormatter.format(metricValues.txnCount)} transactions`}
          icon={BadgeDollarSign}
          gradient="from-[#52d4cc] to-[#28a89a]"
          trend={metricValues.grossSales > 0 ? 'up' : 'neutral'}
          trendLabel={metricValues.grossSales > 0 ? 'Revenue recorded' : 'No sales yet'}
        />
        <KpiCard
          label="Net Sales"
          value={formatCurrency(metricValues.netSales)}
          subtitle={`After ${formatCurrency(metricValues.refund)} refunds`}
          icon={Wallet}
          gradient="from-[#ff9b6a] to-[#f06040]"
          trend={metricValues.netSales > metricValues.grossSales * 0.9 ? 'up' : 'down'}
          trendLabel={
            metricValues.grossSales > 0
              ? `${((metricValues.netSales / metricValues.grossSales) * 100).toFixed(1)}% retention`
              : 'No data'
          }
        />
        <KpiCard
          label="Avg. Ticket"
          value={formatCurrency(avgTicket)}
          subtitle="Per transaction"
          icon={ShoppingCart}
          gradient="from-[#9b8fd8] to-[#7066be]"
        />
        <KpiCard
          label="Active Terminals"
          value={String(overview?.terminals?.filter((t) => t.status === 'ONLINE').length ?? 0)}
          subtitle={`${overview?.terminals?.length ?? 0} total registered`}
          icon={Monitor}
          gradient="from-[#6ba8e8] to-[#4b7fd8]"
        />
      </section>

      <section className="motion-enter">
        <FinanceMonitorPanel
          metrics={metrics}
          seriesByMetric={seriesByMetric}
          initialActiveMetric="Txn Count"
        />
      </section>

      {/* Analytics Charts */}
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Top Selling Items"
          description="Best-performing products ranked by revenue for the current period."
        >
          <div className="h-[280px]">
            <Suspense fallback={<ChartFallback />}>
              <TopSellingItemsChart data={topSellingItems} />
            </Suspense>
          </div>
        </SectionCard>

        <SectionCard
          title="Top Selling Categories"
          description="Revenue share across product categories."
        >
          <div className="flex h-[280px] items-center justify-center">
            <Suspense fallback={<ChartFallback />}>
              <TopSellingCategoriesChart data={topSellingCategories} />
            </Suspense>
          </div>
        </SectionCard>

        <SectionCard
          title="Cost vs Revenue"
          description="Seven-day revenue trend with estimated item-cost overlay."
        >
          <div className="h-[280px]">
            <Suspense fallback={<ChartFallback />}>
              <CostRevenueChart data={costRevenueData} />
            </Suspense>
          </div>
        </SectionCard>

        <SectionCard
          title="Payment Source"
          description="Distribution of sales by payment method."
        >
          <div className="flex h-[280px] items-center justify-center">
            <Suspense fallback={<ChartFallback />}>
              <PaymentSourceChart data={paymentSourceData} />
            </Suspense>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Terminal watch"
          description="Realtime connections, cashiers, and the last heartbeat captured by the dashboard."
          action={
            <div className="rounded-full bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--muted)]">
              {overview?.terminals?.length ?? 0} active terminals
            </div>
          }
        >
          <div className="space-y-3">
            {overview?.terminals?.map((terminal) => (
              <article
                key={terminal.id}
                className="motion-card rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4"
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

        <SectionCard
          title="Branch scoreboard"
          description="Daily gross by branch with open-shift visibility for quick balancing."
        >
          <div className="stagger-grid grid gap-4">
            {overview?.branches?.map((branch) => (
              <article key={branch.id} className="motion-card rounded-3xl bg-[color:var(--surface-soft)] p-5">
                <p className="section-title text-xl font-bold">{branch.name}</p>
                <p className="mt-4 text-3xl font-bold">
                  {formatCurrency(branch.grossSalesToday)}
                </p>
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

      {/* Recent Transactions */}
      <SectionCard
        title="Recent Transactions"
        description="Latest receipts processed across terminals."
        action={
          <span className="rounded-full bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--muted)]">
            {wholeNumberFormatter.format(filteredReceipts.length)} total
          </span>
        }
      >
        {recentTxns.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-6 text-center text-sm text-[color:var(--muted)]">
            No transactions in the selected period.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[color:var(--border)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[color:var(--border)] bg-[rgba(229,181,135,0.12)]">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">Receipt</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">Cashier</th>
                  <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)] sm:table-cell">Payment</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border)]">
                {recentTxns.map((r) => {
                  const orYear = new Date(r.createdAt).getFullYear()
                  const orNum = `OR-${orYear}-${String(r.orNumber).padStart(6, '0')}`
                  return (
                    <tr key={r.id} className="bg-[color:var(--surface-soft)] transition hover:bg-[rgba(229,181,135,0.08)]">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[color:var(--ink)]">{orNum}</p>
                        <p className="text-xs text-[color:var(--muted)]">{formatDateTime(r.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">
                        {normalizeCashierName(r.cashierName, managedUsers)}
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--header-tint)]/80 px-2.5 py-1 text-xs font-medium text-slate-700">
                          <CreditCard className="h-3 w-3" />
                          {r.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill
                          tone={
                            r.status === 'COMPLETED'
                              ? 'success'
                              : r.status === 'VOID'
                                ? 'danger'
                                : r.status === 'HELD'
                                  ? 'neutral'
                                  : 'warning'
                          }
                          label={r.status}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="section-title text-base font-bold text-[color:var(--accent)]">
                          {formatCurrency(r.total)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="BIR X and Z Readings"
        description="Generate terminal readings from the dashboard and keep the latest OR span visible for cashier balancing and BIR review."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--muted)]">
              {xReadingCount} X readings
            </div>
            <div className="rounded-full bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--muted)]">
              {zReadingCount} Z readings
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {birNotice ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {birNotice}
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-3">
              {overview?.terminals?.map((terminal) => {
                const readingSummary = terminalReadingSummary.get(terminal.id)

                return (
                  <article
                    key={terminal.id}
                    className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <p className="font-semibold text-slate-950">{terminal.name}</p>
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
                        <p className="mt-1 text-sm text-[color:var(--muted)]">
                          {terminal.serialNumber} · {terminal.cashierName}
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl bg-[color:var(--surface-soft)] px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                              Last X
                            </p>
                            <p className="mt-2 font-semibold text-slate-950">
                              {readingSummary?.lastX ?? 'No X yet'}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-[color:var(--surface-soft)] px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                              Last Z
                            </p>
                            <p className="mt-2 font-semibold text-slate-950">
                              {readingSummary?.lastZ ?? 'No Z yet'}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-[color:var(--surface-soft)] px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                              Last OR Range
                            </p>
                            <p className="mt-2 font-semibold text-slate-950">
                              {readingSummary?.lastOrRange ?? 'No OR range'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:min-w-[220px]">
                        <button
                          type="button"
                          onClick={() => handleGenerateReading(terminal, 'X')}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm font-medium text-slate-800 transition hover:bg-[color:var(--surface-soft)]"
                        >
                          <Receipt className="h-4 w-4" />
                          Generate X Reading
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGenerateReading(terminal, 'Z')}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                        >
                          <Landmark className="h-4 w-4" />
                          Generate Z Reading
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            <div className="space-y-3">
              {recentBirReadings.map((reading) => (
                <article
                  key={reading.id}
                  className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{reading.readingNumber}</p>
                      <p className="text-sm text-[color:var(--muted)]">
                        {reading.terminalName} · {reading.serialNumber}
                      </p>
                    </div>
                    <StatusPill
                      tone={reading.readingType === 'Z' ? 'success' : 'warning'}
                      label={`${reading.readingType} Reading`}
                    />
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-[color:var(--muted)]">
                    <p>OR range: {reading.beginningOr}-{reading.endingOr}</p>
                    <p>Gross sales: {formatCurrency(reading.grossSales)}</p>
                    <p>VAT amount: {formatCurrency(reading.vatAmount)}</p>
                    <p>Discount total: {formatCurrency(reading.discountTotal)}</p>
                    <p>Generated: {formatDateTime(reading.createdAt)}</p>
                  </div>
                </article>
              ))}

              {recentBirReadings.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-6 text-sm text-[color:var(--muted)]">
                  No X or Z readings are available for the current branch filter yet.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Sync Posture */}
      <SyncPostureCard overview={overview} wsConnected={wsConnected} />
    </div>
  )
}
