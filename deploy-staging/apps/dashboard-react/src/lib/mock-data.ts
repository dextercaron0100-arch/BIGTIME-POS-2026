import type {
  CatalogCategory,
  CatalogItem,
  DashboardOverview,
  EmployeeSummary,
  InventorySummary,
  ReceiptRecord,
  ReportPoint,
} from '@apex-pos/shared-types'

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms))

export const dashboardOverview: DashboardOverview = {
  sales: {
    grossSales: 184_250.75,
    transactionCount: 312,
    averageBasket: 590.55,
    voidTotal: 1_250,
    returnsTotal: 780,
    vatableSales: 164_509.6,
    vatAmount: 19_741.15,
  },
  branches: [
    {
      id: 'branch-manila',
      name: 'Manila Flagship',
      activeTerminals: 5,
      grossSalesToday: 92_100.25,
      openShifts: 4,
    },
    {
      id: 'branch-cebu',
      name: 'Cebu Ayala',
      activeTerminals: 3,
      grossSalesToday: 51_320.5,
      openShifts: 3,
    },
    {
      id: 'branch-davao',
      name: 'Davao Downtown',
      activeTerminals: 2,
      grossSalesToday: 40_830,
      openShifts: 2,
    },
  ],
  terminals: [
    {
      id: 'term-mnl-01',
      branchId: 'branch-manila',
      name: 'POS 01',
      serialNumber: 'MNL-PTU-001',
      cashierName: 'A. Cruz',
      status: 'ONLINE',
      lastSeenAt: '2026-03-13T14:55:00.000Z',
    },
    {
      id: 'term-mnl-02',
      branchId: 'branch-manila',
      name: 'POS 02',
      serialNumber: 'MNL-PTU-002',
      cashierName: 'J. Santos',
      status: 'SYNCING',
      lastSeenAt: '2026-03-13T14:54:20.000Z',
    },
    {
      id: 'term-ceb-01',
      branchId: 'branch-cebu',
      name: 'POS 01',
      serialNumber: 'CEB-PTU-001',
      cashierName: 'M. Uy',
      status: 'ONLINE',
      lastSeenAt: '2026-03-13T14:55:10.000Z',
    },
  ],
}

export const receipts: ReceiptRecord[] = [
  {
    id: 'txn-001',
    branchId: 'branch-manila',
    terminalId: 'term-mnl-01',
    cashierName: 'A. Cruz',
    orNumber: 100021,
    refNumber: 'SALE-MNL-100021',
    total: 1_240,
    paymentMethod: 'CASH',
    status: 'COMPLETED',
    createdAt: '2026-03-13T10:12:00.000Z',
  },
  {
    id: 'txn-002',
    branchId: 'branch-manila',
    terminalId: 'term-mnl-02',
    cashierName: 'J. Santos',
    orNumber: 100022,
    refNumber: 'SALE-MNL-100022',
    total: 895.5,
    paymentMethod: 'GCASH',
    status: 'COMPLETED',
    createdAt: '2026-03-13T10:19:00.000Z',
  },
  {
    id: 'txn-003',
    branchId: 'branch-cebu',
    terminalId: 'term-ceb-01',
    cashierName: 'M. Uy',
    orNumber: 200145,
    refNumber: 'VOID-CEB-200145',
    total: 460,
    paymentMethod: 'CARD',
    status: 'VOID',
    createdAt: '2026-03-13T11:03:00.000Z',
  },
]

export const categories: CatalogCategory[] = [
  {
    id: 'cat-coffee',
    branchId: 'branch-manila',
    name: 'Coffee',
    color: '#8a4b2f',
    groupName: 'Beverages',
  },
  {
    id: 'cat-meals',
    branchId: 'branch-manila',
    name: 'Meals',
    color: '#d6643b',
    groupName: 'Kitchen',
  },
  {
    id: 'cat-bakery',
    branchId: 'branch-cebu',
    name: 'Bakery',
    color: '#d4ad5f',
    groupName: 'Fresh',
  },
]

