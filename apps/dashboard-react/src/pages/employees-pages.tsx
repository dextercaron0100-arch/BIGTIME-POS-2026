import type { EmployeeSummary } from '@apex-pos/shared-types'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { type Dispatch, type PropsWithChildren, type SetStateAction, useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PageHeader } from '../components/ui/page-header'
import { SectionCard } from '../components/ui/section-card'
import { StatusPill } from '../components/ui/status-pill'
import { useEmployees } from '../hooks/use-employees'
import { fetchManagedBranches, type ManagedBranch } from '../lib/api-client'
import { formatCurrency, formatDateTime } from '../lib/utils'
import { useUiStore } from '../store/ui-store'

const employeePhotoLimitBytes = 1_500_000

type EmployeeNotice = {
  tone: 'success' | 'error' | 'info'
  message: string
}

type EmployeeRecord = {
  id: string
  branchId: string
  fullName: string
  position: string
  rate: number
  hoursThisWeek: number
  active: boolean
  photoDataUrl: string
}

type EmployeeBranchOption = Pick<ManagedBranch, 'id' | 'name'>

type EmployeeForm = {
  branchId: string
  fullName: string
  position: string
  rate: string
  hoursThisWeek: string
  active: boolean
  photoDataUrl: string
}

type EmployeeTimeCardEntry = {
  id: string
  employeeId: string
  clockIn: string
  clockOut: string | null
  breakMinutes: number
  status: 'OPEN' | 'CLOSED'
  note: string
  countsTowardHours: boolean
}

type EmployeeTimeCardForm = {
  employeeId: string
  clockIn: string
  clockOut: string
  breakMinutes: string
  status: 'OPEN' | 'CLOSED'
  note: string
  countsTowardHours: boolean
}

type EmployeeStore = {
  employees: EmployeeRecord[]
  seededBranches: string[]
  ensureEmployees: (scopeId: string, rows: EmployeeRecord[]) => void
  updateEmployees: (updater: (rows: EmployeeRecord[]) => EmployeeRecord[]) => void
}

type EmployeeTimeCardStore = {
  entries: EmployeeTimeCardEntry[]
  seeded: boolean
  ensureEntries: (rows: EmployeeTimeCardEntry[]) => void
  updateEntries: (
    updater: (rows: EmployeeTimeCardEntry[]) => EmployeeTimeCardEntry[],
  ) => void
}

const defaultEmployeeBranchOptions: EmployeeBranchOption[] = [
  { id: 'branch-manila', name: 'Manila Flagship' },
  { id: 'branch-cebu', name: 'Cebu Ayala' },
  { id: 'branch-davao', name: 'Davao Downtown' },
]

const timeCardSeedEntries: EmployeeTimeCardEntry[] = []

const useEmployeeStore = create<EmployeeStore>()(
  persist(
    (set) => ({
      employees: [],
      seededBranches: [],
      ensureEmployees: (scopeId, rows) =>
        set((state) => {
          if (rows.length === 0) {
            return state
          }

          const nextSeededBranches =
            scopeId === 'all'
              ? [...new Set(rows.map((employee) => employee.branchId))]
              : [scopeId]
          const missingBranches = nextSeededBranches.filter(
            (branchId) => !state.seededBranches.includes(branchId),
          )

          if (missingBranches.length === 0) {
            return state
          }

          const existingIds = new Set(state.employees.map((employee) => employee.id))
          const nextRows = rows.filter(
            (employee) =>
              missingBranches.includes(employee.branchId) && !existingIds.has(employee.id),
          )

          return {
            employees: [...state.employees, ...nextRows],
            seededBranches: [...state.seededBranches, ...missingBranches],
          }
        }),
      updateEmployees: (updater) =>
        set((state) => ({
          employees: updater(state.employees),
        })),
    }),
    {
      name: 'bigtime-pos-employee-directory-v2',
      partialize: (state) => ({
        employees: state.employees,
        seededBranches: state.seededBranches,
      }),
    },
  ),
)

const useEmployeeTimeCardStore = create<EmployeeTimeCardStore>()(
  persist(
    (set) => ({
      entries: [],
      seeded: false,
      ensureEntries: (rows) =>
        set((state) => {
          if (rows.length === 0 || state.seeded) {
            return state
          }

          const existingIds = new Set(state.entries.map((entry) => entry.id))
          const nextRows = rows.filter((entry) => !existingIds.has(entry.id))

          return {
            entries: [...state.entries, ...nextRows],
            seeded: true,
          }
        }),
      updateEntries: (updater) =>
        set((state) => ({
          entries: updater(state.entries),
        })),
    }),
    {
      name: 'bigtime-pos-employee-time-cards-v2',
      partialize: (state) => ({
        entries: state.entries,
        seeded: state.seeded,
      }),
    },
  ),
)

function normalizeEmployeeRows(rows: EmployeeSummary[]): EmployeeRecord[] {
  return rows.map((employee) => ({
    id: employee.id,
    branchId: employee.branchId,
    fullName: employee.fullName,
    position: employee.position,
    rate: employee.rate,
    hoursThisWeek: employee.hoursThisWeek,
    active: true,
    photoDataUrl: '',
  }))
}

