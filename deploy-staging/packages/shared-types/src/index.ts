export type UserRole =
  | 'ADMIN'
  | 'SUPERVISOR'
  | 'CASHIER'
  | 'INVENTORY'
  | 'AUDITOR';

export type PaymentMethod = 'CASH' | 'CARD' | 'GCASH' | 'MAYA' | 'SPLIT';

export type TransactionStatus = 'COMPLETED' | 'VOID' | 'RETURNED' | 'HELD';

export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface ApiEnvelope<T> {
  data: T;
  generatedAt: string;
}

export interface SalesSnapshot {
  grossSales: number;
  transactionCount: number;
  averageBasket: number;
  voidTotal: number;
  returnsTotal: number;
  vatableSales: number;
  vatAmount: number;
}

export interface BranchSummary {
  id: string;
  name: string;
  activeTerminals: number;
  grossSalesToday: number;
  openShifts: number;
}

export interface ActiveTerminal {
  id: string;
  branchId: string;
  name: string;
  serialNumber: string;
  cashierName: string;
  status: 'ONLINE' | 'OFFLINE' | 'SYNCING';
  lastSeenAt: string;
}

export interface DashboardOverview {
  sales: SalesSnapshot;
  branches: BranchSummary[];
  terminals: ActiveTerminal[];
}

export interface ReceiptRecord {
  id: string;
  branchId: string;
  terminalId: string;
  cashierName: string;
  orNumber: number;
  refNumber: string;
  total: number;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  createdAt: string;
}

export interface CatalogCategory {
  id: string;
  branchId: string;
  name: string;
  color: string;
  groupName: string;
}

export interface CatalogItem {
  id: string;
  branchId: string;
  categoryId: string;
  name: string;
  sku: string;
  barcode: string;
  unit: string;
  price: number;
  vatType: 'VATABLE' | 'VAT_EXEMPT' | 'ZERO_RATED';
  trackInventory: boolean;
  hasVariants: boolean;
}

export interface InventorySummary {
  id: string;
  branchId: string;
  itemName: string;
  warehouseName: string;
  quantityOnHand: number;
  reorderPoint: number;
  status: 'HEALTHY' | 'LOW' | 'OUT';
}

export interface ReportPoint {
  label: string;
  sales: number;
  transactions: number;
}

export interface EmployeeSummary {
  id: string;
  branchId: string;
  fullName: string;
  position: string;
  hoursThisWeek: number;
  rate: number;
}

export interface BirZReadingSummary {
  id: string;
  terminalId: string;
  zNumber: number;
  date: string;
  beginningOr: number;
  endingOr: number;
  grossSales: number;
  vatAmount: number;
  vatableSales: number;
  vatExemptSales: number;
  zeroRatedSales: number;
  discountTotal: number;
}

export interface SyncQueueRecord {
  id: string;
  tableName: string;
  recordId: string;
  operation: SyncOperation;
  localCreatedAt: string;
  payload: Record<string, unknown>;
}

export interface SyncBatchRequest {
  branchId: string;
  terminalId: string;
  cursor?: string;
  entries: SyncQueueRecord[];
}

export interface SyncBatchResponse {
  acceptedIds: string[];
  rejectedIds: Array<{
    id: string;
    reason: string;
  }>;
  nextCursor: string;
  catalogItems: CatalogItem[];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export const paymentMethods: PaymentMethod[] = [
  'CASH',
  'CARD',
  'GCASH',
  'MAYA',
  'SPLIT',
];
