import type { ReceiptRecord } from '@apex-pos/shared-types'
import type { ManagedUser } from './api-client'

const builtInCashierAliases = new Map<string, string>([
  ['user-admin-001', 'Andrea Cruz'],
  ['ADM001', 'Andrea Cruz'],
  ['user-sup-001', 'Jose Santos'],
  ['SUP001', 'Jose Santos'],
  ['user-cash-001', 'Maria Uy'],
  ['CSH101', 'Maria Uy'],
  ['user-mnl-cash-001', 'Mark Reyes'],
  ['MNL101', 'Mark Reyes'],
  ['user-ceb-sup-001', 'Lisa Tan'],
  ['CEB201', 'Lisa Tan'],
  ['user-dvo-admin-001', 'Paolo Ramos'],
  ['DVO301', 'Paolo Ramos'],
  ['user-dvo-cash-001', 'Nina Cruz'],
  ['DVO302', 'Nina Cruz'],
])

const supportedCashierRoles = new Set(['ADMIN', 'SUPERVISOR', 'CASHIER'])

function normalizeLookupKey(value: string) {
  return value.trim().toUpperCase()
}

function supportsCashierFiltering(role: string) {
  return supportedCashierRoles.has(role.trim().toUpperCase())
}

export function normalizeCashierName(
  rawValue: string | null | undefined,
  managedUsers: ManagedUser[] = [],
) {
  const value = rawValue?.trim() ?? ''
  if (value.length === 0) {
    return ''
  }

  const normalizedValue = normalizeLookupKey(value)
  for (const user of managedUsers) {
    if (!supportsCashierFiltering(user.role)) {
      continue
    }

    if (
      normalizeLookupKey(user.name) === normalizedValue ||
      normalizeLookupKey(user.employeeCode) === normalizedValue ||
      normalizeLookupKey(user.id) === normalizedValue
    ) {
      return user.name
    }
  }

  return builtInCashierAliases.get(normalizedValue) ?? value
}

export function buildCashierOptions(params: {
  receipts: ReceiptRecord[]
  managedUsers?: ManagedUser[]
  extraValues?: string[]
}) {
  const options = new Set<string>()
  const managedUsers = params.managedUsers ?? []

  for (const receipt of params.receipts) {
    const normalizedName = normalizeCashierName(
      receipt.cashierName,
      managedUsers,
    )
    if (normalizedName) {
      options.add(normalizedName)
    }
  }

  for (const user of managedUsers) {
    if (!user.isActive || !supportsCashierFiltering(user.role)) {
      continue
    }
    if (user.name.trim().length > 0) {
      options.add(user.name.trim())
    }
  }

  for (const extraValue of params.extraValues ?? []) {
    const normalizedName = normalizeCashierName(extraValue, managedUsers)
    if (normalizedName) {
      options.add(normalizedName)
    }
  }

  return Array.from(options).sort((left, right) => left.localeCompare(right))
}