function fallbackEmployeeBranchName(branchId: string) {
  const knownBranch = defaultEmployeeBranchOptions.find((branch) => branch.id === branchId)

  if (knownBranch) {
    return knownBranch.name
  }

  return branchId
    .replace(/^branch-/, '')
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function buildEmployeeBranchOptions(
  managedBranches: ManagedBranch[],
  employees: EmployeeRecord[],
  selectedBranch: string,
) {
  const options = new Map<string, EmployeeBranchOption>()

  for (const branch of managedBranches) {
    if (!branch.id) {
      continue
    }

    options.set(branch.id, {
      id: branch.id,
      name: branch.name.trim() || fallbackEmployeeBranchName(branch.id),
    })
  }

  for (const employee of employees) {
    if (!employee.branchId || options.has(employee.branchId)) {
      continue
    }

    options.set(employee.branchId, {
      id: employee.branchId,
      name: fallbackEmployeeBranchName(employee.branchId),
    })
  }

  if (selectedBranch !== 'all' && !options.has(selectedBranch)) {
    options.set(selectedBranch, {
      id: selectedBranch,
      name: fallbackEmployeeBranchName(selectedBranch),
    })
  }

  if (options.size === 0) {
    for (const branch of defaultEmployeeBranchOptions) {
      options.set(branch.id, branch)
    }
  }

  return Array.from(options.values())
}

function useEmployeeBranchOptions(selectedBranch: string, employees: EmployeeRecord[]) {
  const branchesQuery = useQuery({
    queryKey: ['managed-branches'],
    queryFn: async () => {
      try {
        return await fetchManagedBranches()
      } catch {
        return [] as ManagedBranch[]
      }
    },
  })

  return useMemo(
    () => buildEmployeeBranchOptions(branchesQuery.data ?? [], employees, selectedBranch),
    [branchesQuery.data, employees, selectedBranch],
  )
}

function resolveEmployeeBranchName(
  branchId: string,
  branchOptions: EmployeeBranchOption[],
) {
  return (
    branchOptions.find((branch) => branch.id === branchId)?.name ??
    fallbackEmployeeBranchName(branchId)
  )
}

function createEmployeeId() {
  return `employee-${Date.now()}-${Math.floor(Math.random() * 100_000)}`
}

function createTimeCardId() {
  return `time-card-${Date.now()}-${Math.floor(Math.random() * 100_000)}`
}

function emptyEmployeeForm(
  branchId: string,
  branchOptions: EmployeeBranchOption[],
): EmployeeForm {
  return {
    branchId: branchId !== 'all' ? branchId : branchOptions[0]?.id ?? 'branch-manila',
    fullName: '',
    position: '',
    rate: '',
    hoursThisWeek: '',
    active: true,
    photoDataUrl: '',
  }
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const pad = (input: number) => String(input).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toIsoFromLocalValue(value: string) {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

function emptyTimeCardForm(employeeId = ''): EmployeeTimeCardForm {
  return {
    employeeId,
    clockIn: '',
    clockOut: '',
    breakMinutes: '0',
    status: 'CLOSED',
    note: '',
    countsTowardHours: true,
  }
}

function calculateTimeCardHours(entry: EmployeeTimeCardEntry) {
  const startAt = new Date(entry.clockIn).getTime()
  const endAt = new Date(entry.clockOut ?? new Date().toISOString()).getTime()

  if (Number.isNaN(startAt) || Number.isNaN(endAt) || endAt <= startAt) {
    return 0
  }

  const durationHours = (endAt - startAt) / 3_600_000 - entry.breakMinutes / 60
  return Math.max(0, Number(durationHours.toFixed(2)))
}

function formatHoursValue(value: number) {
  return `${value.toFixed(2)} hrs`
}

function getEmployeeInitials(fullName: string) {
  return (
    fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'EM'
  )
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Unable to read image.'))
    }

    reader.onerror = () => {
      reject(new Error('Unable to read image.'))
    }

    reader.readAsDataURL(file)
  })
}

function useNoticeTimeout(notice: EmployeeNotice | null, onClear: () => void) {
  useEffect(() => {
    if (!notice) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      onClear()
    }, 3200)

    return () => window.clearTimeout(timeoutId)
  }, [notice, onClear])
}

function employeeStatusTone(active: boolean): 'success' | 'neutral' {
  return active ? 'success' : 'neutral'
}

function timeCardTone(status: EmployeeTimeCardEntry['status']): 'success' | 'warning' {
  return status === 'CLOSED' ? 'success' : 'warning'
}

