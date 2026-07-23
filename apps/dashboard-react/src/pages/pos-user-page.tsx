import type { ActiveTerminal } from '@apex-pos/shared-types'
import { ArrowLeft, Eye, EyeOff, Plus, Pencil, Save, UserCircle } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import {
  fetchManagedBranches,
  fetchManagedUsers,
  createManagedUser,
  updateManagedUserStatus,
  type ManagedUser,
} from '../lib/api-client'
import { useDashboardOverview } from '../hooks/use-dashboard-overview'
import { cn } from '../lib/utils'
import { useUiStore } from '../store/ui-store'

type PosUserFormData = {
  employeeCode: string
  fullName: string
  passcode: string
  isActive: boolean
  isAdmin: boolean
  assignedDevice: string
  accessInventory: boolean
  allowBackOffice: boolean
  allowCustomerDetails: boolean
  listingAccess: boolean
  allowDiscount: boolean
  allowRefund: boolean
  openCashDrawer: boolean
  viewExpectedAmount: boolean
}

function getPosUserFormError(form: PosUserFormData) {
  const employeeCode = form.employeeCode.trim()
  const fullName = form.fullName.trim()
  const passcode = form.passcode.trim()

  if (employeeCode.length < 3) {
    return 'Employee code must be at least 3 characters.'
  }

  if (fullName.length < 2) {
    return 'Name must be at least 2 characters.'
  }

  if (!/^\d{4,6}$/.test(passcode)) {
    return 'Passcode must be 4 to 6 digits.'
  }

  return null
}

const emptyForm: PosUserFormData = {
  employeeCode: '',
  fullName: '',
  passcode: '',
  isActive: true,
  isAdmin: false,
  assignedDevice: '',
  accessInventory: false,
  allowBackOffice: false,
  allowCustomerDetails: false,
  listingAccess: false,
  allowDiscount: false,
  allowRefund: false,
  openCashDrawer: false,
  viewExpectedAmount: false,
}

function resolveBranchLabel(branchId: string) {
  const trimmed = branchId.trim()
  if (trimmed.length === 0) {
    return 'Unassigned branch'
  }

  return trimmed
    .replace(/^branch-/i, '')
    .split('-')
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4.5 w-4.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
      />
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  )
}

function StatusToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 items-center rounded-full transition-colors',
        checked ? 'bg-emerald-500' : 'bg-slate-300',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-[color:var(--panel-strong)] shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  )
}

