import type { CatalogItem, InventorySummary } from '@apex-pos/shared-types'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  AlertTriangle,
  ArrowRightLeft,
  Boxes,
  Building2,
  Download,
  FileSpreadsheet,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Truck,
  Upload,
  X,
} from 'lucide-react'
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DataTable } from '../components/ui/data-table'
import { PageHeader } from '../components/ui/page-header'
import { SectionCard } from '../components/ui/section-card'
import { StatusPill } from '../components/ui/status-pill'
import { useCatalog } from '../hooks/use-catalog'
import { useInventory } from '../hooks/use-inventory'
import {
  createInventoryAdjustment,
  importInventoryStocks,
  type InventoryAdjustmentAction,
} from '../lib/api-client'
import { formatCurrency } from '../lib/utils'
import {
  buildInventoryStockViewRows,
  parseInventoryStockSheetCsv,
  serializeInventoryStockSheetCsv,
  type InventoryStockViewRow,
} from './inventory-stock-sheet'
import { useUiStore } from '../store/ui-store'

const warehouseProfiles: InventoryWarehouseRecord[] = []

const inventoryBranchOptions: { id: string; name: string }[] = []

const transferQueue: { route: string; reference: string; status: string; note: string }[] = []

const csvImportJobs: { fileName: string; status: string; summary: string }[] = []

const supplierProfiles: InventorySupplierRecord[] = []

const purchaseOrders: InventoryPurchaseOrderRecord[] = []
const INVENTORY_STOCK_PAGE_SIZE = 10

function buildInventoryColumns(
  onAdjust: (row: InventoryStockViewRow) => void,
): Array<ColumnDef<InventoryStockViewRow>> {
  return [
  {
    accessorKey: 'itemName',
    header: 'Item',
    cell: ({ row }) => (
      <div>
        <p className="font-semibold text-[color:var(--ink)]">{row.original.itemName}</p>
        <p className="text-xs text-[color:var(--muted)]">
          {row.original.categoryName || 'Uncategorized'}
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'warehouseName',
    header: 'Warehouse',
    cell: ({ row }) => (
      <div>
        <p className="font-medium text-[color:var(--ink)]">{row.original.warehouseName}</p>
        <p className="text-xs text-[color:var(--muted)]">{row.original.branchId}</p>
      </div>
    ),
  },
  {
    accessorKey: 'quantityOnHand',
    header: 'On hand',
    cell: ({ row }) => (
      <span className="font-semibold text-[color:var(--ink)]">
        {row.original.quantityOnHand}
      </span>
    ),
  },
  {
    accessorKey: 'reorderPoint',
    header: 'Reorder point',
    cell: ({ row }) => (
      <span className="text-[color:var(--muted)]">{row.original.reorderPoint}</span>
    ),
  },
  {
    id: 'buffer',
    header: 'Buffer',
    cell: ({ row }) => {
      const buffer = row.original.quantityOnHand - row.original.reorderPoint
      const toneClassName =
        buffer > 0
          ? 'text-emerald-700'
          : buffer === 0
            ? 'text-amber-700'
            : 'text-rose-700'

      return <span className={`font-semibold ${toneClassName}`}>{buffer}</span>
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <StatusPill tone={inventoryStockTone(row.original.status)} label={row.original.status} />
    ),
  },
  {
    id: 'actions',
    header: 'Action',
    cell: ({ row }) => (
      <button
        type="button"
        onClick={() => onAdjust(row.original)}
        className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-3 py-2 text-sm font-medium text-[color:var(--ink)] transition hover:bg-[color:var(--surface-soft)]"
      >
        <Pencil className="h-4 w-4" />
        Adjust
      </button>
    ),
  },
]
}

function InventoryShell({
  eyebrow,
  title,
  description,
  children,
}: React.PropsWithChildren<{
  eyebrow: string
  title: string
  description: string
}>) {
  return (
    <div className="readable-white-route space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      {children}
    </div>
  )
}

function InventoryBadge({ value }: { value: string }) {
  return (
    <div className="rounded-full bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--muted)]">
      {value}
    </div>
  )
}

function inventoryStockTone(
  status: InventorySummary['status'],
): 'success' | 'warning' | 'danger' {
  if (status === 'HEALTHY') {
    return 'success'
  }

  if (status === 'LOW') {
    return 'warning'
  }

  return 'danger'
}

function inventoryStockSeverity(status: InventorySummary['status']) {
  if (status === 'OUT') {
    return 2
  }

  if (status === 'LOW') {
    return 1
  }

  return 0
}

function InventoryMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  toneClassName,
}: {
  label: string
  value: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
  toneClassName: string
}) {
  return (
    <article className="rounded-[28px] border border-[color:var(--border)] bg-[color:rgba(255,255,255,0.92)] p-5 shadow-[0_12px_28px_rgba(12,30,54,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[color:var(--muted)]">{label}</p>
          <p className="mt-3 section-title text-[2rem] font-bold tracking-[-0.03em] text-[color:var(--ink)]">
            {value}
          </p>
        </div>
        <div
          className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${toneClassName}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm text-[color:var(--muted)]">{hint}</p>
    </article>
  )
}

type InventoryNotice = {
  tone: 'success' | 'error' | 'info'
  message: string
}

type InventoryWarehouseRecord = {
  id: string
  branchId: string
  branch: string
  name: string
  role: string
  status: 'ACTIVE' | 'DEFAULT'
  isPullout: boolean
}

type InventoryWarehouseForm = {
  branchId: string
  name: string
  role: string
  isDefault: boolean
  isPullout: boolean
}

type InventoryWarehouseState = {
  warehouses: InventoryWarehouseRecord[]
  ensureWarehouses: (rows: InventoryWarehouseRecord[]) => void
  updateWarehouses: (
    updater: (rows: InventoryWarehouseRecord[]) => InventoryWarehouseRecord[],
  ) => void
}

type InventorySupplierRecord = {
  id: string
  branchId: string
  name: string
  contactName: string
  phone: string
  email: string
  address: string
  focus: string
  leadTime: string
  notes: string
  active: boolean
}

type InventorySupplierForm = {
  branchId: string
  name: string
  contactName: string
  phone: string
  email: string
  address: string
  focus: string
  leadTime: string
  notes: string
  active: boolean
}

type InventorySupplierState = {
  suppliers: InventorySupplierRecord[]
  ensureSuppliers: (rows: InventorySupplierRecord[]) => void
  updateSuppliers: (
    updater: (rows: InventorySupplierRecord[]) => InventorySupplierRecord[],
  ) => void
}

type InventoryPurchaseOrderItemRecord = {
  id: string
  itemName: string
  stock: number
  quantity: number
  cost: number
  total: number
}

type InventoryPurchaseOrderRecord = {
  id: string
  code: string
  branchId: string
  supplier: string
  warehouseName: string
  orderDate: string
  expectedDate: string
  total: number
  status: 'OPEN' | 'PARTIAL' | 'RECEIVED'
  note: string
  items: InventoryPurchaseOrderItemRecord[]
}

type InventoryPurchaseOrderItemForm = {
  id: string
  itemName: string
  quantity: string
  cost: string
}

type InventoryPurchaseOrderForm = {
  supplierId: string
  warehouseId: string
  orderDate: string
  expectedDate: string
  note: string
  items: InventoryPurchaseOrderItemForm[]
}

type InventoryPurchaseOrderState = {
  purchaseOrders: InventoryPurchaseOrderRecord[]
  ensurePurchaseOrders: (rows: InventoryPurchaseOrderRecord[]) => void
  updatePurchaseOrders: (
    updater: (rows: InventoryPurchaseOrderRecord[]) => InventoryPurchaseOrderRecord[],
  ) => void
}

type InventoryStockAdjustmentForm = {
  branchId: string
  itemId?: string
  itemName: string
  warehouseName: string
  action: InventoryAdjustmentAction
  quantity: string
  reorderPoint: string
  reason: string
}

type InventoryStockAdjustmentDialogState = {
  rowId?: string
  currentQuantity: number
  form: InventoryStockAdjustmentForm
}