function EmployeeShell({
  eyebrow,
  title,
  description,
  children,
}: PropsWithChildren<{
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

function EmployeeNoticeBanner({ notice }: { notice: EmployeeNotice }) {
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

function EmployeeAvatar({
  fullName,
  photoDataUrl,
  sizeClassName = 'h-12 w-12',
  labelClassName = 'text-sm',
}: {
  fullName: string
  photoDataUrl: string
  sizeClassName?: string
  labelClassName?: string
}) {
  if (photoDataUrl) {
    return (
      <img
        src={photoDataUrl}
        alt={fullName}
        className={`${sizeClassName} rounded-2xl object-cover shadow-sm`}
      />
    )
  }

  return (
    <div
      className={`${sizeClassName} inline-flex items-center justify-center rounded-2xl bg-[color:var(--header-tint)] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)] ${labelClassName}`}
    >
      {getEmployeeInitials(fullName)}
    </div>
  )
}

function EmployeeModalFrame({
  title,
  description,
  onClose,
  children,
}: PropsWithChildren<{
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
        <div className="max-h-[72vh] overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  )
}

function EmployeeDirectoryForm({
  branchOptions,
  form,
  setForm,
  onPhotoSelect,
  onPhotoRemove,
  onCancel,
  onSubmit,
  submitLabel,
}: {
  branchOptions: EmployeeBranchOption[]
  form: EmployeeForm
  setForm: Dispatch<SetStateAction<EmployeeForm>>
  onPhotoSelect: (file: File | null) => void
  onPhotoRemove: () => void
  onCancel: () => void
  onSubmit: () => void
  submitLabel: string
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-soft)]/80 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <EmployeeAvatar
            fullName={form.fullName || 'New Employee'}
            photoDataUrl={form.photoDataUrl}
            sizeClassName="h-24 w-24"
            labelClassName="text-lg"
          />
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Employee Photo</p>
            <p className="text-sm text-[color:var(--muted)]">
              Upload a headshot or profile image. Max file size: 1.5 MB.
            </p>
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]">
                <Plus className="h-4 w-4" />
                Upload Photo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => onPhotoSelect(event.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </label>
              {form.photoDataUrl ? (
                <button
                  type="button"
                  onClick={onPhotoRemove}
                  className="rounded-2xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  Remove Photo
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Branch</span>
          <select
            value={form.branchId}
            onChange={(event) =>
              setForm((current) => ({ ...current, branchId: event.target.value }))
            }
            className="h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
          >
            {branchOptions.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Position</span>
          <input
            value={form.position}
            onChange={(event) =>
              setForm((current) => ({ ...current, position: event.target.value }))
            }
            className="h-12 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
            placeholder="Cashier, Supervisor, Stock Clerk"
          />
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Full Name</span>
          <input
            value={form.fullName}
            onChange={(event) =>
              setForm((current) => ({ ...current, fullName: event.target.value }))
            }
            className="h-12 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
            placeholder="Employee full name"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Daily Rate</span>
          <input
            value={form.rate}
            onChange={(event) =>
              setForm((current) => ({ ...current, rate: event.target.value }))
            }
            className="h-12 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
            inputMode="decimal"
            placeholder="0.00"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Hours This Week</span>
          <input
            value={form.hoursThisWeek}
            onChange={(event) =>
              setForm((current) => ({ ...current, hoursThisWeek: event.target.value }))
            }
            className="h-12 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
            inputMode="decimal"
            placeholder="0.00"
          />
        </label>
      </div>

      <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] px-4 py-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(event) =>
            setForm((current) => ({ ...current, active: event.target.checked }))
          }
          className="h-4 w-4 rounded border-slate-300"
        />
        Active employee record
      </label>

      <div className="flex flex-col gap-3 border-t border-[color:var(--border)] pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  )
}

function EmployeeTimeCardFormFields({
  employees,
  form,
  setForm,
  onCancel,
  onSubmit,
  submitLabel,
}: {
  employees: EmployeeRecord[]
  form: EmployeeTimeCardForm
  setForm: Dispatch<SetStateAction<EmployeeTimeCardForm>>
  onCancel: () => void
  onSubmit: () => void
  submitLabel: string
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Employee</span>
          <select
            value={form.employeeId}
            onChange={(event) =>
              setForm((current) => ({ ...current, employeeId: event.target.value }))
            }
            className="h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
          >
            <option value="">Select employee</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName} · {employee.position}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Status</span>
          <select
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                status: event.target.value as EmployeeTimeCardForm['status'],
                clockOut: event.target.value === 'OPEN' ? '' : current.clockOut,
                countsTowardHours:
                  event.target.value === 'OPEN' ? false : current.countsTowardHours,
              }))
            }
            className="h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
          >
            <option value="CLOSED">Closed</option>
            <option value="OPEN">Open</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Break Minutes</span>
          <input
            value={form.breakMinutes}
            onChange={(event) =>
              setForm((current) => ({ ...current, breakMinutes: event.target.value }))
            }
            className="h-12 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
            inputMode="numeric"
            placeholder="0"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Clock In</span>
          <input
            type="datetime-local"
            value={form.clockIn}
            onChange={(event) =>
              setForm((current) => ({ ...current, clockIn: event.target.value }))
            }
            className="h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Clock Out</span>
          <input
            type="datetime-local"
            value={form.clockOut}
            onChange={(event) =>
              setForm((current) => ({ ...current, clockOut: event.target.value }))
            }
            disabled={form.status === 'OPEN'}
            className="h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300 disabled:cursor-not-allowed disabled:bg-[color:var(--surface-soft)] disabled:text-[color:var(--muted)]"
          />
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-medium text-slate-700">Note</span>
        <textarea
          value={form.note}
          onChange={(event) =>
            setForm((current) => ({ ...current, note: event.target.value }))
          }
          className="min-h-[110px] w-full rounded-2xl border border-[color:var(--border)] px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-300"
          placeholder="Add time card notes or shift context"
        />
      </label>

      <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] px-4 py-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.countsTowardHours}
          disabled={form.status === 'OPEN'}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              countsTowardHours: event.target.checked,
            }))
          }
          className="h-4 w-4 rounded border-slate-300"
        />
        Include this entry in work-hour totals
      </label>

      <div className="flex flex-col gap-3 border-t border-[color:var(--border)] pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  )
}

function normalizeTimeCardForm(form: EmployeeTimeCardForm): EmployeeTimeCardEntry | null {
  const clockIn = toIsoFromLocalValue(form.clockIn)
  const clockOut = form.status === 'OPEN' ? null : toIsoFromLocalValue(form.clockOut)
  const breakMinutes = Number(form.breakMinutes)

  if (!form.employeeId || !clockIn || !Number.isFinite(breakMinutes) || breakMinutes < 0) {
    return null
  }

  if (form.status === 'CLOSED' && !clockOut) {
    return null
  }

  if (clockOut && new Date(clockOut).getTime() <= new Date(clockIn).getTime()) {
    return null
  }

  return {
    id: createTimeCardId(),
    employeeId: form.employeeId,
    clockIn,
    clockOut,
    breakMinutes,
    status: form.status,
    note: form.note.trim(),
    countsTowardHours: form.status === 'CLOSED' ? form.countsTowardHours : false,
  }
}

