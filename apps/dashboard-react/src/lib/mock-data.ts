import type {
  CashBalancingRow,
  CatalogCategory,
  CatalogItem,
  DashboardOverview,
  EmployeeSummary,
  InventorySummary,
  ReceiptRecord,
  ReportPoint,
} from '@apex-pos/shared-types'

export const dashboardOverview: DashboardOverview = {
  sales: {
    grossSales: 0,
    transactionCount: 0,
    averageBasket: 0,
    includedTax: 0,
    addedTax: 0,
    serviceFee: 0,
    diningOptionFee: 0,
    discountTotal: 0,
    refundTotal: 0,
    netSales: 0,
    payIn: 0,
    payOut: 0,
    itemCost: 0,
    grossProfit: 0,
    redeemedPoints: 0,
    voidTotal: 0,
    returnsTotal: 0,
    vatableSales: 0,
    vatAmount: 0,
  },
  branches: [
    {
      id: 'branch-manila',
      name: 'CALAMBA BANGA',
      activeTerminals: 0,
      grossSalesToday: 0,
      openShifts: 0,
    },
  ],
  terminals: [],
}

export const receipts: ReceiptRecord[] = []

export const categories: CatalogCategory[] = []

export const catalogItems: CatalogItem[] = []

export const inventory: InventorySummary[] = []

export const reportSeries: ReportPoint[] = []

export const employees: EmployeeSummary[] = []

export const queueBlueprint = [
  { name: 'reports', description: 'Daily sales, branch comparison, PDF output' },
  { name: 'imports', description: 'CSV item import and opening stock jobs' },
  { name: 'bir-esales', description: 'Monthly eSales CSV generation and filing staging' },
]

function toMoney(value: number) {
  return Number(value.toFixed(2))
}

function getScopedSalesSnapshot(branchId: string) {
  const branch = dashboardOverview.branches.find((item) => item.id === branchId)

  if (!branch) {
    return dashboardOverview.sales
  }

  const baseSales = dashboardOverview.sales
  const ratio =
    baseSales.grossSales === 0 ? 1 : branch.grossSalesToday / baseSales.grossSales
  const transactionCount = Math.max(
    1,
    Math.round(baseSales.transactionCount * ratio),
  )
  const includedTax = toMoney(baseSales.includedTax * ratio)
  const addedTax = toMoney(baseSales.addedTax * ratio)
  const serviceFee = toMoney(baseSales.serviceFee * ratio)
  const diningOptionFee = toMoney(baseSales.diningOptionFee * ratio)
  const discountTotal = toMoney(baseSales.discountTotal * ratio)
  const refundTotal = toMoney(baseSales.refundTotal * ratio)
  const payIn = toMoney(baseSales.payIn * ratio)
  const payOut = toMoney(baseSales.payOut * ratio)
  const itemCost = toMoney(baseSales.itemCost * ratio)
  const grossSales = branch.grossSalesToday
  const netSales = toMoney(
    grossSales +
      addedTax +
      serviceFee +
      diningOptionFee -
      discountTotal -
      refundTotal,
  )

  return {
    ...baseSales,
    grossSales,
    transactionCount,
    averageBasket: toMoney(grossSales / transactionCount),
    includedTax,
    addedTax,
    serviceFee,
    diningOptionFee,
    discountTotal,
    refundTotal,
    netSales,
    payIn,
    payOut,
    itemCost,
    grossProfit: toMoney(netSales - itemCost),
    redeemedPoints: Math.round(baseSales.redeemedPoints * ratio),
    voidTotal: toMoney(baseSales.voidTotal * ratio),
    returnsTotal: refundTotal,
    vatableSales: toMoney(grossSales - includedTax),
    vatAmount: includedTax,
  }
}

export async function loadDashboardOverview(branchId: string) {
  if (branchId === 'all') {
    return dashboardOverview
  }

  return {
    ...dashboardOverview,
    sales: getScopedSalesSnapshot(branchId),
    branches: dashboardOverview.branches.filter((branch) => branch.id === branchId),
    terminals: dashboardOverview.terminals.filter((terminal) => terminal.branchId === branchId),
  }
}

export async function loadReceipts(branchId: string) {
  return branchId === 'all'
    ? receipts
    : receipts.filter((receipt) => receipt.branchId === branchId)
}

export async function loadCatalog(branchId: string) {
  return {
    categories:
      branchId === 'all'
        ? categories
        : categories.filter((category) => category.branchId === branchId),
    items:
      branchId === 'all'
        ? catalogItems
        : catalogItems.filter((item) => item.branchId === branchId),
  }
}

export async function loadInventory(branchId: string) {
  return branchId === 'all'
    ? inventory
    : inventory.filter((item) => item.branchId === branchId)
}

export async function loadReports() {
  return {
    series: reportSeries,
    branches: dashboardOverview.branches,
    queues: queueBlueprint,
  }
}

export async function loadEmployees(branchId: string) {
  return branchId === 'all'
    ? employees
    : employees.filter((employee) => employee.branchId === branchId)
}

export const cashBalancingRows: CashBalancingRow[] = []

export async function loadCashBalancing(branchId: string) {
  return branchId === 'all'
    ? cashBalancingRows
    : cashBalancingRows.filter((row) => row.branchId === branchId)
}
