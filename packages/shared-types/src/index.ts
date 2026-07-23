export type UserRole =
  | 'ADMIN'
  | 'SUPERVISOR'
  | 'CASHIER'
  | 'INVENTORY'
  | 'AUDITOR';

export type PaymentMethod = 'CASH' | 'CARD' | 'GCASH' | 'MAYA' | 'SPLIT';

export type TransactionStatus =
  | 'COMPLETED'
  | 'VOID'
  | 'RETURNED'
  | 'REFUNDED'
  | 'HELD';

export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface ApiEnvelope<T> {
  data: T;
  generatedAt: string;
}

export interface SalesSnapshot {
  grossSales: number;
  transactionCount: number;
  averageBasket: number;
  includedTax: number;
  addedTax: number;
  serviceFee: number;
  diningOptionFee: number;
  discountTotal: number;
  refundTotal: number;
  netSales: number;
  payIn: number;
  payOut: number;
  itemCost: number;
  grossProfit: number;
  redeemedPoints: number;
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
  customerName?: string;
  customerTin?: string;
  customerAddress?: string;
  customerBusinessStyle?: string;
  terminalName?: string;
  orNumber: number;
  refNumber: string;
  total: number;
  subtotal?: number;
  vatAmount?: number;
  discountAmount?: number;
  changeAmount?: number;
  vatableSales?: number;
  vatExemptSales?: number;
  zeroRatedSales?: number;
  voidRef?: string;
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  createdAt: string;
  items?: ReceiptLineItem[];
  timeline?: string[];
}

export interface ReceiptLineItem {
  name: string;
  qty: number;
  price: number;
  sku?: string;
  unit?: string;
  vatType?: 'VATABLE' | 'VAT_EXEMPT' | 'ZERO_RATED';
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
  transactionReceipts?: SyncTransactionReceiptAck[];
}

export interface SyncTransactionReceiptAck {
  localTransactionId: string;
  serverTransactionId: string;
  orNumber: number;
  orLabel: string;
  referenceNumber: string;
  total: number;
  vatAmount: number;
  changeAmount: number;
  paymentMethod: PaymentMethod;
  createdAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export type ShiftStatus = 'OPEN' | 'BALANCING' | 'CLOSED';

export interface CashBalancingRow {
  id: string;
  branchId: string;
  shift: string;
  cashier: string;
  terminal: string;
  status: ShiftStatus;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  cashSales: number;
  cashReturns: number;
  payIn: number;
  payOut: number;
  expected: number;
  actual: number | null;
  variance: number | null;
}

export const paymentMethods: PaymentMethod[] = [
  'CASH',
  'CARD',
  'GCASH',
  'MAYA',
  'SPLIT',
];