export function EmployeeDirectoryPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch)
  const employeeQuery = useEmployees(selectedBranch)
  const employees = useEmployeeStore((state) => state.employees)
  const branchOptions = useEmployeeBranchOptions(selectedBranch, employees)
  const ensureEmployees = useEmployeeStore((state) => state.ensureEmployees)
  const updateEmployees = useEmployeeStore((state) => state.updateEmployees)
  const ensureEntries = useEmployeeTimeCardStore((state) => state.ensureEntries)
  const updateTimeCards = useEmployeeTimeCardStore((state) => state.updateEntries)
  const timeCards = useEmployeeTimeCardStore((state) => state.entries)
  const [searchValue, setSearchValue] = useState('')
  const [notice, setNotice] = useState<EmployeeNotice | null>(null)
  const [dialogMode, setDialogMode] = useState<'add' | 'edit' | null>(null)
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>(() =>
    emptyEmployeeForm(selectedBranch, branchOptions),
  )

  useEffect(() => {
    ensureEmployees(selectedBranch, normalizeEmployeeRows(employeeQuery.data ?? []))
  }, [employeeQuery.data, ensureEmployees, selectedBranch])

  useEffect(() => {
    ensureEntries(timeCardSeedEntries)
  }, [ensureEntries])

  useNoticeTimeout(notice, () => setNotice(null))

  const visibleEmployees = useMemo(() => {
    const branchScoped =
      selectedBranch === 'all'
        ? employees
        : employees.filter((employee) => employee.branchId === selectedBranch)
    const query = searchValue.trim().toLowerCase()

    if (!query) {
      return branchScoped
    }

    return branchScoped.filter((employee) =>
      [
        employee.fullName,
        employee.position,
        resolveEmployeeBranchName(employee.branchId, branchOptions),
        employee.active ? 'active' : 'inactive',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [branchOptions, employees, searchValue, selectedBranch])

  const effectiveEmployeeBranchId =
    employeeForm.branchId && branchOptions.some((branch) => branch.id === employeeForm.branchId)
      ? employeeForm.branchId
      : (branchOptions[0]?.id ?? 'branch-manila')

  const activeCount = visibleEmployees.filter((employee) => employee.active).length
  const inactiveCount = visibleEmployees.length - activeCount
  const totalBaseHours = visibleEmployees.reduce(
    (sum, employee) => sum + employee.hoursThisWeek,
    0,
  )

  function openAddDialog() {
    setEditingEmployeeId(null)
    setEmployeeForm(emptyEmployeeForm(selectedBranch, branchOptions))
    setDialogMode('add')
  }

  function openEditDialog(employee: EmployeeRecord) {
    setEditingEmployeeId(employee.id)
    setEmployeeForm({
      branchId: employee.branchId,
      fullName: employee.fullName,
      position: employee.position,
      rate: String(employee.rate),
      hoursThisWeek: String(employee.hoursThisWeek),
      active: employee.active,
      photoDataUrl: employee.photoDataUrl,
    })
    setDialogMode('edit')
  }

  function closeDialog() {
    setDialogMode(null)
    setEditingEmployeeId(null)
  }

  async function handlePhotoSelect(file: File | null) {
    if (!file) {
      return
    }

    if (file.size > employeePhotoLimitBytes) {
      setNotice({
        tone: 'error',
        message: 'Employee photo must be 1.5 MB or smaller.',
      })
      return
    }

    try {
      const photoDataUrl = await readFileAsDataUrl(file)
      setEmployeeForm((current) => ({
        ...current,
        photoDataUrl,
      }))
    } catch {
      setNotice({
        tone: 'error',
        message: 'The selected photo could not be uploaded.',
      })
    }
  }

  function removePhoto() {
    setEmployeeForm((current) => ({
      ...current,
      photoDataUrl: '',
    }))
  }

  function saveEmployee() {
    const fullName = employeeForm.fullName.trim()
    const position = employeeForm.position.trim()
    const rate = Number(employeeForm.rate)
    const hoursThisWeek = Number(employeeForm.hoursThisWeek)

    if (
      !fullName ||
      !position ||
      !Number.isFinite(rate) ||
      rate < 0 ||
      !Number.isFinite(hoursThisWeek) ||
      hoursThisWeek < 0
    ) {
      setNotice({
        tone: 'error',
        message: 'Full name, position, rate, and weekly hours are required.',
      })
      return
    }

    const duplicateName = employees.some(
      (employee) =>
        employee.id !== editingEmployeeId &&
        employee.branchId === effectiveEmployeeBranchId &&
        employee.fullName.trim().toLowerCase() === fullName.toLowerCase(),
    )

    if (duplicateName) {
      setNotice({
        tone: 'error',
        message: 'That employee name already exists for the selected branch.',
      })
      return
    }

    const nextEmployee: EmployeeRecord = {
      id: editingEmployeeId ?? createEmployeeId(),
      branchId: effectiveEmployeeBranchId,
      fullName,
      position,
      rate: Number(rate.toFixed(2)),
      hoursThisWeek: Number(hoursThisWeek.toFixed(2)),
      active: employeeForm.active,
      photoDataUrl: employeeForm.photoDataUrl,
    }

    updateEmployees((current) =>
      dialogMode === 'edit'
        ? current.map((employee) =>
            employee.id === editingEmployeeId ? nextEmployee : employee,
          )
        : [nextEmployee, ...current],
    )

    setNotice({
      tone: 'success',
      message:
        dialogMode === 'edit'
          ? `${nextEmployee.fullName} was updated.`
          : `${nextEmployee.fullName} was added to employees.`,
    })
    closeDialog()
  }

  function toggleEmployeeActive(employee: EmployeeRecord) {
    updateEmployees((current) =>
      current.map((currentEmployee) =>
        currentEmployee.id === employee.id
          ? { ...currentEmployee, active: !currentEmployee.active }
          : currentEmployee,
      ),
    )
    setNotice({
      tone: 'success',
      message: `${employee.fullName} is now ${employee.active ? 'inactive' : 'active'}.`,
    })
  }

  function deleteEmployee(employee: EmployeeRecord) {
    const confirmed = window.confirm(`Delete ${employee.fullName}?`)

    if (!confirmed) {
      return
    }

    updateEmployees((current) =>
      current.filter((currentEmployee) => currentEmployee.id !== employee.id),
    )
    updateTimeCards((current) =>
      current.filter((entry) => entry.employeeId !== employee.id),
    )
    setNotice({
      tone: 'success',
      message: `${employee.fullName} and linked time cards were removed.`,
    })
  }

  return (
    <EmployeeShell
      eyebrow="Employees"
      title="Employees"
      description="Maintain employee records, branch assignments, rates, and roster status before they clock in on the POS."
    >
      <div className="space-y-6">
        {notice ? <EmployeeNoticeBanner notice={notice} /> : null}

        <SectionCard
          title="Employee directory"
          description="Add, update, activate, or archive employee records across all branches."
          action={
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <label className="relative min-w-[260px]">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
                <input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search employee, role, branch"
                  className="h-11 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                />
              </label>
              <button
                type="button"
                onClick={openAddDialog}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Add Employee
              </button>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl bg-[color:var(--surface-soft)] p-4">
              <p className="text-sm text-[color:var(--muted)]">Visible employees</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{visibleEmployees.length}</p>
            </div>
            <div className="rounded-3xl bg-[color:var(--surface-soft)] p-4">
              <p className="text-sm text-[color:var(--muted)]">Active roster</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{activeCount}</p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">{inactiveCount} inactive</p>
            </div>
            <div className="rounded-3xl bg-[color:var(--surface-soft)] p-4">
              <p className="text-sm text-[color:var(--muted)]">Base hours this week</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">
                {formatHoursValue(totalBaseHours)}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {visibleEmployees.map((employee) => {
              const linkedTimeCards = timeCards.filter(
                (entry) => entry.employeeId === employee.id,
              ).length

              return (
                <article key={employee.id} className="rounded-3xl bg-[color:var(--surface-soft)] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <EmployeeAvatar
                        fullName={employee.fullName}
                        photoDataUrl={employee.photoDataUrl}
                      />
                      <div>
                        <p className="section-title text-lg font-bold text-slate-950">
                          {employee.fullName}
                        </p>
                        <p className="text-sm text-[color:var(--muted)]">
                          {employee.position} -{' '}
                          {resolveEmployeeBranchName(employee.branchId, branchOptions)}
                        </p>
                      </div>
                    </div>
                    <StatusPill
                      tone={employeeStatusTone(employee.active)}
                      label={employee.active ? 'ACTIVE' : 'INACTIVE'}
                    />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-[color:var(--surface-soft)] p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Rate</p>
                      <p className="mt-2 font-semibold text-slate-950">
                        {formatCurrency(employee.rate)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[color:var(--surface-soft)] p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        Hours
                      </p>
                      <p className="mt-2 font-semibold text-slate-950">
                        {formatHoursValue(employee.hoursThisWeek)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[color:var(--surface-soft)] p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        Time Cards
                      </p>
                      <p className="mt-2 font-semibold text-slate-950">{linkedTimeCards}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => openEditDialog(employee)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleEmployeeActive(employee)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
                    >
                      {employee.active ? 'Set Inactive' : 'Set Active'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteEmployee(employee)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </article>
              )
            })}
          </div>

          {visibleEmployees.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-8 text-center text-sm text-[color:var(--muted)]">
              No employee records match the current search and branch filter.
            </div>
          ) : null}
        </SectionCard>
      </div>

      {dialogMode ? (
        <EmployeeModalFrame
          title={dialogMode === 'edit' ? 'Edit employee' : 'Add employee'}
          description="Capture the employee profile details used across work hours and time-card tracking."
          onClose={closeDialog}
        >
          <EmployeeDirectoryForm
            branchOptions={branchOptions}
            form={{ ...employeeForm, branchId: effectiveEmployeeBranchId }}
            setForm={setEmployeeForm}
            onPhotoSelect={handlePhotoSelect}
            onPhotoRemove={removePhoto}
            onCancel={closeDialog}
            onSubmit={saveEmployee}
            submitLabel={dialogMode === 'edit' ? 'Save Changes' : 'Add Employee'}
          />
        </EmployeeModalFrame>
      ) : null}
    </EmployeeShell>
  )
}
export function EmployeeWorkHoursPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch)
  const employeeQuery = useEmployees(selectedBranch)
  const employees = useEmployeeStore((state) => state.employees)
  const branchOptions = useEmployeeBranchOptions(selectedBranch, employees)
  const ensureEmployees = useEmployeeStore((state) => state.ensureEmployees)
  const timeCards = useEmployeeTimeCardStore((state) => state.entries)
  const ensureEntries = useEmployeeTimeCardStore((state) => state.ensureEntries)
  const updateEntries = useEmployeeTimeCardStore((state) => state.updateEntries)
  const [searchValue, setSearchValue] = useState('')
  const [notice, setNotice] = useState<EmployeeNotice | null>(null)
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false)
  const [workLogForm, setWorkLogForm] = useState<EmployeeTimeCardForm>(emptyTimeCardForm())

  useEffect(() => {
    ensureEmployees(selectedBranch, normalizeEmployeeRows(employeeQuery.data ?? []))
  }, [employeeQuery.data, ensureEmployees, selectedBranch])

  useEffect(() => {
    ensureEntries(timeCardSeedEntries)
  }, [ensureEntries])

  useNoticeTimeout(notice, () => setNotice(null))

  const visibleEmployees = useMemo(() => {
    const branchScoped =
      selectedBranch === 'all'
        ? employees
        : employees.filter((employee) => employee.branchId === selectedBranch)
    const query = searchValue.trim().toLowerCase()

    if (!query) {
      return branchScoped
    }

    return branchScoped.filter((employee) =>
      [
        employee.fullName,
        employee.position,
        resolveEmployeeBranchName(employee.branchId, branchOptions),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [branchOptions, employees, searchValue, selectedBranch])

  const hourSummaries = useMemo(() => {
    const grouped = new Map<string, number>()

    for (const entry of timeCards) {
      if (!entry.countsTowardHours || entry.status !== 'CLOSED') {
        continue
      }

      const currentHours = grouped.get(entry.employeeId) ?? 0
      grouped.set(entry.employeeId, currentHours + calculateTimeCardHours(entry))
    }

    return grouped
  }, [timeCards])

  const loggedHoursTotal = Array.from(hourSummaries.values()).reduce(
    (sum, hours) => sum + hours,
    0,
  )

  const combinedHoursTotal = visibleEmployees.reduce(
    (sum, employee) => sum + employee.hoursThisWeek + (hourSummaries.get(employee.id) ?? 0),
    0,
  )

  function openLogDialog() {
    setWorkLogForm(emptyTimeCardForm(visibleEmployees[0]?.id ?? ''))
    setIsLogDialogOpen(true)
  }

  function closeLogDialog() {
    setWorkLogForm(emptyTimeCardForm())
    setIsLogDialogOpen(false)
  }

  function saveWorkLog() {
    const normalized = normalizeTimeCardForm({
      ...workLogForm,
      status: 'CLOSED',
      countsTowardHours: true,
    })

    if (!normalized) {
      setNotice({
        tone: 'error',
        message: 'Employee, clock in, clock out, and valid break minutes are required.',
      })
      return
    }

    updateEntries((current) => [{ ...normalized, countsTowardHours: true }, ...current])
    const employeeName =
      employees.find((employee) => employee.id === normalized.employeeId)?.fullName ??
      'Employee'

    setNotice({
      tone: 'success',
      message: `Work log added for ${employeeName}.`,
    })
    closeLogDialog()
  }

  return (
    <EmployeeShell
      eyebrow="Employees"
      title="Work Hours"
      description="Track base roster hours with supplemental work logs so payroll and staffing can be reviewed by branch."
    >
      <div className="space-y-6">
        {notice ? <EmployeeNoticeBanner notice={notice} /> : null}

        <SectionCard
          title="Work-hour ledger"
          description="Base weekly hours come from employee records. Extra logged entries below are added from the work-log tool."
          action={
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <label className="relative min-w-[260px]">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
                <input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search employee or role"
                  className="h-11 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                />
              </label>
              <button
                type="button"
                onClick={openLogDialog}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Add Work Log
              </button>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl bg-[color:var(--surface-soft)] p-4">
              <p className="text-sm text-[color:var(--muted)]">Visible employees</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{visibleEmployees.length}</p>
            </div>
            <div className="rounded-3xl bg-[color:var(--surface-soft)] p-4">
              <p className="text-sm text-[color:var(--muted)]">Extra logged hours</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">
                {formatHoursValue(loggedHoursTotal)}
              </p>
            </div>
            <div className="rounded-3xl bg-[color:var(--surface-soft)] p-4">
              <p className="text-sm text-[color:var(--muted)]">Combined hours</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">
                {formatHoursValue(combinedHoursTotal)}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {visibleEmployees.map((employee) => {
              const extraHours = hourSummaries.get(employee.id) ?? 0
              const totalHours = employee.hoursThisWeek + extraHours
              const estimatedPay = (employee.rate / 8) * totalHours
              const latestLog = timeCards
                .filter(
                  (entry) =>
                    entry.employeeId === employee.id &&
                    entry.countsTowardHours &&
                    entry.status === 'CLOSED',
                )
                .sort(
                  (left, right) =>
                    new Date(right.clockOut ?? right.clockIn).getTime() -
                    new Date(left.clockOut ?? left.clockIn).getTime(),
                )[0]

              return (
                <article key={employee.id} className="rounded-3xl bg-[color:var(--surface-soft)] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <EmployeeAvatar
                        fullName={employee.fullName}
                        photoDataUrl={employee.photoDataUrl}
                      />
                      <div>
                        <p className="section-title text-lg font-bold text-slate-950">
                          {employee.fullName}
                        </p>
                        <p className="text-sm text-[color:var(--muted)]">
                          {employee.position} -{' '}
                          {resolveEmployeeBranchName(employee.branchId, branchOptions)}
                        </p>
                      </div>
                    </div>
                    <StatusPill
                      tone={employeeStatusTone(employee.active)}
                      label={employee.active ? 'ACTIVE' : 'INACTIVE'}
                    />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl bg-[color:var(--surface-soft)] p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        Base Hours
                      </p>
                      <p className="mt-2 font-semibold text-slate-950">
                        {formatHoursValue(employee.hoursThisWeek)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[color:var(--surface-soft)] p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        Extra Logs
                      </p>
                      <p className="mt-2 font-semibold text-slate-950">
                        {formatHoursValue(extraHours)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[color:var(--surface-soft)] p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        Total Hours
                      </p>
                      <p className="mt-2 font-semibold text-slate-950">
                        {formatHoursValue(totalHours)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[color:var(--surface-soft)] p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        Est. Pay
                      </p>
                      <p className="mt-2 font-semibold text-slate-950">
                        {formatCurrency(Number(estimatedPay.toFixed(2)))}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-3 text-sm text-[color:var(--muted)]">
                    {latestLog ? (
                      <span>
                        Latest counted log closed{' '}
                        {formatDateTime(latestLog.clockOut ?? latestLog.clockIn)}
                      </span>
                    ) : (
                      <span>No additional work logs counted yet.</span>
                    )}
                  </div>
                </article>
              )
            })}
          </div>

          {visibleEmployees.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-8 text-center text-sm text-[color:var(--muted)]">
              No work-hour profiles match the current filter.
            </div>
          ) : null}
        </SectionCard>
      </div>

      {isLogDialogOpen ? (
        <EmployeeModalFrame
          title="Add work log"
          description="Closed work logs are added to work-hour totals and remain visible in the time-card register."
          onClose={closeLogDialog}
        >
          <EmployeeTimeCardFormFields
            employees={visibleEmployees.length > 0 ? visibleEmployees : employees}
            form={workLogForm}
            setForm={setWorkLogForm}
            onCancel={closeLogDialog}
            onSubmit={saveWorkLog}
            submitLabel="Save Work Log"
          />
        </EmployeeModalFrame>
      ) : null}
    </EmployeeShell>
  )
}

export function EmployeeTimeCardPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch)
  const employeeQuery = useEmployees(selectedBranch)
  const employees = useEmployeeStore((state) => state.employees)
  const branchOptions = useEmployeeBranchOptions(selectedBranch, employees)
  const ensureEmployees = useEmployeeStore((state) => state.ensureEmployees)
  const timeCards = useEmployeeTimeCardStore((state) => state.entries)
  const ensureEntries = useEmployeeTimeCardStore((state) => state.ensureEntries)
  const updateEntries = useEmployeeTimeCardStore((state) => state.updateEntries)
  const [searchValue, setSearchValue] = useState('')
  const [notice, setNotice] = useState<EmployeeNotice | null>(null)
  const [dialogMode, setDialogMode] = useState<'add' | 'edit' | null>(null)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [timeCardForm, setTimeCardForm] = useState<EmployeeTimeCardForm>(emptyTimeCardForm())

  useEffect(() => {
    ensureEmployees(selectedBranch, normalizeEmployeeRows(employeeQuery.data ?? []))
  }, [employeeQuery.data, ensureEmployees, selectedBranch])

  useEffect(() => {
    ensureEntries(timeCardSeedEntries)
  }, [ensureEntries])

  useNoticeTimeout(notice, () => setNotice(null))

  const employeeLookup = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  )

  const availableEmployees = useMemo(
    () =>
      selectedBranch === 'all'
        ? employees
        : employees.filter((employee) => employee.branchId === selectedBranch),
    [employees, selectedBranch],
  )

  const visibleTimeCards = useMemo(() => {
    const branchScoped =
      selectedBranch === 'all'
        ? timeCards
        : timeCards.filter(
            (entry) => employeeLookup.get(entry.employeeId)?.branchId === selectedBranch,
          )

    const query = searchValue.trim().toLowerCase()

    if (!query) {
      return branchScoped
    }

    return branchScoped.filter((entry) => {
      const employee = employeeLookup.get(entry.employeeId)

      return [
        employee?.fullName ?? '',
        employee?.position ?? '',
        entry.status,
        entry.note,
        entry.countsTowardHours ? 'counted' : 'uncounted',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [employeeLookup, searchValue, selectedBranch, timeCards])

  const openEntryCount = visibleTimeCards.filter((entry) => entry.status === 'OPEN').length
  const closedEntryCount = visibleTimeCards.length - openEntryCount

  function openAddDialog() {
    setEditingEntryId(null)
    setTimeCardForm(emptyTimeCardForm(availableEmployees[0]?.id ?? ''))
    setDialogMode('add')
  }

  function openEditDialog(entry: EmployeeTimeCardEntry) {
    setEditingEntryId(entry.id)
    setTimeCardForm({
      employeeId: entry.employeeId,
      clockIn: toDateTimeLocalValue(entry.clockIn),
      clockOut: toDateTimeLocalValue(entry.clockOut),
      breakMinutes: String(entry.breakMinutes),
      status: entry.status,
      note: entry.note,
      countsTowardHours: entry.countsTowardHours,
    })
    setDialogMode('edit')
  }

  function closeDialog() {
    setDialogMode(null)
    setEditingEntryId(null)
    setTimeCardForm(emptyTimeCardForm())
  }

  function saveTimeCard() {
    const clockIn = toIsoFromLocalValue(timeCardForm.clockIn)
    const clockOut =
      timeCardForm.status === 'OPEN' ? null : toIsoFromLocalValue(timeCardForm.clockOut)
    const breakMinutes = Number(timeCardForm.breakMinutes)

    if (
      !timeCardForm.employeeId ||
      !clockIn ||
      !Number.isFinite(breakMinutes) ||
      breakMinutes < 0 ||
      (timeCardForm.status === 'CLOSED' && !clockOut) ||
      (clockOut && new Date(clockOut).getTime() <= new Date(clockIn).getTime())
    ) {
      setNotice({
        tone: 'error',
        message: 'Employee, time range, and break minutes must be valid before saving.',
      })
      return
    }

    const nextEntry: EmployeeTimeCardEntry = {
      id: editingEntryId ?? createTimeCardId(),
      employeeId: timeCardForm.employeeId,
      clockIn,
      clockOut,
      breakMinutes,
      status: timeCardForm.status,
      note: timeCardForm.note.trim(),
      countsTowardHours:
        timeCardForm.status === 'CLOSED' ? timeCardForm.countsTowardHours : false,
    }

    updateEntries((current) =>
      dialogMode === 'edit'
        ? current.map((entry) => (entry.id === editingEntryId ? nextEntry : entry))
        : [nextEntry, ...current],
    )

    const employeeName =
      employeeLookup.get(nextEntry.employeeId)?.fullName ?? 'Employee'

    setNotice({
      tone: 'success',
      message:
        dialogMode === 'edit'
          ? `Time card updated for ${employeeName}.`
          : `Time card added for ${employeeName}.`,
    })
    closeDialog()
  }

  function deleteTimeCard(entry: EmployeeTimeCardEntry) {
    const employeeName = employeeLookup.get(entry.employeeId)?.fullName ?? 'this employee'
    const confirmed = window.confirm(`Delete the time card for ${employeeName}?`)

    if (!confirmed) {
      return
    }

    updateEntries((current) => current.filter((currentEntry) => currentEntry.id !== entry.id))
    setNotice({
      tone: 'success',
      message: 'Time card deleted.',
    })
  }

  return (
    <EmployeeShell
      eyebrow="Employees"
      title="Time Card"
      description="Create, edit, and review clock-in and clock-out records tied to each employee across branches."
    >
      <div className="space-y-6">
        {notice ? <EmployeeNoticeBanner notice={notice} /> : null}

        <SectionCard
          title="Time-card register"
          description="This register handles open and closed time cards, plus whether each entry contributes to work-hour totals."
          action={
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <label className="relative min-w-[280px]">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
                <input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search employee, status, notes"
                  className="h-11 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                />
              </label>
              <button
                type="button"
                onClick={openAddDialog}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Add Time Card
              </button>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl bg-[color:var(--surface-soft)] p-4">
              <p className="text-sm text-[color:var(--muted)]">Visible entries</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{visibleTimeCards.length}</p>
            </div>
            <div className="rounded-3xl bg-[color:var(--surface-soft)] p-4">
              <p className="text-sm text-[color:var(--muted)]">Open cards</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{openEntryCount}</p>
            </div>
            <div className="rounded-3xl bg-[color:var(--surface-soft)] p-4">
              <p className="text-sm text-[color:var(--muted)]">Closed cards</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{closedEntryCount}</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {visibleTimeCards.map((entry) => {
              const employee = employeeLookup.get(entry.employeeId)
              const hours = calculateTimeCardHours(entry)

              return (
                <article key={entry.id} className="rounded-3xl bg-[color:var(--surface-soft)] p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-3">
                      <EmployeeAvatar
                        fullName={employee?.fullName ?? 'Unknown employee'}
                        photoDataUrl={employee?.photoDataUrl ?? ''}
                      />
                      <div>
                        <p className="section-title text-lg font-bold text-slate-950">
                          {employee?.fullName ?? 'Unknown employee'}
                        </p>
                        <p className="text-sm text-[color:var(--muted)]">
                          {employee?.position ?? 'Removed profile'} -{' '}
                          {employee
                            ? resolveEmployeeBranchName(employee.branchId, branchOptions)
                            : 'No branch'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <StatusPill tone={timeCardTone(entry.status)} label={entry.status} />
                      <StatusPill
                        tone={entry.countsTowardHours ? 'success' : 'neutral'}
                        label={entry.countsTowardHours ? 'COUNTED' : 'REFERENCE'}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl bg-[color:var(--surface-soft)] p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        Clock In
                      </p>
                      <p className="mt-2 font-semibold text-slate-950">
                        {formatDateTime(entry.clockIn)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[color:var(--surface-soft)] p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        Clock Out
                      </p>
                      <p className="mt-2 font-semibold text-slate-950">
                        {entry.clockOut ? formatDateTime(entry.clockOut) : 'Open shift'}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[color:var(--surface-soft)] p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        Break Minutes
                      </p>
                      <p className="mt-2 font-semibold text-slate-950">{entry.breakMinutes}</p>
                    </div>
                    <div className="rounded-2xl bg-[color:var(--surface-soft)] p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        Duration
                      </p>
                      <p className="mt-2 font-semibold text-slate-950">
                        {formatHoursValue(hours)}
                      </p>
                    </div>
                  </div>

                  {entry.note ? (
                    <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-3 text-sm text-[color:var(--muted)]">
                      {entry.note}
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => openEditDialog(entry)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTimeCard(entry)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </article>
              )
            })}
          </div>

          {visibleTimeCards.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-8 text-center text-sm text-[color:var(--muted)]">
              No time-card entries match the current filter.
            </div>
          ) : null}
        </SectionCard>
      </div>

      {dialogMode ? (
        <EmployeeModalFrame
          title={dialogMode === 'edit' ? 'Edit time card' : 'Add time card'}
          description="Use open cards for active shifts and closed cards for finalized work sessions."
          onClose={closeDialog}
        >
          <EmployeeTimeCardFormFields
            employees={availableEmployees}
            form={timeCardForm}
            setForm={setTimeCardForm}
            onCancel={closeDialog}
            onSubmit={saveTimeCard}
            submitLabel={dialogMode === 'edit' ? 'Save Changes' : 'Add Time Card'}
          />
        </EmployeeModalFrame>
      ) : null}
    </EmployeeShell>
  )
}