function InventoryNoticeBanner({ notice }: { notice: InventoryNotice }) {
  const toneClassName =
    notice.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : notice.tone === 'error'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-sky-200 bg-sky-50 text-sky-700'

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${toneClassName}`}>
      {notice.message}
    </div>
  )
}

function InventoryModalFrame({
  title,
  description,
  onClose,
  children,
}: React.PropsWithChildren<{
  title: string
  description: string
  onClose: () => void
}>) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-2xl rounded-[28px] border border-[color:var(--border)] bg-[color:var(--panel-strong)] shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border)] px-5 py-4 sm:px-6">
          <div>
            <h2 className="section-title text-2xl font-bold text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border)] text-[color:var(--muted)] transition hover:bg-[color:var(--surface-soft)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  )
}

function createInventoryStockAdjustmentForm(
  branchId: string,
  seed?: Partial<InventoryStockAdjustmentForm>,
): InventoryStockAdjustmentForm {
  return {
    branchId,
    itemId: seed?.itemId,
    itemName: seed?.itemName ?? '',
    warehouseName: seed?.warehouseName ?? '',
    action: seed?.action ?? 'STOCK_IN',
    quantity: seed?.quantity ?? '',
    reorderPoint: seed?.reorderPoint ?? '10',
    reason: seed?.reason ?? '',
  }
}

function findCatalogItemMatch(
  items: CatalogItem[],
  branchId: string,
  itemName: string,
) {
  const normalizedItemName = itemName.trim().toLowerCase()
  if (!normalizedItemName) {
    return null
  }

  return (
    items.find(
      (item) =>
        item.branchId === branchId
        && item.name.trim().toLowerCase() === normalizedItemName,
    ) ?? null
  )
}

function buildInventoryStockRowKey(
  branchId: string,
  itemName: string,
  warehouseName: string,
) {
  return [
    branchId.trim().toLowerCase(),
    warehouseName.trim().toLowerCase(),
    itemName.trim().toLowerCase(),
  ].join('::')
}

function InventoryStockMobileList({
  rows,
  onAdjust,
}: {
  rows: InventoryStockViewRow[]
  onAdjust: (row: InventoryStockViewRow) => void
}) {
  return (
    <div className="grid gap-3 lg:hidden">
      {rows.map((row) => (
        <article
          key={row.id}
          className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-[color:var(--ink)]">
                {row.itemName}
              </p>
              <p className="truncate text-sm text-[color:var(--muted)]">
                {row.categoryName || 'Uncategorized'}
              </p>
            </div>
            <StatusPill tone={inventoryStockTone(row.status)} label={row.status} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-[color:var(--surface-soft)] px-3 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
                On hand
              </p>
              <p className="mt-1 font-semibold text-[color:var(--ink)]">
                {row.quantityOnHand}
              </p>
            </div>
            <div className="rounded-2xl bg-[color:var(--surface-soft)] px-3 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
                Reorder
              </p>
              <p className="mt-1 font-semibold text-[color:var(--ink)]">
                {row.reorderPoint}
              </p>
            </div>
            <div className="col-span-2 rounded-2xl bg-[color:var(--surface-soft)] px-3 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
                Warehouse
              </p>
              <p className="mt-1 truncate font-medium text-[color:var(--ink)]">
                {row.warehouseName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onAdjust(row)}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm font-medium text-[color:var(--ink)] transition hover:bg-[color:var(--surface-soft)]"
          >
            <Pencil className="h-4 w-4" />
            Adjust Stock
          </button>
        </article>
      ))}
    </div>
  )
}

function InventoryPaginationBar({
  page,
  pageCount,
  rangeStart,
  rangeEnd,
  total,
  onPrevious,
  onNext,
}: {
  page: number
  pageCount: number
  rangeStart: number
  rangeEnd: number
  total: number
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[color:var(--muted)]">
        Showing <span className="font-semibold text-[color:var(--ink)]">{rangeStart}-{rangeEnd}</span> of{' '}
        <span className="font-semibold text-[color:var(--ink)]">{total}</span> item rows
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={page <= 1}
          className="inline-flex h-10 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm font-medium text-[color:var(--ink)] transition hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Previous
        </button>
        <div className="rounded-2xl bg-[color:var(--surface-soft)] px-4 py-2 text-sm font-medium text-[color:var(--ink)]">
          Page {page} of {pageCount}
        </div>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= pageCount}
          className="inline-flex h-10 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm font-medium text-[color:var(--ink)] transition hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Next
        </button>
      </div>
    </div>
  )
}

function InventoryStockAdjustmentModal({
  state,
  busy,
  itemSuggestions,
  warehouseSuggestions,
  onClose,
  onChange,
  onSubmit,
}: {
  state: InventoryStockAdjustmentDialogState
  busy: boolean
  itemSuggestions: Array<{ id?: string; name: string }>
  warehouseSuggestions: string[]
  onClose: () => void
  onChange: (updater: (form: InventoryStockAdjustmentForm) => InventoryStockAdjustmentForm) => void
  onSubmit: () => void
}) {
  const normalizedQuantity = Number(state.form.quantity)
  const safeQuantity = Number.isFinite(normalizedQuantity) ? normalizedQuantity : 0
  const projectedQuantity =
    state.form.action === 'SET_BALANCE'
      ? safeQuantity
      : state.currentQuantity + safeQuantity

  return (
    <InventoryModalFrame
      title={state.rowId ? 'Adjust Stock' : 'Add Stock'}
      description="Record stock in or set a corrected on-hand balance for the selected branch."
      onClose={onClose}
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-[color:var(--surface-soft)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">Branch</p>
            <p className="mt-2 font-semibold text-[color:var(--ink)]">{state.form.branchId}</p>
          </div>
          <div className="rounded-2xl bg-[color:var(--surface-soft)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
              Current on hand
            </p>
            <p className="mt-2 font-semibold text-[color:var(--ink)]">{state.currentQuantity}</p>
          </div>
          <div className="rounded-2xl bg-[color:var(--surface-soft)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
              Projected on hand
            </p>
            <p className="mt-2 font-semibold text-[color:var(--accent)]">{projectedQuantity}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-[color:var(--ink)]">Item</span>
            <input
              value={state.form.itemName}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  itemName: event.target.value,
                }))}
              list="inventory-stock-item-options"
              placeholder="Search or type an item name"
              className="h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/10"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-[color:var(--ink)]">Warehouse</span>
            <input
              value={state.form.warehouseName}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  warehouseName: event.target.value,
                }))}
              list="inventory-stock-warehouse-options"
              placeholder="Main Stockroom"
              className="h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/10"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-medium text-[color:var(--ink)]">Action</span>
            <select
              value={state.form.action}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  action: event.target.value as InventoryAdjustmentAction,
                }))}
              className="h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/10"
            >
              <option value="STOCK_IN">Stock In</option>
              <option value="SET_BALANCE">Set Balance</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-[color:var(--ink)]">
              {state.form.action === 'SET_BALANCE' ? 'New on hand' : 'Units to add'}
            </span>
            <input
              value={state.form.quantity}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  quantity: event.target.value,
                }))}
              inputMode="numeric"
              placeholder={state.form.action === 'SET_BALANCE' ? '0' : '12'}
              className="h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/10"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-[color:var(--ink)]">Reorder point</span>
            <input
              value={state.form.reorderPoint}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  reorderPoint: event.target.value,
                }))}
              inputMode="numeric"
              placeholder="10"
              className="h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/10"
            />
          </label>
        </div>

        <label className="space-y-2">
          <span className="text-sm font-medium text-[color:var(--ink)]">Reason</span>
          <textarea
            value={state.form.reason}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                reason: event.target.value,
              }))}
            placeholder="Receiving delivery, cycle count correction, branch restock, etc."
            rows={3}
            className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-3 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/10"
          />
        </label>

        <div className="flex items-center justify-end gap-3 border-t border-[color:var(--border)] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-5 text-sm font-medium text-[color:var(--ink)] transition hover:bg-[color:var(--surface-soft)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[color:var(--accent)] px-5 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Plus className="h-4 w-4" />
            {busy
              ? 'Saving...'
              : state.form.action === 'SET_BALANCE'
                ? 'Save Balance'
                : 'Add Stock'}
          </button>
        </div>
      </div>

      <datalist id="inventory-stock-item-options">
        {itemSuggestions.map((item) => (
          <option key={`${item.id ?? 'manual'}-${item.name}`} value={item.name} />
        ))}
      </datalist>

      <datalist id="inventory-stock-warehouse-options">
        {warehouseSuggestions.map((warehouse) => (
          <option key={warehouse} value={warehouse} />
        ))}
      </datalist>
    </InventoryModalFrame>
  )
}

function hasWarehouseSeed(rows: InventoryWarehouseRecord[]) {
  return rows.length > 0
}

function hasSupplierSeed(rows: InventorySupplierRecord[]) {
  return rows.length > 0
}

function hasPurchaseOrderSeed(rows: InventoryPurchaseOrderRecord[]) {
  return rows.length > 0
}

const useInventoryWarehouseStore = create<InventoryWarehouseState>()(
  persist(
    (set) => ({
      warehouses: [],
      ensureWarehouses: (rows) =>
        set((state) => {
          if (hasWarehouseSeed(state.warehouses)) {
            return state
          }

          return {
            warehouses: rows,
          }
        }),
      updateWarehouses: (updater) =>
        set((state) => ({
          warehouses: updater(state.warehouses),
        })),
    }),
    {
      name: 'bigtime-pos-inventory-warehouses-v2',
      partialize: (state) => ({
        warehouses: state.warehouses,
      }),
    },
  ),
)

const useInventorySupplierStore = create<InventorySupplierState>()(
  persist(
    (set) => ({
      suppliers: [],
      ensureSuppliers: (rows) =>
        set((state) => {
          if (hasSupplierSeed(state.suppliers)) {
            return state
          }

          return {
            suppliers: rows,
          }
        }),
      updateSuppliers: (updater) =>
        set((state) => ({
          suppliers: updater(state.suppliers),
        })),
    }),
    {
      name: 'bigtime-pos-inventory-suppliers-v2',
      partialize: (state) => ({
        suppliers: state.suppliers,
      }),
    },
  ),
)

const useInventoryPurchaseOrderStore = create<InventoryPurchaseOrderState>()(
  persist(
    (set) => ({
      purchaseOrders: [],
      ensurePurchaseOrders: (rows) =>
        set((state) => {
          if (hasPurchaseOrderSeed(state.purchaseOrders)) {
            return state
          }

          return {
            purchaseOrders: rows,
          }
        }),
      updatePurchaseOrders: (updater) =>
        set((state) => ({
          purchaseOrders: updater(state.purchaseOrders),
        })),
    }),
    {
      name: 'bigtime-pos-inventory-purchase-orders-v2',
      partialize: (state) => ({
        purchaseOrders: state.purchaseOrders,
      }),
    },
  ),
)

function resolveInventoryBranchName(branchId: string) {
  return (
    inventoryBranchOptions.find((branch) => branch.id === branchId)?.name ??
    branchId.replace('branch-', '').replace(/(^\w)|-(\w)/g, (match) => match.replace('-', ' ').toUpperCase())
  )
}

function emptyWarehouseForm(branchId: string): InventoryWarehouseForm {
  return {
    branchId:
      branchId !== 'all' ? branchId : inventoryBranchOptions[0]?.id ?? 'branch-manila',
    name: '',
    role: '',
    isDefault: false,
    isPullout: false,
  }
}

function emptySupplierForm(branchId: string): InventorySupplierForm {
  return {
    branchId:
      branchId !== 'all' ? branchId : inventoryBranchOptions[0]?.id ?? 'branch-manila',
    name: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    focus: '',
    leadTime: '',
    notes: '',
    active: true,
  }
}

function getTodayInputValue() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createPurchaseOrderItemForm(): InventoryPurchaseOrderItemForm {
  return {
    id: `po-item-${Date.now()}-${Math.floor(Math.random() * 100_000)}`,
    itemName: '',
    quantity: '0',
    cost: '0',
  }
}

function emptyPurchaseOrderForm(): InventoryPurchaseOrderForm {
  return {
    supplierId: '',
    warehouseId: '',
    orderDate: getTodayInputValue(),
    expectedDate: '',
    note: '',
    items: [createPurchaseOrderItemForm()],
  }
}

function createWarehouseId() {
  return `warehouse-${Date.now()}-${Math.floor(Math.random() * 100_000)}`
}

function createSupplierId() {
  return `supplier-${Date.now()}-${Math.floor(Math.random() * 100_000)}`
}

function createPurchaseOrderId() {
  return `purchase-order-${Date.now()}-${Math.floor(Math.random() * 100_000)}`
}

function createPurchaseOrderCode() {
  const date = new Date()
  const year = date.getFullYear()
  const suffix = String(Math.floor(Math.random() * 9000) + 1000)
  return `PO-${year}-${suffix}`
}

function inventoryTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ACTIVE' || status === 'DEFAULT' || status === 'COMPLETED' || status === 'READY' || status === 'RECEIVED') {
    return 'success'
  }

  if (status === 'REVIEW' || status === 'PARTIAL' || status === 'IN TRANSIT') {
    return 'warning'
  }

  if (status === 'PENDING APPROVAL') {
    return 'danger'
  }

  return 'neutral'
}

export function InventoryWarehousePage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch)
  const warehouses = useInventoryWarehouseStore((state) => state.warehouses)
  const ensureWarehouses = useInventoryWarehouseStore((state) => state.ensureWarehouses)
  const updateWarehouses = useInventoryWarehouseStore((state) => state.updateWarehouses)
  const [searchValue, setSearchValue] = useState('')
  const [notice, setNotice] = useState<InventoryNotice | null>(null)
  const [warehouseDialogMode, setWarehouseDialogMode] = useState<'add' | 'edit' | null>(null)
  const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(null)
  const [warehouseForm, setWarehouseForm] = useState<InventoryWarehouseForm>(
    emptyWarehouseForm(selectedBranch),
  )

  useEffect(() => {
    ensureWarehouses(warehouseProfiles)
  }, [ensureWarehouses])

  useEffect(() => {
    if (!notice) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setNotice(null)
    }, 3200)

    return () => window.clearTimeout(timeoutId)
  }, [notice])

  const visibleWarehouses = useMemo(() => {
    const branchScoped =
      selectedBranch === 'all'
        ? warehouses
        : warehouses.filter((warehouse) => warehouse.branchId === selectedBranch)
    const query = searchValue.trim().toLowerCase()

    if (!query) {
      return branchScoped
    }

    return branchScoped.filter((warehouse) =>
      [warehouse.name, warehouse.branch, warehouse.role, warehouse.isPullout ? 'pullout' : '']
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [searchValue, selectedBranch, warehouses])

  function openAddWarehouseDialog() {
    setEditingWarehouseId(null)
    setWarehouseForm(emptyWarehouseForm(selectedBranch))
    setWarehouseDialogMode('add')
  }

  function openEditWarehouseDialog(warehouse: InventoryWarehouseRecord) {
    setEditingWarehouseId(warehouse.id)
    setWarehouseForm({
      branchId: warehouse.branchId,
      name: warehouse.name,
      role: warehouse.role,
      isDefault: warehouse.status === 'DEFAULT',
      isPullout: warehouse.isPullout,
    })
    setWarehouseDialogMode('edit')
  }

  function closeWarehouseDialog() {
    setWarehouseDialogMode(null)
    setEditingWarehouseId(null)
  }

  function saveWarehouse() {
    const trimmedName = warehouseForm.name.trim()
    const trimmedRole = warehouseForm.role.trim()

    if (!trimmedName || !trimmedRole) {
      setNotice({
        tone: 'error',
        message: 'Warehouse name and role are required.',
      })
      return
    }

    const hasDuplicateName = warehouses.some(
      (warehouse) =>
        warehouse.id !== editingWarehouseId &&
        warehouse.branchId === warehouseForm.branchId &&
        warehouse.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    )

    if (hasDuplicateName) {
      setNotice({
        tone: 'error',
        message: 'A warehouse with the same name already exists for that branch.',
      })
      return
    }

    const nextWarehouse: InventoryWarehouseRecord = {
      id: editingWarehouseId ?? createWarehouseId(),
      branchId: warehouseForm.branchId,
      branch: resolveInventoryBranchName(warehouseForm.branchId),
      name: trimmedName,
      role: trimmedRole,
      status: warehouseForm.isDefault ? 'DEFAULT' : 'ACTIVE',
      isPullout: warehouseForm.isPullout,
    }

    updateWarehouses((current) => {
      const nextRows =
        warehouseDialogMode === 'edit'
          ? current.map((warehouse) =>
              warehouse.id === editingWarehouseId ? nextWarehouse : warehouse,
            )
          : [nextWarehouse, ...current]

      if (!warehouseForm.isDefault) {
        return nextRows
      }

      return nextRows.map((warehouse) =>
        warehouse.branchId === nextWarehouse.branchId && warehouse.id !== nextWarehouse.id
          ? { ...warehouse, status: 'ACTIVE' as const }
          : warehouse,
      )
    })

    setNotice({
      tone: 'success',
      message:
        warehouseDialogMode === 'edit'
          ? `Updated ${nextWarehouse.name}.`
          : `Added ${nextWarehouse.name} to warehouses.`,
    })
    closeWarehouseDialog()
  }

  function toggleWarehousePullout(warehouse: InventoryWarehouseRecord) {
    updateWarehouses((current) =>
      current.map((currentWarehouse) =>
        currentWarehouse.id === warehouse.id
          ? { ...currentWarehouse, isPullout: !currentWarehouse.isPullout }
          : currentWarehouse,
      ),
    )
    setNotice({
      tone: 'success',
      message: `${warehouse.name} was marked as ${warehouse.isPullout ? 'standard storage' : 'pullout warehouse'}.`,
    })
  }

  function deleteWarehouse(warehouse: InventoryWarehouseRecord) {
    const confirmed = window.confirm(`Delete ${warehouse.name}?`)

    if (!confirmed) {
      return
    }

    updateWarehouses((current) =>
      current.filter((currentWarehouse) => currentWarehouse.id !== warehouse.id),
    )
    setNotice({
      tone: 'success',
      message: `${warehouse.name} was removed from warehouses.`,
    })
  }

  return (
    <InventoryShell
      eyebrow="Inventory"
      title="Warehouse"
      description="Manage branch storage locations and define which warehouse acts as the default source for replenishment."
    >
      <SectionCard
        title="Warehouse list"
        description="Each warehouse anchors stock movement history and determines where on-hand balances are reported."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <InventoryBadge value={`${visibleWarehouses.length} warehouses`} />
            <button
              type="button"
              onClick={openAddWarehouseDialog}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm font-medium text-slate-800 transition hover:bg-[color:var(--surface-soft)]"
            >
              <Plus className="h-4 w-4" />
              Add Warehouse
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          {notice ? <InventoryNoticeBanner notice={notice} /> : null}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search warehouse, branch, role, pullout"
                className="h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
              />
            </label>
            <button
              type="button"
              onClick={openAddWarehouseDialog}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              New Warehouse
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleWarehouses.map((warehouse) => (
              <article key={warehouse.id} className="rounded-3xl bg-[color:var(--surface-soft)] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-[color:var(--accent)]" />
                    <div>
                      <p className="section-title text-xl font-bold">{warehouse.name}</p>
                      <p className="text-sm text-[color:var(--muted)]">{warehouse.branch}</p>
                    </div>
                  </div>
                  <StatusPill tone={inventoryTone(warehouse.status)} label={warehouse.status} />
                </div>
                <p className="mt-4 text-sm text-[color:var(--muted)]">{warehouse.role}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {warehouse.isPullout ? (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                      Pullout
                    </span>
                  ) : (
                    <span className="rounded-full bg-[color:var(--header-tint)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                      Standard
                    </span>
                  )}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEditWarehouseDialog(warehouse)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--border)] px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleWarehousePullout(warehouse)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--border)] px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
                  >
                    {warehouse.isPullout ? 'Unset Pullout' : 'Set Pullout'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteWarehouse(warehouse)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>

          {visibleWarehouses.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-6 text-sm text-[color:var(--muted)]">
              No warehouses match the current filter.
            </div>
          ) : null}
        </div>
      </SectionCard>

      {warehouseDialogMode ? (
        <InventoryModalFrame
          title={warehouseDialogMode === 'add' ? 'Add Warehouse' : 'Edit Warehouse'}
          description="Create or update a warehouse, choose its branch, and mark it as a pullout location when needed."
          onClose={closeWarehouseDialog}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Branch</span>
              <select
                value={warehouseForm.branchId}
                onChange={(event) =>
                  setWarehouseForm((current) => ({ ...current, branchId: event.target.value }))
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
              >
                {inventoryBranchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Warehouse name</span>
              <input
                value={warehouseForm.name}
                onChange={(event) =>
                  setWarehouseForm((current) => ({ ...current, name: event.target.value }))
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                placeholder="Backroom Pullout"
              />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Warehouse role</span>
              <input
                value={warehouseForm.role}
                onChange={(event) =>
                  setWarehouseForm((current) => ({ ...current, role: event.target.value }))
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                placeholder="Damaged goods isolation and pullout staging"
              />
            </label>
            <label className="sm:col-span-2 flex items-center gap-3 rounded-2xl border border-[color:var(--border)] px-4 py-3">
              <input
                type="checkbox"
                checked={warehouseForm.isDefault}
                onChange={(event) =>
                  setWarehouseForm((current) => ({
                    ...current,
                    isDefault: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">Default replenishment warehouse</p>
                <p className="text-xs text-[color:var(--muted)]">
                  Only one warehouse per branch should be marked as the default source.
                </p>
              </div>
            </label>
            <label className="sm:col-span-2 flex items-center gap-3 rounded-2xl border border-[color:var(--border)] px-4 py-3">
              <input
                type="checkbox"
                checked={warehouseForm.isPullout}
                onChange={(event) =>
                  setWarehouseForm((current) => ({
                    ...current,
                    isPullout: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">Use as pullout warehouse</p>
                <p className="text-xs text-[color:var(--muted)]">
                  Mark this location for damaged, returned, or pullout inventory handling.
                </p>
              </div>
            </label>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeWarehouseDialog}
              className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveWarehouse}
              className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              {warehouseDialogMode === 'add' ? 'Add Warehouse' : 'Save Changes'}
            </button>
          </div>
        </InventoryModalFrame>
      ) : null}
    </InventoryShell>
  )
}

export function InventoryItemStocksPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch)
  const queryClient = useQueryClient()
  const inventoryQuery = useInventory(selectedBranch)
  const catalogQuery = useCatalog(selectedBranch)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [searchValue, setSearchValue] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | InventorySummary['status']>('ALL')
  const [notice, setNotice] = useState<InventoryNotice | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [stockPage, setStockPage] = useState(1)
  const [stockDialogState, setStockDialogState] =
    useState<InventoryStockAdjustmentDialogState | null>(null)
  const deferredSearch = useDeferredValue(searchValue.trim().toLowerCase())

  const storedInventoryRows = useMemo(() => inventoryQuery.data ?? [], [inventoryQuery.data])
  const catalogItems = useMemo(() => catalogQuery.data?.items ?? [], [catalogQuery.data])
  const catalogCategories = useMemo(
    () => catalogQuery.data?.categories ?? [],
    [catalogQuery.data],
  )
  const inventoryRows = useMemo(
    () =>
      buildInventoryStockViewRows({
        catalogItems,
        categories: catalogCategories,
        inventoryRows: storedInventoryRows,
      }),
    [catalogCategories, catalogItems, storedInventoryRows],
  )
  const catalogSeedCount = useMemo(
    () => inventoryRows.filter((row) => row.isCatalogSeed).length,
    [inventoryRows],
  )
  const visibleStocks = useMemo(() => {
    return inventoryRows.filter((row) => {
      const matchesStatus = statusFilter === 'ALL' || row.status === statusFilter
      const matchesSearch = !deferredSearch
        || [row.itemName, row.categoryName, row.warehouseName, row.branchId]
          .join(' ')
          .toLowerCase()
          .includes(deferredSearch)

      return matchesStatus && matchesSearch
    })
  }, [deferredSearch, inventoryRows, statusFilter])
  const stockPageCount = useMemo(
    () => Math.max(1, Math.ceil(visibleStocks.length / INVENTORY_STOCK_PAGE_SIZE)),
    [visibleStocks.length],
  )
  const pagedStocks = useMemo(() => {
    const pageIndex = Math.min(stockPage, stockPageCount) - 1
    const startIndex = pageIndex * INVENTORY_STOCK_PAGE_SIZE
    return visibleStocks.slice(startIndex, startIndex + INVENTORY_STOCK_PAGE_SIZE)
  }, [stockPage, stockPageCount, visibleStocks])
  const stockPageRange = useMemo(() => {
    if (visibleStocks.length === 0) {
      return { start: 0, end: 0 }
    }

    const start = (Math.min(stockPage, stockPageCount) - 1) * INVENTORY_STOCK_PAGE_SIZE + 1
    const end = Math.min(start + INVENTORY_STOCK_PAGE_SIZE - 1, visibleStocks.length)
    return { start, end }
  }, [stockPage, stockPageCount, visibleStocks.length])

  const stockSnapshot = useMemo(() => {
    const totalUnits = storedInventoryRows.reduce((sum, row) => sum + row.quantityOnHand, 0)
    const healthyCount = storedInventoryRows.filter((row) => row.status === 'HEALTHY').length
    const lowCount = storedInventoryRows.filter((row) => row.status === 'LOW').length
    const outCount = storedInventoryRows.filter((row) => row.status === 'OUT').length
    const warehouseCount = new Set(storedInventoryRows.map((row) => row.warehouseName)).size
    const atRiskRows = storedInventoryRows
      .filter((row) => row.status !== 'HEALTHY')
      .sort((left, right) => {
        const severityDelta =
          inventoryStockSeverity(right.status) - inventoryStockSeverity(left.status)

        if (severityDelta !== 0) {
          return severityDelta
        }

        const rightGap = right.reorderPoint - right.quantityOnHand
        const leftGap = left.reorderPoint - left.quantityOnHand
        return rightGap - leftGap
      })

    const warehouseHealth = Array.from(
      storedInventoryRows.reduce((map, row) => {
        const entry = map.get(row.warehouseName) ?? {
          warehouseName: row.warehouseName,
          units: 0,
          items: 0,
          alertCount: 0,
        }

        entry.units += row.quantityOnHand
        entry.items += 1

        if (row.status !== 'HEALTHY') {
          entry.alertCount += 1
        }

        map.set(row.warehouseName, entry)
        return map
      }, new Map<string, { warehouseName: string; units: number; items: number; alertCount: number }>()),
    )
      .map(([, value]) => value)
      .sort((left, right) => {
        if (right.alertCount !== left.alertCount) {
          return right.alertCount - left.alertCount
        }

        return right.units - left.units
      })

    return {
      totalUnits,
      healthyCount,
      lowCount,
      outCount,
      warehouseCount,
      atRiskRows,
      warehouseHealth,
    }
  }, [storedInventoryRows])

  const stockDialogItemSuggestions = useMemo(() => {
    const branchId = stockDialogState?.form.branchId
    if (!branchId) {
      return []
    }

    const suggestions = new Map<string, { id?: string; name: string }>()

    for (const item of catalogItems) {
      if (item.branchId !== branchId) {
        continue
      }

      const key = item.name.trim().toLowerCase()
      if (!suggestions.has(key)) {
        suggestions.set(key, {
          id: item.id,
          name: item.name,
        })
      }
    }

    for (const row of storedInventoryRows) {
      if (row.branchId !== branchId) {
        continue
      }

      const key = row.itemName.trim().toLowerCase()
      if (!suggestions.has(key)) {
        suggestions.set(key, {
          name: row.itemName,
        })
      }
    }

    return Array.from(suggestions.values()).sort((left, right) =>
      left.name.localeCompare(right.name),
    )
  }, [catalogItems, storedInventoryRows, stockDialogState?.form.branchId])

  const stockDialogWarehouseSuggestions = useMemo(() => {
    const branchId = stockDialogState?.form.branchId
    if (!branchId) {
      return []
    }

    const suggestions = new Set<string>(['Main Stockroom'])
    for (const row of storedInventoryRows) {
      if (row.branchId === branchId) {
        suggestions.add(row.warehouseName)
      }
    }

    return Array.from(suggestions).sort((left, right) => left.localeCompare(right))
  }, [storedInventoryRows, stockDialogState?.form.branchId])

  useEffect(() => {
    if (!notice) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setNotice(null)
    }, 3200)

    return () => window.clearTimeout(timeoutId)
  }, [notice])

  useEffect(() => {
    setStockPage(1)
  }, [deferredSearch, selectedBranch, statusFilter])

  useEffect(() => {
    setStockPage((currentPage) => Math.min(currentPage, stockPageCount))
  }, [stockPageCount])

  const stockMutation = useMutation({
    mutationFn: (payload: {
      branchId: string
      itemId?: string
      itemName: string
      warehouseName: string
      action: InventoryAdjustmentAction
      quantity: number
      reorderPoint: number
      reason?: string
    }) => createInventoryAdjustment(payload),
    onSuccess: (row, payload) => {
      setStockDialogState(null)
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      setNotice({
        tone: 'success',
        message:
          payload.action === 'SET_BALANCE'
            ? `${row.itemName} in ${row.warehouseName} is now set to ${row.quantityOnHand} unit(s).`
            : `Added ${payload.quantity} unit(s) to ${row.itemName} in ${row.warehouseName}.`,
      })
    },
    onError: (error) => {
      setNotice({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to save the stock adjustment right now.',
      })
    },
  })
  const stockImportMutation = useMutation({
    mutationFn: (payload: {
      branchId: string
      sourceFileName?: string
      rows: Array<{
        itemId?: string
        itemName: string
        warehouseName: string
        quantityOnHand: number
        reorderPoint?: number
      }>
    }) => importInventoryStocks(payload),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      setNotice({
        tone: 'success',
        message:
          `Imported ${result.importedCount} row(s): ${result.createdCount} created, `
          + `${result.updatedCount} updated, ${result.skippedCount} unchanged.`,
      })
    },
    onError: (error) => {
      setNotice({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to import the stock sheet right now.',
      })
    },
  })

  const inventoryColumns = buildInventoryColumns(openAdjustStockDialog)

  function openAddStockDialog() {
    if (selectedBranch === 'all') {
      setNotice({
        tone: 'info',
        message: 'Choose a specific branch before creating a new stock row.',
      })
      return
    }

    const preferredWarehouse =
      storedInventoryRows.find((row) => row.branchId === selectedBranch)?.warehouseName
      ?? 'Main Stockroom'

    setStockDialogState({
      currentQuantity: 0,
      form: createInventoryStockAdjustmentForm(selectedBranch, {
        warehouseName: preferredWarehouse,
      }),
    })
  }

  function openAdjustStockDialog(row: InventoryStockViewRow) {
    setStockDialogState({
      rowId: row.id,
      currentQuantity: row.quantityOnHand,
      form: createInventoryStockAdjustmentForm(row.branchId, {
        itemId: row.itemId,
        itemName: row.itemName,
        warehouseName: row.warehouseName,
        reorderPoint: String(row.reorderPoint),
      }),
    })
  }

  function openStockImportPicker() {
    if (selectedBranch === 'all') {
      setNotice({
        tone: 'info',
        message: 'Choose a specific branch before importing stock balances.',
      })
      return
    }

    importInputRef.current?.click()
  }

  async function exportStockSheet() {
    if (selectedBranch === 'all') {
      setNotice({
        tone: 'info',
        message: 'Choose a specific branch before exporting stock balances.',
      })
      return
    }

    if (inventoryRows.length === 0) {
      setNotice({
        tone: 'info',
        message: 'There are no catalog items or stock rows to export for this branch.',
      })
      return
    }

    setIsExporting(true)

    try {
      const csv = serializeInventoryStockSheetCsv(inventoryRows)
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      const url = URL.createObjectURL(
        new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      )
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `item-stocks-${selectedBranch}-${timestamp}.csv`
      anchor.click()
      URL.revokeObjectURL(url)
      setNotice({
        tone: 'success',
        message: 'Exported the current item stock sheet in the requested format.',
      })
    } catch (error) {
      setNotice({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to export the stock sheet right now.',
      })
    } finally {
      setIsExporting(false)
    }
  }

  async function handleStockSheetImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    if (selectedBranch === 'all') {
      setNotice({
        tone: 'info',
        message: 'Choose a specific branch before importing stock balances.',
      })
      return
    }

    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Stock import files must be 5 MB or smaller.')
      }
      const parsedRows = parseInventoryStockSheetCsv(await file.text())
      const existingRowsByKey = new Map(
        storedInventoryRows.map((row) => [
          buildInventoryStockRowKey(row.branchId, row.itemName, row.warehouseName),
          row,
        ]),
      )
      const catalogItemsByName = new Map<string, CatalogItem>()

      for (const item of catalogItems) {
        const key = `${item.branchId}::${item.name.trim().toLowerCase()}`
        if (!catalogItemsByName.has(key)) {
          catalogItemsByName.set(key, item)
        }
      }

      const rowsToImport = Array.from(
        parsedRows.reduce(
          (map, row) => {
            const itemMatch = catalogItemsByName.get(
              `${selectedBranch}::${row.itemName.trim().toLowerCase()}`,
            )
            const existingRow = existingRowsByKey.get(
              buildInventoryStockRowKey(
                selectedBranch,
                row.itemName,
                row.warehouseName,
              ),
            )

            map.set(
              buildInventoryStockRowKey(
                selectedBranch,
                row.itemName,
                row.warehouseName,
              ),
              {
                itemId: itemMatch?.id,
                itemName: row.itemName,
                warehouseName: row.warehouseName,
                quantityOnHand: row.stockQuantity,
                reorderPoint: existingRow?.reorderPoint ?? 10,
              },
            )
            return map
          },
          new Map<
            string,
            {
              itemId?: string
              itemName: string
              warehouseName: string
              quantityOnHand: number
              reorderPoint?: number
            }
          >(),
        ).values(),
      )

      stockImportMutation.mutate({
        branchId: selectedBranch,
        sourceFileName: file.name,
        rows: rowsToImport,
      })
    } catch (error) {
      setNotice({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to read the selected stock sheet.',
      })
    }
  }

  function closeStockDialog() {
    if (stockMutation.isPending) {
      return
    }

    setStockDialogState(null)
  }

  function updateStockDialogForm(
    updater: (form: InventoryStockAdjustmentForm) => InventoryStockAdjustmentForm,
  ) {
    setStockDialogState((currentState) => {
      if (!currentState) {
        return currentState
      }

      const nextForm = updater(currentState.form)
      const matchedItem = findCatalogItemMatch(
        catalogItems,
        nextForm.branchId,
        nextForm.itemName,
      )

      return {
        ...currentState,
        form: {
          ...nextForm,
          itemId: matchedItem?.id,
        },
      }
    })
  }

  function submitStockDialog() {
    if (!stockDialogState || stockMutation.isPending) {
      return
    }

    const itemName = stockDialogState.form.itemName.trim()
    const warehouseName = stockDialogState.form.warehouseName.trim()
    const quantity = Number(stockDialogState.form.quantity)
    const reorderPoint = Number(stockDialogState.form.reorderPoint)

    if (itemName.length < 2) {
      setNotice({
        tone: 'error',
        message: 'Enter an item name before saving stock.',
      })
      return
    }

    if (warehouseName.length < 2) {
      setNotice({
        tone: 'error',
        message: 'Enter a warehouse name before saving stock.',
      })
      return
    }

    if (!Number.isFinite(quantity) || quantity < 0) {
      setNotice({
        tone: 'error',
        message: 'Quantity must be zero or greater.',
      })
      return
    }

    if (stockDialogState.form.action === 'STOCK_IN' && quantity < 1) {
      setNotice({
        tone: 'error',
        message: 'Stock in requires at least 1 unit.',
      })
      return
    }

    if (!Number.isFinite(reorderPoint) || reorderPoint < 0) {
      setNotice({
        tone: 'error',
        message: 'Reorder point must be zero or greater.',
      })
      return
    }

    stockMutation.mutate({
      branchId: stockDialogState.form.branchId,
      itemId: stockDialogState.form.itemId,
      itemName,
      warehouseName,
      action: stockDialogState.form.action,
      quantity,
      reorderPoint,
      reason: stockDialogState.form.reason.trim() || undefined,
    })
  }

  return (
    <InventoryShell
      eyebrow="Inventory"
      title="Item Stocks"
      description="Track on-hand quantity, reorder pressure, and stock health across every warehouse and branch."
    >
      {notice ? <InventoryNoticeBanner notice={notice} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InventoryMetricCard
          label="Visible Rows"
          value={String(inventoryRows.length)}
          hint="Catalog items without a saved stock row are shown here at zero."
          icon={PackageSearch}
          toneClassName="bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
        />
        <InventoryMetricCard
          label="Saved Units"
          value={String(stockSnapshot.totalUnits)}
          hint="Combined on-hand quantity from saved stock rows only."
          icon={Boxes}
          toneClassName="bg-sky-50 text-sky-600"
        />
        <InventoryMetricCard
          label="Reorder Alerts"
          value={String(stockSnapshot.lowCount + stockSnapshot.outCount)}
          hint={`${stockSnapshot.outCount} out of stock and ${stockSnapshot.lowCount} running low.`}
          icon={AlertTriangle}
          toneClassName="bg-amber-50 text-amber-600"
        />
        <InventoryMetricCard
          label="Healthy Warehouses"
          value={String(
            stockSnapshot.warehouseHealth.filter((warehouse) => warehouse.alertCount === 0).length,
          )}
          hint={`${stockSnapshot.warehouseCount} warehouse locations with saved stock balances.`}
          icon={ShieldCheck}
          toneClassName="bg-emerald-50 text-emerald-600"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.45fr]">
        <div className="space-y-6">
          <SectionCard
            title="Replenishment queue"
            description="Only saved stock rows are included here so the queue stays focused on actual on-hand balances."
            action={<InventoryBadge value={`${stockSnapshot.atRiskRows.length} action items`} />}
          >
            <div className="space-y-3">
              {storedInventoryRows.length === 0 ? (
                <div className="rounded-3xl border border-sky-100 bg-sky-50/80 px-5 py-6 text-sm text-sky-700">
                  No saved stock rows yet. Import your stock sheet or add stock manually to start the replenishment queue.
                </div>
              ) : stockSnapshot.atRiskRows.length === 0 ? (
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50/80 px-5 py-6 text-sm text-emerald-700">
                  No immediate replenishment issues. All tracked rows are currently above reorder threshold.
                </div>
              ) : (
                stockSnapshot.atRiskRows.slice(0, 6).map((row) => {
                  const gap = Math.max(row.reorderPoint - row.quantityOnHand, 0)

                  return (
                    <article
                      key={row.id}
                      className="rounded-3xl border border-[color:var(--border)] bg-[color:rgba(255,255,255,0.78)] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="section-title text-base font-bold text-[color:var(--ink)]">
                            {row.itemName}
                          </p>
                          <p className="text-sm text-[color:var(--muted)]">{row.warehouseName}</p>
                        </div>
                        <StatusPill
                          tone={inventoryStockTone(row.status)}
                          label={row.status === 'OUT' ? 'OUT NOW' : row.status}
                        />
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-[color:var(--surface-soft)] px-3 py-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
                            On hand
                          </p>
                          <p className="mt-1 font-semibold text-[color:var(--ink)]">
                            {row.quantityOnHand}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-[color:var(--surface-soft)] px-3 py-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
                            Reorder
                          </p>
                          <p className="mt-1 font-semibold text-[color:var(--ink)]">
                            {row.reorderPoint}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-[color:var(--surface-soft)] px-3 py-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
                            Gap
                          </p>
                          <p className="mt-1 font-semibold text-rose-700">{gap}</p>
                        </div>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Warehouse health"
            description="Warehouse rollups are based on saved stock rows so the summary does not inflate from unsaved catalog items."
          >
            <div className="space-y-3">
              {stockSnapshot.warehouseHealth.length === 0 ? (
                <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-5 py-6 text-sm text-[color:var(--muted)]">
                  Warehouse health will appear here once this branch has saved stock rows.
                </div>
              ) : stockSnapshot.warehouseHealth.map((warehouse) => (
                <article
                  key={warehouse.warehouseName}
                  className="rounded-3xl border border-[color:var(--border)] bg-[color:rgba(255,255,255,0.78)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-[color:var(--ink)]">
                          {warehouse.warehouseName}
                        </p>
                        <p className="text-sm text-[color:var(--muted)]">
                          {warehouse.items} tracked items
                        </p>
                      </div>
                    </div>
                    <InventoryBadge
                      value={
                        warehouse.alertCount === 0
                          ? 'Stable'
                          : `${warehouse.alertCount} alerts`
                      }
                    />
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-[color:var(--muted)]">Units on hand</span>
                    <span className="font-semibold text-[color:var(--ink)]">
                      {warehouse.units}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard
            title="Stock policy"
            description="Catalog items stay visible before their first stock import, but saved stock summaries stay separate so this page remains fast."
          >
            <div className="rounded-[28px] border border-[color:var(--border)] bg-[color:rgba(255,255,255,0.72)] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                      <PackageSearch className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-[color:var(--ink)]">
                        Current stock visibility
                      </p>
                      <p className="text-sm text-[color:var(--muted)]">
                        {catalogSeedCount} catalog item{catalogSeedCount === 1 ? '' : 's'} are waiting for their first saved stock balance, while {storedInventoryRows.length} row{storedInventoryRows.length === 1 ? '' : 's'} already have saved counts.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl bg-[color:var(--accent-soft)] px-4 py-3 text-sm text-[color:var(--accent)]">
                  Import and export use the same item-stock CSV format
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Current stock levels"
            description="Paged stock rows for the selected branch, with import and export using the item stock CSV format."
            action={
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <InventoryBadge value={`${visibleStocks.length} results`} />
                <button
                  type="button"
                  onClick={exportStockSheet}
                  disabled={selectedBranch === 'all' || isExporting || inventoryRows.length === 0}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm font-medium text-[color:var(--ink)] transition hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  <Download className="h-4 w-4" />
                  {isExporting ? 'Exporting...' : 'Export CSV'}
                </button>
                <button
                  type="button"
                  onClick={openStockImportPicker}
                  disabled={selectedBranch === 'all' || stockImportMutation.isPending}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm font-medium text-[color:var(--ink)] transition hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  <Upload className="h-4 w-4" />
                  {stockImportMutation.isPending ? 'Importing...' : 'Import CSV'}
                </button>
                <button
                  type="button"
                  onClick={openAddStockDialog}
                  disabled={selectedBranch === 'all'}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--accent)] px-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  <Plus className="h-4 w-4" />
                  Add Stock
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-1 flex-col gap-3 lg:flex-row">
                  <label className="relative block flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
                    <input
                      value={searchValue}
                      onChange={(event) => setSearchValue(event.target.value)}
                      placeholder="Search item, warehouse, or branch"
                      className="h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] pl-11 pr-4 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/10"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(['ALL', 'HEALTHY', 'LOW', 'OUT'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setStatusFilter(value)}
                        className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                          statusFilter === value
                            ? 'bg-[color:var(--accent)] text-white shadow-[0_10px_24px_rgba(31,102,242,0.22)]'
                            : 'border border-[color:var(--border)] bg-[color:var(--panel-strong)] text-[color:var(--muted)] hover:bg-[color:var(--surface-soft)]'
                        }`}
                      >
                        {value === 'ALL' ? 'All statuses' : value}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void inventoryQuery.refetch()
                  }}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm font-medium text-[color:var(--ink)] transition hover:bg-[color:var(--surface-soft)]"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
              </div>

              {selectedBranch === 'all' ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                  Switch the branch filter from `All` to a specific branch before creating, importing, or exporting stock rows.
                </div>
              ) : null}

              {catalogSeedCount > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {catalogSeedCount} catalog item{catalogSeedCount === 1 ? '' : 's'} do not have a saved stock row yet. They appear here at zero until you import balances or add stock manually.
                </div>
              ) : null}

              {inventoryQuery.isError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  Unable to load live inventory. The page is showing fallback data while the backend is unavailable.
                </div>
              ) : null}

              {catalogQuery.isFetching ? (
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-[color:var(--muted)]">
                  Refreshing catalog items...
                </p>
              ) : null}

              {inventoryQuery.isFetching ? (
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-[color:var(--muted)]">
                  Refreshing stock rows...
                </p>
              ) : null}

              {pagedStocks.length > 0 ? (
                <div className="space-y-4">
                  <InventoryStockMobileList
                    rows={pagedStocks}
                    onAdjust={openAdjustStockDialog}
                  />
                  <div className="hidden lg:block">
                    <DataTable columns={inventoryColumns} data={pagedStocks} />
                  </div>
                  <InventoryPaginationBar
                    page={Math.min(stockPage, stockPageCount)}
                    pageCount={stockPageCount}
                    rangeStart={stockPageRange.start}
                    rangeEnd={stockPageRange.end}
                    total={visibleStocks.length}
                    onPrevious={() =>
                      setStockPage((currentPage) => Math.max(1, currentPage - 1))}
                    onNext={() =>
                      setStockPage((currentPage) =>
                        Math.min(stockPageCount, currentPage + 1),
                      )}
                  />
                </div>
              ) : (
                <div className="rounded-[28px] border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] px-6 py-12 text-center">
                  <p className="text-base font-semibold text-[color:var(--ink)]">
                    {inventoryRows.length === 0
                      ? 'No catalog items or stock rows were found for this branch'
                      : 'No stock rows matched the current filters'}
                  </p>
                  <p className="mt-2 text-sm text-[color:var(--muted)]">
                    {inventoryRows.length === 0
                      ? 'Load catalog items for this branch first, then export or import the stock sheet.'
                      : 'Try a different item search or switch back to `All statuses`.'}
                  </p>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleStockSheetImport}
        className="hidden"
      />

      {stockDialogState ? (
        <InventoryStockAdjustmentModal
          state={stockDialogState}
          busy={stockMutation.isPending}
          itemSuggestions={stockDialogItemSuggestions}
          warehouseSuggestions={stockDialogWarehouseSuggestions}
          onClose={closeStockDialog}
          onChange={updateStockDialogForm}
          onSubmit={submitStockDialog}
        />
      ) : null}
    </InventoryShell>
  )
}