export const catalogItems: CatalogItem[] = [
  {
    id: 'item-americano',
    branchId: 'branch-manila',
    categoryId: 'cat-coffee',
    name: 'Iced Americano',
    sku: 'COF-AMER-12',
    barcode: '480100100001',
    unit: 'cup',
    price: 135,
    vatType: 'VATABLE',
    trackInventory: true,
    hasVariants: true,
  },
  {
    id: 'item-latte',
    branchId: 'branch-manila',
    categoryId: 'cat-coffee',
    name: 'Cafe Latte',
    sku: 'COF-LATT-12',
    barcode: '480100100002',
    unit: 'cup',
    price: 165,
    vatType: 'VATABLE',
    trackInventory: true,
    hasVariants: true,
  },
  {
    id: 'item-pasta',
    branchId: 'branch-manila',
    categoryId: 'cat-meals',
    name: 'Creamy Pesto Pasta',
    sku: 'MEAL-PST-01',
    barcode: '480100100101',
    unit: 'plate',
    price: 310,
    vatType: 'VATABLE',
    trackInventory: true,
    hasVariants: false,
  },
  {
    id: 'item-croissant',
    branchId: 'branch-cebu',
    categoryId: 'cat-bakery',
    name: 'Butter Croissant',
    sku: 'BAK-CRO-01',
    barcode: '480100100201',
    unit: 'piece',
    price: 95,
    vatType: 'VATABLE',
    trackInventory: true,
    hasVariants: false,
  },
]

export const inventory: InventorySummary[] = [
  {
    id: 'stock-01',
    branchId: 'branch-manila',
    itemName: 'Iced Americano',
    warehouseName: 'Main Bar',
    quantityOnHand: 72,
    reorderPoint: 20,
    status: 'HEALTHY',
  },
  {
    id: 'stock-02',
    branchId: 'branch-manila',
    itemName: 'Cafe Latte',
    warehouseName: 'Main Bar',
    quantityOnHand: 18,
    reorderPoint: 20,
    status: 'LOW',
  },
  {
    id: 'stock-03',
    branchId: 'branch-cebu',
    itemName: 'Butter Croissant',
    warehouseName: 'Bakery Rack',
    quantityOnHand: 0,
    reorderPoint: 12,
    status: 'OUT',
  },
]

export const reportSeries: ReportPoint[] = [
  { label: 'Mon', sales: 68_400, transactions: 118 },
  { label: 'Tue', sales: 72_150, transactions: 124 },
  { label: 'Wed', sales: 70_330, transactions: 121 },
  { label: 'Thu', sales: 77_680, transactions: 136 },
  { label: 'Fri', sales: 84_200, transactions: 149 },
  { label: 'Sat', sales: 92_500, transactions: 164 },
  { label: 'Sun', sales: 58_300, transactions: 101 },
]

export const employees: EmployeeSummary[] = [
  {
    id: 'emp-001',
    branchId: 'branch-manila',
    fullName: 'Andrea Cruz',
    position: 'Cashier',
    hoursThisWeek: 38.5,
    rate: 610,
  },
  {
    id: 'emp-002',
    branchId: 'branch-manila',
    fullName: 'Jose Santos',
    position: 'Supervisor',
    hoursThisWeek: 42,
    rate: 730,
  },
  {
    id: 'emp-003',
    branchId: 'branch-cebu',
    fullName: 'Maria Uy',
    position: 'Cashier',
    hoursThisWeek: 36,
    rate: 590,
  },
]

export const queueBlueprint = [
  { name: 'reports', description: 'Daily sales, branch comparison, PDF output' },
  { name: 'imports', description: 'CSV item import and opening stock jobs' },
  { name: 'bir-esales', description: 'Monthly eSales CSV generation and filing staging' },
]

export async function loadDashboardOverview(branchId: string) {
  await delay()

  if (branchId === 'all') {
    return dashboardOverview
  }

  return {
    ...dashboardOverview,
    branches: dashboardOverview.branches.filter((branch) => branch.id === branchId),
    terminals: dashboardOverview.terminals.filter((terminal) => terminal.branchId === branchId),
  }
}

export async function loadReceipts(branchId: string) {
  await delay()
  return branchId === 'all'
    ? receipts
    : receipts.filter((receipt) => receipt.branchId === branchId)
}

export async function loadCatalog(branchId: string) {
  await delay()
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
  await delay()
  return branchId === 'all'
    ? inventory
    : inventory.filter((item) => item.branchId === branchId)
}

export async function loadReports() {
  await delay()
  return {
    series: reportSeries,
    branches: dashboardOverview.branches,
    queues: queueBlueprint,
  }
}

export async function loadEmployees(branchId: string) {
  await delay()
  return branchId === 'all'
    ? employees
    : employees.filter((employee) => employee.branchId === branchId)
}