function UserForm({
  form,
  setForm,
  terminals,
  selectedBranch,
  errorMessage,
  onBack,
  onSave,
  isSaving,
}: {
  form: PosUserFormData
  setForm: React.Dispatch<React.SetStateAction<PosUserFormData>>
  terminals: ActiveTerminal[]
  selectedBranch: string
  errorMessage?: string | null
  onBack: () => void
  onSave: () => void
  isSaving: boolean
}) {
  const [showPasscode, setShowPasscode] = useState(false)
  const formError = getPosUserFormError(form)
  const isSaveDisabled = isSaving || formError !== null

  const update = useCallback(
    <K extends keyof PosUserFormData>(key: K, value: PosUserFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    [setForm],
  )

  return (
    <div className="space-y-6 text-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaveDisabled}
          className={cn(
            'flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition',
            isSaveDisabled
              ? 'cursor-not-allowed bg-teal-400'
              : 'bg-teal-600 hover:bg-teal-700',
          )}
        >
          Save
          <Save className="h-4 w-4" />
        </button>
      </div>

      {/* User Information */}
      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">User Information</h2>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Enter the basic information for this POS user
        </p>
        <p className="mt-2 text-sm font-medium text-[color:var(--muted)]">
          Branch: <span className="text-slate-700">{selectedBranch}</span>
        </p>
        {formError ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {formError}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="employeeCode" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Employee Code
            </label>
            <input
              id="employeeCode"
              value={form.employeeCode}
              onChange={(e) => update('employeeCode', e.target.value.toUpperCase())}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-[color:var(--muted)] focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder="e.g. CASHIER001"
            />
          </div>
          <div>
            <label htmlFor="fullName" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Name
            </label>
            <input
              id="fullName"
              value={form.fullName}
              onChange={(e) => update('fullName', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-[color:var(--muted)] focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder="e.g. Andrea Cruz"
            />
          </div>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="passcode" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Passcode
            </label>
            <div className="relative">
              <input
                id="passcode"
                type={showPasscode ? 'text' : 'password'}
                value={form.passcode}
                onChange={(e) => update('passcode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-[color:var(--muted)] focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                placeholder="4-6 digits"
                inputMode="numeric"
                maxLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPasscode((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)] hover:text-[color:var(--muted)]"
              >
                {showPasscode ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-x-12 gap-y-3">
          <Checkbox label="Active" checked={form.isActive} onChange={(v) => update('isActive', v)} />
          <Checkbox label="Admin" checked={form.isAdmin} onChange={(v) => update('isAdmin', v)} />
        </div>

        <div className="mt-5">
          <label htmlFor="device" className="mb-1.5 block text-sm font-semibold text-slate-700">
            Assigned Device
          </label>
          <select
            id="device"
            value={form.assignedDevice}
            onChange={(e) => update('assignedDevice', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          >
            <option value="">Select a device</option>
            {terminals.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.serialNumber})
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* User Permissions */}
      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">User Permissions</h2>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Configure what this user can access and modify in the system
        </p>

        {/* Access Controls */}
        <div className="mt-6">
          <h3 className="text-base font-semibold text-slate-800">Access Controls</h3>
          <hr className="mt-2 mb-4 border-[color:var(--border)]" />
          <div className="grid gap-y-3 gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
            <Checkbox label="Access Inventory" checked={form.accessInventory} onChange={(v) => update('accessInventory', v)} />
            <Checkbox label="Allow Back Office" checked={form.allowBackOffice} onChange={(v) => update('allowBackOffice', v)} />
            <Checkbox label="Allow Customer Details" checked={form.allowCustomerDetails} onChange={(v) => update('allowCustomerDetails', v)} />
            <Checkbox label="Listing Access" checked={form.listingAccess} onChange={(v) => update('listingAccess', v)} />
          </div>
        </div>

        {/* Transaction Permissions */}
        <div className="mt-8">
          <h3 className="text-base font-semibold text-slate-800">Transaction Permissions</h3>
          <hr className="mt-2 mb-4 border-[color:var(--border)]" />
          <div className="grid gap-y-3 gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
            <Checkbox label="Allow Discount" checked={form.allowDiscount} onChange={(v) => update('allowDiscount', v)} />
            <Checkbox label="Allow Refund" checked={form.allowRefund} onChange={(v) => update('allowRefund', v)} />
            <Checkbox label="Open Cash Drawer" checked={form.openCashDrawer} onChange={(v) => update('openCashDrawer', v)} />
            <Checkbox label="View Expected Amount" checked={form.viewExpectedAmount} onChange={(v) => update('viewExpectedAmount', v)} />
          </div>
        </div>
      </section>
    </div>
  )
}

export function PosUserPage() {
  const { userName } = useParams<{ userName: string }>()
  const navigate = useNavigate()
  const selectedBranch = useUiStore((state) => state.selectedBranch)
  const queryClient = useQueryClient()

  // 'list' | 'add' | 'edit'
  const [view, setView] = useState<'list' | 'add' | 'edit'>(userName ? 'edit' : 'list')
  const [form, setForm] = useState<PosUserFormData>(emptyForm)
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)

  const managedBranchesQuery = useQuery({
    queryKey: ['managed-branches'],
    queryFn: fetchManagedBranches,
  })
  const managedBranches = managedBranchesQuery.data ?? []
  const effectiveBranchId =
    managedBranches.length === 1 ? managedBranches[0].id : selectedBranch
  const effectiveBranchLabel =
    managedBranches.find((branch) => branch.id === effectiveBranchId)?.name ??
    resolveBranchLabel(effectiveBranchId)

  const usersQuery = useQuery({
    queryKey: ['managed-users', effectiveBranchId],
    queryFn: () => fetchManagedUsers(effectiveBranchId),
  })

  const { data: overview } = useDashboardOverview(selectedBranch)
  const terminals = overview?.terminals ?? []
  const users: ManagedUser[] = usersQuery.data ?? []

  const createUserMutation = useMutation({
    mutationFn: () =>
      createManagedUser({
        branchId: effectiveBranchId,
        employeeCode: form.employeeCode.trim().toUpperCase(),
        name: form.fullName.trim(),
        role: form.isAdmin ? 'ADMIN' : 'CASHIER',
        pin: form.passcode.trim(),
        isActive: form.isActive,
      }),
    onMutate: () => {
      setFormErrorMessage(null)
    },
    onSuccess: async () => {
      setForm(emptyForm)
      setFormErrorMessage(null)
      setView('list')
      await queryClient.invalidateQueries({ queryKey: ['managed-users', effectiveBranchId] })
    },
    onError: (error) => {
      setFormErrorMessage(
        error instanceof Error ? error.message : 'Failed to create POS user.',
      )
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      updateManagedUserStatus(userId, { isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['managed-users', effectiveBranchId] })
    },
  })

  const handleAdd = useCallback(() => {
    setForm(emptyForm)
    setFormErrorMessage(null)
    setView('add')
  }, [])

  const handleEdit = useCallback(
    (user: ManagedUser) => {
      setForm({
        ...emptyForm,
        employeeCode: user.employeeCode,
        fullName: user.name,
        isAdmin: user.role === 'ADMIN',
        isActive: user.isActive,
      })
      setView('edit')
    },
    [],
  )

  const handleBack = useCallback(() => {
    setView('list')
    setFormErrorMessage(null)
    if (userName) {
      navigate('/pos-users')
    }
  }, [userName, navigate])

  const handleSave = useCallback(() => {
    const validationError = getPosUserFormError(form)
    if (validationError) {
      setFormErrorMessage(validationError)
      return
    }
    if (view === 'add') {
      createUserMutation.mutate()
    }
    // For edit, would call an update API when available
  }, [form, view, createUserMutation])

  // If navigated via /pos-users/:userName, start in edit-like view
  const editFromRoute = useMemo(() => {
    if (!userName) return null
    const decoded = decodeURIComponent(userName)
    return users.find((u) => u.name.toLowerCase() === decoded.toLowerCase()) ?? null
  }, [userName, users])

  if (userName && editFromRoute && view !== 'list') {
    const userForm: PosUserFormData = {
      ...emptyForm,
      employeeCode: editFromRoute.employeeCode,
      fullName: editFromRoute.name,
      isAdmin: editFromRoute.role === 'ADMIN',
      isActive: editFromRoute.isActive,
    }

    return (
      <UserForm
        form={userForm}
        setForm={setForm}
        terminals={terminals}
        selectedBranch={effectiveBranchLabel}
        errorMessage={formErrorMessage}
        onBack={handleBack}
        onSave={handleSave}
        isSaving={false}
      />
    )
  }

  if (view === 'add' || view === 'edit') {
    return (
      <UserForm
        form={form}
        setForm={setForm}
        terminals={terminals}
        selectedBranch={effectiveBranchLabel}
        errorMessage={formErrorMessage}
        onBack={handleBack}
        onSave={handleSave}
        isSaving={createUserMutation.isPending}
      />
    )
  }

  // List view
  return (
    <div className="space-y-6 text-slate-900">
      <section className="rounded-[32px] border border-[color:var(--border)]/80 bg-[color:var(--panel-strong)] p-5 shadow-[0_14px_32px_rgba(15,23,42,0.05)] sm:p-6 md:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              POS Users
            </h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Manage POS user accounts, permissions, and device assignments.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-2 rounded-2xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" />
            Add User
          </button>
        </div>
      </section>

      <section className="rounded-[32px] border border-[color:var(--border)]/80 bg-[color:var(--panel-strong)] shadow-[0_12px_28px_rgba(15,23,42,0.045)]">
        {usersQuery.isFetching && users.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            No POS users yet. Click "Add User" to create the first one.
          </div>
        ) : (
          <div className="overflow-hidden rounded-[32px]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--border)] bg-[color:var(--surface-soft)]">
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                      Name
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                      Employee Code
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                      Role
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                      Active
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                      Created
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id} className="transition hover:bg-[color:var(--surface-soft)]">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--header-tint)] text-[color:var(--muted)]">
                            <UserCircle className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-slate-900">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[color:var(--muted)]">{user.employeeCode}</td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
                            user.role === 'ADMIN'
                              ? 'bg-purple-100 text-purple-700'
                              : user.role === 'SUPERVISOR'
                                ? 'bg-blue-100 text-blue-700'
                                : user.role === 'CASHIER'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-[color:var(--header-tint)] text-slate-700',
                          )}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <StatusToggle
                            checked={user.isActive}
                            disabled={updateStatusMutation.isPending}
                            onChange={(nextChecked) =>
                              updateStatusMutation.mutate({
                                userId: user.id,
                                isActive: nextChecked,
                              })
                            }
                          />
                          <span
                            className={cn(
                              'text-xs font-semibold uppercase tracking-[0.14em]',
                              user.isActive ? 'text-emerald-600' : 'text-[color:var(--muted)]',
                            )}
                          >
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[color:var(--muted)]">
                        {new Date(user.createdAt).toLocaleDateString('en-PH')}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => handleEdit(user)}
                          className="flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-xs font-medium text-[color:var(--muted)] transition hover:bg-[color:var(--surface-soft)]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