export function InventoryItemTransfersPage() {
  return (
    <InventoryShell
      eyebrow="Inventory"
      title="Item Transfers"
      description="Monitor branch-to-branch transfer requests, approvals, and fulfillment without breaking the append-only movement log."
    >
      <SectionCard
        title="Transfer queue"
        description="Transfers stay visible until both warehouse sides have posted their movement records."
        action={<InventoryBadge value={`${transferQueue.length} active routes`} />}
      >
        <div className="grid gap-4 xl:grid-cols-3">
          {transferQueue.map((transfer) => (
            <article key={transfer.reference} className="rounded-3xl bg-[color:var(--surface-soft)] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ArrowRightLeft className="h-5 w-5 text-[color:var(--accent)]" />
                  <div>
                    <p className="section-title text-lg font-bold">{transfer.route}</p>
                    <p className="text-sm text-[color:var(--muted)]">{transfer.reference}</p>
                  </div>
                </div>
                <StatusPill tone={inventoryTone(transfer.status)} label={transfer.status} />
              </div>
              <p className="mt-4 text-sm text-[color:var(--muted)]">{transfer.note}</p>
            </article>
          ))}
        </div>
      </SectionCard>
    </InventoryShell>
  )
}

export function InventoryCsvImportPage() {
  return (
    <InventoryShell
      eyebrow="Inventory"
      title="CSV Import"
      description="Stage bulk inventory uploads, validate references, and keep import corrections visible before they mutate stock data."
    >
      <SectionCard
        title="Import jobs"
        description="CSV files are staged first so supplier codes, SKUs, and branch mappings can be verified before commit."
        action={<InventoryBadge value={`${csvImportJobs.length} staged files`} />}
      >
        <div className="grid gap-4 xl:grid-cols-3">
          {csvImportJobs.map((job) => (
            <article key={job.fileName} className="rounded-3xl bg-[color:var(--surface-soft)] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-[color:var(--accent)]" />
                  <div>
                    <p className="section-title text-lg font-bold">{job.fileName}</p>
                    <p className="text-sm text-[color:var(--muted)]">{job.summary}</p>
                  </div>
                </div>
                <StatusPill tone={inventoryTone(job.status)} label={job.status} />
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </InventoryShell>
  )
}

export function InventorySuppliersPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch)
  const suppliers = useInventorySupplierStore((state) => state.suppliers)
  const ensureSuppliers = useInventorySupplierStore((state) => state.ensureSuppliers)
  const updateSuppliers = useInventorySupplierStore((state) => state.updateSuppliers)
  const [searchValue, setSearchValue] = useState('')
  const [notice, setNotice] = useState<InventoryNotice | null>(null)
  const [supplierDialogMode, setSupplierDialogMode] = useState<'add' | 'edit' | null>(null)
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null)
  const [supplierForm, setSupplierForm] = useState<InventorySupplierForm>(
    emptySupplierForm(selectedBranch),
  )

  useEffect(() => {
    ensureSuppliers(supplierProfiles)
  }, [ensureSuppliers])

  useEffect(() => {
    if (!notice) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setNotice(null)
    }, 3200)

    return () => window.clearTimeout(timeoutId)
  }, [notice])

  const visibleSuppliers = useMemo(() => {
    const branchScoped =
      selectedBranch === 'all'
        ? suppliers
        : suppliers.filter((supplier) => supplier.branchId === selectedBranch)
    const query = searchValue.trim().toLowerCase()

    if (!query) {
      return branchScoped
    }

    return branchScoped.filter((supplier) =>
      [
        supplier.name,
        supplier.contactName,
        supplier.phone,
        supplier.email,
        supplier.address,
        supplier.focus,
        supplier.leadTime,
        supplier.notes,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [searchValue, selectedBranch, suppliers])

  function openAddSupplierDialog() {
    setEditingSupplierId(null)
    setSupplierForm(emptySupplierForm(selectedBranch))
    setSupplierDialogMode('add')
  }

  function openEditSupplierDialog(supplier: InventorySupplierRecord) {
    setEditingSupplierId(supplier.id)
    setSupplierForm({
      branchId: supplier.branchId,
      name: supplier.name,
      contactName: supplier.contactName,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      focus: supplier.focus,
      leadTime: supplier.leadTime,
      notes: supplier.notes,
      active: supplier.active,
    })
    setSupplierDialogMode('edit')
  }

  function closeSupplierDialog() {
    setSupplierDialogMode(null)
    setEditingSupplierId(null)
  }

  function saveSupplier() {
    const trimmedName = supplierForm.name.trim()
    const trimmedContactName = supplierForm.contactName.trim()
    const trimmedPhone = supplierForm.phone.trim()
    const trimmedEmail = supplierForm.email.trim()
    const trimmedAddress = supplierForm.address.trim()
    const trimmedFocus = supplierForm.focus.trim()
    const trimmedLeadTime = supplierForm.leadTime.trim()
    const trimmedNotes = supplierForm.notes.trim()

    if (
      !trimmedName ||
      !trimmedContactName ||
      !trimmedPhone ||
      !trimmedEmail ||
      !trimmedAddress ||
      !trimmedFocus ||
      !trimmedLeadTime
    ) {
      setNotice({
        tone: 'error',
        message: 'Supplier name, contact, phone, email, address, focus, and lead time are required.',
      })
      return
    }

    const hasDuplicateName = suppliers.some(
      (supplier) =>
        supplier.id !== editingSupplierId &&
        supplier.branchId === supplierForm.branchId &&
        supplier.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    )

    if (hasDuplicateName) {
      setNotice({
        tone: 'error',
        message: 'A supplier with the same name already exists for that branch.',
      })
      return
    }

    const nextSupplier: InventorySupplierRecord = {
      id: editingSupplierId ?? createSupplierId(),
      branchId: supplierForm.branchId,
      name: trimmedName,
      contactName: trimmedContactName,
      phone: trimmedPhone,
      email: trimmedEmail,
      address: trimmedAddress,
      focus: trimmedFocus,
      leadTime: trimmedLeadTime,
      notes: trimmedNotes,
      active: supplierForm.active,
    }

    updateSuppliers((current) =>
      supplierDialogMode === 'edit'
        ? current.map((supplier) =>
            supplier.id === editingSupplierId ? nextSupplier : supplier,
          )
        : [nextSupplier, ...current],
    )
    setNotice({
      tone: 'success',
      message:
        supplierDialogMode === 'edit'
          ? `Updated ${nextSupplier.name}.`
          : `Added ${nextSupplier.name} to suppliers.`,
    })
    closeSupplierDialog()
  }

  function toggleSupplierStatus(supplier: InventorySupplierRecord) {
    updateSuppliers((current) =>
      current.map((currentSupplier) =>
        currentSupplier.id === supplier.id
          ? { ...currentSupplier, active: !currentSupplier.active }
          : currentSupplier,
      ),
    )
    setNotice({
      tone: 'success',
      message: `${supplier.name} was ${supplier.active ? 'disabled' : 'enabled'}.`,
    })
  }

  function deleteSupplier(supplier: InventorySupplierRecord) {
    const confirmed = window.confirm(`Delete ${supplier.name}?`)

    if (!confirmed) {
      return
    }

    updateSuppliers((current) =>
      current.filter((currentSupplier) => currentSupplier.id !== supplier.id),
    )
    setNotice({
      tone: 'success',
      message: `${supplier.name} was removed from suppliers.`,
    })
  }

  return (
    <InventoryShell
      eyebrow="Inventory"
      title="Suppliers"
      description="Track supplier lead times, supply focus, and which vendors support the replenishment cycle for each branch."
    >
      <SectionCard
        title="Supplier directory"
        description="Supplier records support purchase orders, receiving, and the cost baselines used in margin reporting."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <InventoryBadge value={`${visibleSuppliers.length} suppliers`} />
            <button
              type="button"
              onClick={openAddSupplierDialog}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm font-medium text-slate-800 transition hover:bg-[color:var(--surface-soft)]"
            >
              <Plus className="h-4 w-4" />
              Add Supplier
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          {notice ? <InventoryNoticeBanner notice={notice} /> : null}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search supplier, contact, phone, email, address"
                className="h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
              />
            </label>
            <button
              type="button"
              onClick={openAddSupplierDialog}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              New Supplier
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleSuppliers.map((supplier) => (
              <article key={supplier.id} className="rounded-3xl bg-[color:var(--surface-soft)] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Truck className="h-5 w-5 text-[color:var(--accent)]" />
                    <div>
                      <p className="section-title text-xl font-bold">{supplier.name}</p>
                      <p className="text-sm text-[color:var(--muted)]">{supplier.focus}</p>
                    </div>
                  </div>
                  <StatusPill
                    tone={supplier.active ? 'success' : 'neutral'}
                    label={supplier.active ? 'ACTIVE' : 'INACTIVE'}
                  />
                </div>
                <div className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
                  <p>Contact: {supplier.contactName}</p>
                  <p>Phone: {supplier.phone}</p>
                  <p>Email: {supplier.email}</p>
                  <p>Address: {supplier.address}</p>
                  <p>Lead time: {supplier.leadTime}</p>
                  {supplier.notes ? <p>Notes: {supplier.notes}</p> : null}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEditSupplierDialog(supplier)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--border)] px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSupplierStatus(supplier)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--border)] px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
                  >
                    {supplier.active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSupplier(supplier)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>

          {visibleSuppliers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-6 text-sm text-[color:var(--muted)]">
              No suppliers match the current filter.
            </div>
          ) : null}
        </div>
      </SectionCard>

      {supplierDialogMode ? (
        <InventoryModalFrame
          title={supplierDialogMode === 'add' ? 'Add Supplier' : 'Edit Supplier'}
          description="Create or update a supplier with its core business and contact information."
          onClose={closeSupplierDialog}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Branch</span>
              <select
                value={supplierForm.branchId}
                onChange={(event) =>
                  setSupplierForm((current) => ({ ...current, branchId: event.target.value }))
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
              >
                {inventoryBranchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Supplier name</span>
              <input
                value={supplierForm.name}
                onChange={(event) =>
                  setSupplierForm((current) => ({ ...current, name: event.target.value }))
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                placeholder="Metro Food Distributors"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Contact person</span>
              <input
                value={supplierForm.contactName}
                onChange={(event) =>
                  setSupplierForm((current) => ({ ...current, contactName: event.target.value }))
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                placeholder="Liza Mendoza"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Phone</span>
              <input
                value={supplierForm.phone}
                onChange={(event) =>
                  setSupplierForm((current) => ({ ...current, phone: event.target.value }))
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                placeholder="+63 917 000 0000"
              />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                value={supplierForm.email}
                onChange={(event) =>
                  setSupplierForm((current) => ({ ...current, email: event.target.value }))
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                placeholder="orders@supplier.example"
              />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Address</span>
              <input
                value={supplierForm.address}
                onChange={(event) =>
                  setSupplierForm((current) => ({ ...current, address: event.target.value }))
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                placeholder="120 M. Dela Cruz St., Quezon City"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Supply focus</span>
              <input
                value={supplierForm.focus}
                onChange={(event) =>
                  setSupplierForm((current) => ({ ...current, focus: event.target.value }))
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                placeholder="Dry goods and beverages"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Lead time</span>
              <input
                value={supplierForm.leadTime}
                onChange={(event) =>
                  setSupplierForm((current) => ({ ...current, leadTime: event.target.value }))
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                placeholder="2 business days"
              />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Notes</span>
              <textarea
                value={supplierForm.notes}
                onChange={(event) =>
                  setSupplierForm((current) => ({ ...current, notes: event.target.value }))
                }
                className="min-h-[104px] w-full rounded-2xl border border-[color:var(--border)] px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                placeholder="Optional supplier notes, payment terms, or receiving instructions"
              />
            </label>
            <label className="sm:col-span-2 flex items-center gap-3 rounded-2xl border border-[color:var(--border)] px-4 py-3">
              <input
                type="checkbox"
                checked={supplierForm.active}
                onChange={(event) =>
                  setSupplierForm((current) => ({ ...current, active: event.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">Active supplier</p>
                <p className="text-xs text-[color:var(--muted)]">
                  Disabled suppliers stay on file but are hidden from active procurement flows.
                </p>
              </div>
            </label>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeSupplierDialog}
              className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveSupplier}
              className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              {supplierDialogMode === 'add' ? 'Add Supplier' : 'Save Changes'}
            </button>
          </div>
        </InventoryModalFrame>
      ) : null}
    </InventoryShell>
  )
}

export function InventoryPurchaseOrdersPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch)
  const inventoryQuery = useInventory(selectedBranch)
  const warehouses = useInventoryWarehouseStore((state) => state.warehouses)
  const ensureWarehouses = useInventoryWarehouseStore((state) => state.ensureWarehouses)
  const suppliers = useInventorySupplierStore((state) => state.suppliers)
  const ensureSuppliers = useInventorySupplierStore((state) => state.ensureSuppliers)
  const purchaseOrderRows = useInventoryPurchaseOrderStore((state) => state.purchaseOrders)
  const ensurePurchaseOrders = useInventoryPurchaseOrderStore((state) => state.ensurePurchaseOrders)
  const updatePurchaseOrders = useInventoryPurchaseOrderStore((state) => state.updatePurchaseOrders)
  const [notice, setNotice] = useState<InventoryNotice | null>(null)
  const [isPurchaseOrderFormOpen, setIsPurchaseOrderFormOpen] = useState(false)
  const [purchaseOrderForm, setPurchaseOrderForm] = useState<InventoryPurchaseOrderForm>(
    emptyPurchaseOrderForm(),
  )

  useEffect(() => {
    ensureWarehouses(warehouseProfiles)
    ensureSuppliers(supplierProfiles)
    ensurePurchaseOrders(purchaseOrders)
  }, [ensurePurchaseOrders, ensureSuppliers, ensureWarehouses])

  useEffect(() => {
    if (!notice) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setNotice(null)
    }, 3200)

    return () => window.clearTimeout(timeoutId)
  }, [notice])

  const branchWarehouses = useMemo(
    () =>
      selectedBranch === 'all'
        ? warehouses
        : warehouses.filter((warehouse) => warehouse.branchId === selectedBranch),
    [selectedBranch, warehouses],
  )
  const branchSuppliers = useMemo(
    () =>
      selectedBranch === 'all'
        ? suppliers
        : suppliers.filter((supplier) => supplier.branchId === selectedBranch),
    [selectedBranch, suppliers],
  )
  const visiblePurchaseOrders = useMemo(
    () =>
      selectedBranch === 'all'
        ? purchaseOrderRows
        : purchaseOrderRows.filter((purchaseOrder) => purchaseOrder.branchId === selectedBranch),
    [purchaseOrderRows, selectedBranch],
  )
  const itemOptions = useMemo(() => {
    const seededItemNames = purchaseOrders.flatMap((purchaseOrder) =>
      purchaseOrder.items.map((item) => item.itemName),
    )
    const inventoryItemNames = (inventoryQuery.data ?? []).map((item) => item.itemName)

    return Array.from(new Set([...inventoryItemNames, ...seededItemNames])).sort((left, right) =>
      left.localeCompare(right),
    )
  }, [inventoryQuery.data])
  const selectedWarehouse = branchWarehouses.find(
    (warehouse) => warehouse.id === purchaseOrderForm.warehouseId,
  )
  const selectedSupplier = branchSuppliers.find(
    (supplier) => supplier.id === purchaseOrderForm.supplierId,
  )
  const stockLookup = useMemo(() => {
    return new Map(
      (inventoryQuery.data ?? []).map((row) => [
        `${row.warehouseName}::${row.itemName}`,
        row.quantityOnHand,
      ]),
    )
  }, [inventoryQuery.data])
  const purchaseOrderTotal = useMemo(
    () =>
      purchaseOrderForm.items.reduce((accumulator, item) => {
        const quantity = Number(item.quantity)
        const cost = Number(item.cost)
        const lineTotal =
          Number.isFinite(quantity) && Number.isFinite(cost) ? quantity * cost : 0

        return accumulator + lineTotal
      }, 0),
    [purchaseOrderForm.items],
  )

  function updatePurchaseOrderItem(
    itemId: string,
    updater: (item: InventoryPurchaseOrderItemForm) => InventoryPurchaseOrderItemForm,
  ) {
    setPurchaseOrderForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? updater(item) : item)),
    }))
  }

  function addPurchaseOrderItem() {
    setPurchaseOrderForm((current) => ({
      ...current,
      items: [...current.items, createPurchaseOrderItemForm()],
    }))
  }

  function removePurchaseOrderItem(itemId: string) {
    setPurchaseOrderForm((current) => {
      const nextItems = current.items.filter((item) => item.id !== itemId)
      return {
        ...current,
        items: nextItems.length > 0 ? nextItems : [createPurchaseOrderItemForm()],
      }
    })
  }

  function resetPurchaseOrderForm() {
    setPurchaseOrderForm(emptyPurchaseOrderForm())
  }

  function openPurchaseOrderForm() {
    resetPurchaseOrderForm()
    setIsPurchaseOrderFormOpen(true)
  }

  function closePurchaseOrderForm() {
    resetPurchaseOrderForm()
    setIsPurchaseOrderFormOpen(false)
  }

  function savePurchaseOrder() {
    if (!selectedSupplier || !selectedWarehouse) {
      setNotice({
        tone: 'error',
        message: 'Supplier and warehouse are required before saving a purchase order.',
      })
      return
    }

    const normalizedItems = purchaseOrderForm.items
      .map((item) => {
        const itemName = item.itemName.trim()
        const quantity = Number(item.quantity)
        const cost = Number(item.cost)
        const stock = stockLookup.get(`${selectedWarehouse.name}::${itemName}`) ?? 0

        if (!itemName || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(cost) || cost < 0) {
          return null
        }

        return {
          id: item.id,
          itemName,
          stock,
          quantity,
          cost,
          total: Number((quantity * cost).toFixed(2)),
        } satisfies InventoryPurchaseOrderItemRecord
      })
      .filter((item): item is InventoryPurchaseOrderItemRecord => item !== null)

    if (normalizedItems.length === 0) {
      setNotice({
        tone: 'error',
        message: 'Add at least one valid order item before saving.',
      })
      return
    }

    const nextPurchaseOrder: InventoryPurchaseOrderRecord = {
      id: createPurchaseOrderId(),
      code: createPurchaseOrderCode(),
      branchId: selectedWarehouse.branchId,
      supplier: selectedSupplier.name,
      warehouseName: selectedWarehouse.name,
      orderDate: purchaseOrderForm.orderDate,
      expectedDate: purchaseOrderForm.expectedDate || purchaseOrderForm.orderDate,
      total: Number(
        normalizedItems.reduce((sum, item) => sum + item.total, 0).toFixed(2),
      ),
      status: 'OPEN',
      note: purchaseOrderForm.note.trim(),
      items: normalizedItems,
    }

    updatePurchaseOrders((current) => [nextPurchaseOrder, ...current])
    setNotice({
      tone: 'success',
      message: `${nextPurchaseOrder.code} was created successfully.`,
    })
    closePurchaseOrderForm()
  }

  function deletePurchaseOrder(purchaseOrder: InventoryPurchaseOrderRecord) {
    const confirmed = window.confirm(`Delete ${purchaseOrder.code}?`)

    if (!confirmed) {
      return
    }

    updatePurchaseOrders((current) =>
      current.filter((currentOrder) => currentOrder.id !== purchaseOrder.id),
    )
    setNotice({
      tone: 'success',
      message: `${purchaseOrder.code} was removed from purchase orders.`,
    })
  }

  return (
    <InventoryShell
      eyebrow="Inventory"
      title="Purchase Orders"
      description="Manage procurement status from draft through receiving while preserving the supplier and stock audit trail."
    >
      <div className="space-y-6">
        {notice ? <InventoryNoticeBanner notice={notice} /> : null}

        <SectionCard
          title="Open purchase orders"
          description="Purchase orders connect supplier commitments to receiving and downstream stock movement updates."
          action={
            <div className="flex flex-wrap items-center gap-3">
              <InventoryBadge value={`${visiblePurchaseOrders.length} purchase orders`} />
              <button
                type="button"
                onClick={openPurchaseOrderForm}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Add Purchase Order
              </button>
            </div>
          }
        >
          <div className="grid gap-4 xl:grid-cols-3">
            {visiblePurchaseOrders.map((purchaseOrder) => (
              <article key={purchaseOrder.id} className="rounded-3xl bg-[color:var(--surface-soft)] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="h-5 w-5 text-[color:var(--accent)]" />
                    <div>
                      <p className="section-title text-lg font-bold">{purchaseOrder.code}</p>
                      <p className="text-sm text-[color:var(--muted)]">{purchaseOrder.supplier}</p>
                    </div>
                  </div>
                  <StatusPill
                    tone={inventoryTone(purchaseOrder.status)}
                    label={purchaseOrder.status}
                  />
                </div>
                <div className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
                  <p>Warehouse: {purchaseOrder.warehouseName}</p>
                  <p>Order date: {purchaseOrder.orderDate}</p>
                  <p>Expected: {purchaseOrder.expectedDate}</p>
                  <p>{purchaseOrder.items.length} line item{purchaseOrder.items.length === 1 ? '' : 's'}</p>
                  {purchaseOrder.note ? <p>Note: {purchaseOrder.note}</p> : null}
                </div>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950">
                    Total committed: {formatCurrency(purchaseOrder.total)}
                  </p>
                  <button
                    type="button"
                    onClick={() => deletePurchaseOrder(purchaseOrder)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>

        {isPurchaseOrderFormOpen ? (
          <InventoryModalFrame
            title="Purchase order details"
            description="Create a purchase order with supplier, warehouse, dates, item rows, and notes before posting it to the open PO list."
            onClose={closePurchaseOrderForm}
          >
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Supplier</span>
                  <select
                    value={purchaseOrderForm.supplierId}
                    onChange={(event) =>
                      setPurchaseOrderForm((current) => ({
                        ...current,
                        supplierId: event.target.value,
                      }))
                    }
                    className="h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                  >
                    <option value="">Select supplier</option>
                    {branchSuppliers.filter((supplier) => supplier.active).map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Warehouse</span>
                  <select
                    value={purchaseOrderForm.warehouseId}
                    onChange={(event) =>
                      setPurchaseOrderForm((current) => ({
                        ...current,
                        warehouseId: event.target.value,
                      }))
                    }
                    className="h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                  >
                    <option value="">Select warehouse</option>
                    {branchWarehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Order Date</span>
                  <input
                    type="date"
                    value={purchaseOrderForm.orderDate}
                    onChange={(event) =>
                      setPurchaseOrderForm((current) => ({
                        ...current,
                        orderDate: event.target.value,
                      }))
                    }
                    className="h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Expected Date</span>
                  <input
                    type="date"
                    value={purchaseOrderForm.expectedDate}
                    onChange={(event) =>
                      setPurchaseOrderForm((current) => ({
                        ...current,
                        expectedDate: event.target.value,
                      }))
                    }
                    className="h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                  />
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="section-title text-xl font-bold text-slate-950">Order Items</h3>
                  <button
                    type="button"
                    onClick={addPurchaseOrderItem}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm font-medium text-slate-800 transition hover:bg-[color:var(--surface-soft)]"
                  >
                    <Plus className="h-4 w-4" />
                    Add Item
                  </button>
                </div>

                <div className="overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--panel-strong)]">
                  <div className="hidden grid-cols-[minmax(240px,2fr)_120px_120px_120px_140px_64px] items-center gap-4 bg-[color:var(--surface-soft)] px-4 py-3 text-sm font-medium text-[color:var(--muted)] md:grid">
                    <div>Item</div>
                    <div>Stock</div>
                    <div>Quantity</div>
                    <div>Cost</div>
                    <div>Total</div>
                    <div />
                  </div>

                  <div className="divide-y divide-slate-200">
                    {purchaseOrderForm.items.map((item) => {
                      const stock =
                        selectedWarehouse && item.itemName
                          ? stockLookup.get(`${selectedWarehouse.name}::${item.itemName}`) ?? 0
                          : 0
                      const lineTotal =
                        Number.isFinite(Number(item.quantity)) && Number.isFinite(Number(item.cost))
                          ? Number(item.quantity) * Number(item.cost)
                          : 0

                      return (
                        <div
                          key={item.id}
                          className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(240px,2fr)_120px_120px_120px_140px_64px] md:items-center"
                        >
                          <div className="space-y-2 md:space-y-0">
                            <span className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--muted)] md:hidden">
                              Item
                            </span>
                            <select
                              value={item.itemName}
                              onChange={(event) =>
                                updatePurchaseOrderItem(item.id, (current) => ({
                                  ...current,
                                  itemName: event.target.value,
                                }))
                              }
                              className="h-11 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                            >
                              <option value="">Select Item</option>
                              {itemOptions.map((itemOption) => (
                                <option key={itemOption} value={itemOption}>
                                  {itemOption}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2 md:space-y-0">
                            <span className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--muted)] md:hidden">
                              Stock
                            </span>
                            <p className="text-sm font-medium text-red-500">{stock}</p>
                          </div>
                          <div className="space-y-2 md:space-y-0">
                            <span className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--muted)] md:hidden">
                              Quantity
                            </span>
                            <input
                              value={item.quantity}
                              onChange={(event) =>
                                updatePurchaseOrderItem(item.id, (current) => ({
                                  ...current,
                                  quantity: event.target.value,
                                }))
                              }
                              className="h-11 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                              inputMode="decimal"
                            />
                          </div>
                          <div className="space-y-2 md:space-y-0">
                            <span className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--muted)] md:hidden">
                              Cost
                            </span>
                            <input
                              value={item.cost}
                              onChange={(event) =>
                                updatePurchaseOrderItem(item.id, (current) => ({
                                  ...current,
                                  cost: event.target.value,
                                }))
                              }
                              className="h-11 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                              inputMode="decimal"
                            />
                          </div>
                          <div className="space-y-2 md:space-y-0">
                            <span className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--muted)] md:hidden">
                              Total
                            </span>
                            <p className="text-sm font-semibold text-slate-950">
                              {formatCurrency(Number(lineTotal.toFixed(2)))}
                            </p>
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => removePurchaseOrderItem(item.id)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border)] text-[color:var(--muted)] transition hover:bg-[color:var(--surface-soft)] hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Note</span>
                <textarea
                  value={purchaseOrderForm.note}
                  onChange={(event) =>
                    setPurchaseOrderForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  className="min-h-[110px] w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                  placeholder="Add procurement or receiving notes"
                />
              </label>

              <div className="flex flex-col gap-3 border-t border-[color:var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[color:var(--muted)]">
                  Draft total: <span className="font-semibold text-slate-950">{formatCurrency(Number(purchaseOrderTotal.toFixed(2)))}</span>
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={closePurchaseOrderForm}
                    className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={savePurchaseOrder}
                    className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Save Purchase Order
                  </button>
                </div>
              </div>
            </div>
          </InventoryModalFrame>
        ) : null}
      </div>
    </InventoryShell>
  )
}
