import type {
  ApiEnvelope,
  BirZReadingSummary,
  BranchSummary,
  CashBalancingRow,
  CatalogCategory,
  CatalogItem,
  DashboardOverview,
  EmployeeSummary,
  InventorySummary,
  PaymentMethod,
  ReceiptRecord,
  ReportPoint,
  SyncBatchResponse,
  SyncQueueRecord,
} from "@apex-pos/shared-types";
import {
  clearAuthSession,
  readAuthSession,
  saveAuthSession,
  type AuthSession,
} from "./auth-session";

export type QueueBlueprintEntry = {
  name: string;
  description: string;
};

export type CatalogSnapshotResponse = {
  categories: CatalogCategory[];
  items: CatalogItem[];
  syncCursor: string;
};

export type ReceiptsResponse =
  | ReceiptRecord[]
  | {
      items: ReceiptRecord[];
      total: number;
    };

export type PaymentBucket = {
  method: PaymentMethod;
  total: number;
};

export type SalesSummaryResponse = {
  branchId: string;
  terminalId: string | null;
  cashierId: string | null;
  fromDate: string;
  toDate: string;
  salesCount: number;
  refundCount: number;
  voidCount: number;
  grossSales: number;
  voidTotal: number;
  refundTotal: number;
  discountTotal: number;
  netSales: number;
  includedTax: number;
  vatableSales: number;
  vatExemptSales: number;
  zeroRatedSales: number;
  beginningOr: number | null;
  endingOr: number | null;
  payments: PaymentBucket[];
  generatedAt: string;
};

export type EndOfDayGeneratedReport = {
  id: string;
  branchId: string;
  terminalId?: string;
  cashierId?: string;
  date: string;
  summary: SalesSummaryResponse;
  generatedBy?: string;
  generatedAt: string;
  recordHash?: string;
};

export type EndOfDayReportResponse = {
  savedReport: EndOfDayGeneratedReport | null;
  currentSummary: SalesSummaryResponse;
};

export type PricingConfigResponse = {
  taxes: Array<{
    id: string;
    name: string;
    rate: number;
    birCode: string;
    active: boolean;
  }>;
  discounts: Array<{
    id: string;
    name: string;
    type: string;
    value: number;
    requiresAuth: boolean;
    birCode: string;
  }>;
};

export type PaymentMethodConfig = {
  code: PaymentMethod;
  label: string;
  enabled: boolean;
  supportsSplit: boolean;
  requiresReference: boolean;
};

export type PaymentSettingsResponse = {
  branchId: string;
  defaultMethod: PaymentMethod;
  updatedAt: string;
  methods: PaymentMethodConfig[];
};

export type BirSettingsResponse = {
  branchId: string;
  birEnabled: boolean;
  autoZRead: boolean;
  storeName: string;
  proprietorName: string;
  vatTin: string;
  permitNumber: string;
  permitDateIssued: string;
  authorityToPrintNumber: string;
  authorityToPrintDateIssued: string;
  approvedSerialRange: string;
  machineIdentificationNumber: string;
  serialNumber: string;
  businessAddressLines: string[];
  footerLines: string[];
  updatedAt: string;
};

export type BirXReadingResponse = SalesSummaryResponse & {
  type: "X";
};

export type BirZReadingResponse = {
  id: string;
  branchId: string;
  terminalId: string;
  date: string;
  zNumber: number;
  begOr: number | null;
  endOr: number | null;
  grossSales: number;
  vatableSales: number;
  vatAmount: number;
  vatExemptSales: number;
  zeroRatedSales: number;
  discountTotal: number;
  voidTotal: number;
  refundTotal: number;
  netSales: number;
  transactionCount: number;
  submittedAt: string | null;
  createdAt: string;
  recordHash: string;
};

export type BirZSummaryResponse = {
  latestReading: BirZReadingSummary | null;
  currentSummary: SalesSummaryResponse;
};

export type OrganizationSummary = {
  id: string;
  name: string;
  status: "TRIAL" | "EXPIRED" | "SUSPENDED";
  trialState: "TRIAL_ACTIVE" | "TRIAL_EXPIRED" | "SUSPENDED";
  trialStartedAt: string;
  trialEndsAt: string;
  daysRemaining: number;
  branchIds: string[];
};

export type AuthLoginResponse = {
  accessToken: string;
  refreshToken: string;
  terminalId: string;
  pinChangeRequired: boolean;
  pinChangeReason: string | null;
  pinUpdatedAt: string | null;
  pinExpiresAt: string | null;
  user: {
    id: string;
    branchId: string;
    employeeCode: string;
    name: string;
    role: string;
  };
  permissions: string[];
};

export type ManagedBranch = {
  id: string;
  name: string;
  createdAt: string;
};

export type ManagedUser = {
  id: string;
  branchId: string;
  employeeCode: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

export type ManagedAdminAuditLogRecord = {
  id: string;
  action:
    | "BRANCH_CREATED"
    | "BRANCH_DELETED"
    | "USER_CREATED"
    | "USER_STATUS_UPDATED";
  actorUserId?: string;
  targetType: "branch" | "user";
  targetId: string;
  branchId: string;
  details: Record<string, unknown>;
  createdAt: string;
};

export type HealthResponse = {
  status: string;
  service: string;
  timestamp: string;
  dependencies: {
    postgresConfigured: boolean;
    redisConfigured: boolean;
  };
};

export type AccountProfileResponse = {
  userId: string;
  branchId: string;
  employeeCode: string;
  name: string;
  role: string;
  email: string;
  companyName: string;
  companyDescription: string;
  pinUpdatedAt: string | null;
  pinExpiresAt: string | null;
  pinChangeRequired: boolean;
  pinChangeReason: string | null;
  failedLoginAttempts: number;
  remainingLoginAttempts: number;
  maxFailedLoginAttempts: number;
  lockoutDurationMinutes: number;
  lockedUntil: string | null;
  mfaEnabled: boolean;
  mfaEnabledAt: string | null;
  mfaRecoveryCodesRemaining: number;
  updatedAt: string;
};

export type MfaStatusResponse = {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
};

export type MfaSetupResponse = {
  secret: string;
  manualEntryKey: string;
  otpauthUri: string;
  issuer: string;
  accountName: string;
};

export type MfaConfirmResponse = MfaStatusResponse & {
  recoveryCodes: string[];
  signedOut: boolean;
  message: string;
};

export type MfaDisableResponse = MfaStatusResponse & {
  signedOut: boolean;
  message: string;
};

export type AccountDangerActionResponse = {
  action: string;
  message: string;
  signedOut: boolean;
  temporaryPin?: string;
  deleted?: boolean;
};

export type ChangePinResponse = {
  message: string;
  signedOut: boolean;
  pinUpdatedAt: string | null;
  pinExpiresAt: string | null;
  pinChangeRequired: boolean;
};

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const runtimeHost =
  typeof window !== "undefined" && window.location.hostname
    ? window.location.hostname
    : "localhost";
const runtimeHttpProtocol =
  typeof window !== "undefined" && window.location.protocol === "https:"
    ? "https:"
    : "http:";
const BASE_URL =
  configuredApiUrl || `${runtimeHttpProtocol}//${runtimeHost}:3000/api`;
let refreshPromise: Promise<AuthSession | null> | null = null;

class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function refreshSessionToken(
  session: AuthSession,
): Promise<AuthSession | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = performSessionRefresh(session).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function performSessionRefresh(
  session: AuthSession,
): Promise<AuthSession | null> {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        refreshToken: session.refreshToken,
      }),
    });

    if (!res.ok) {
      return null;
    }

    const envelope = (await res.json()) as ApiEnvelope<{
      accessToken: string;
      refreshToken: string;
      terminalId?: string;
      pinChangeRequired?: boolean;
      pinChangeReason?: string | null;
      pinUpdatedAt?: string | null;
      pinExpiresAt?: string | null;
      user?: AuthSession["user"];
      permissions?: string[];
    }>;
    const data = envelope.data;
    if (
      typeof data?.accessToken !== "string" ||
      data.accessToken.length === 0 ||
      typeof data?.refreshToken !== "string" ||
      data.refreshToken.length === 0
    ) {
      return null;
    }

    const nextSession: AuthSession = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      terminalId:
        typeof data.terminalId === "string" && data.terminalId.length > 0
          ? data.terminalId
          : session.terminalId,
      pinChangeRequired:
        typeof data.pinChangeRequired === "boolean"
          ? data.pinChangeRequired
          : (session.pinChangeRequired ?? false),
      pinChangeReason:
        typeof data.pinChangeReason === "string" ||
        data.pinChangeReason === null
          ? (data.pinChangeReason ?? null)
          : (session.pinChangeReason ?? null),
      pinUpdatedAt:
        typeof data.pinUpdatedAt === "string" || data.pinUpdatedAt === null
          ? (data.pinUpdatedAt ?? null)
          : (session.pinUpdatedAt ?? null),
      pinExpiresAt:
        typeof data.pinExpiresAt === "string" || data.pinExpiresAt === null
          ? (data.pinExpiresAt ?? null)
          : (session.pinExpiresAt ?? null),
      user: data.user ?? session.user,
      permissions: data.permissions ?? session.permissions,
    };
    saveAuthSession(nextSession);
    return nextSession;
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  options?: { accessTokenOverride?: string | null },
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers = new Headers(init?.headers);
  const session = readAuthSession();

  if (
    !(typeof FormData !== "undefined" && init?.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const accessTokenOverride = options?.accessTokenOverride?.trim();
  if (accessTokenOverride && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessTokenOverride}`);
  } else if (session?.accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  let res = await fetch(url, {
    ...init,
    headers,
  });

  if (
    res.status === 401 &&
    path !== "/auth/login" &&
    path !== "/auth/refresh" &&
    session?.refreshToken
  ) {
    const refreshed = await refreshSessionToken(session);
    if (refreshed) {
      const retryHeaders = new Headers(init?.headers);
      if (
        !(typeof FormData !== "undefined" && init?.body instanceof FormData) &&
        !retryHeaders.has("Content-Type")
      ) {
        retryHeaders.set("Content-Type", "application/json");
      }
      retryHeaders.set("Authorization", `Bearer ${refreshed.accessToken}`);
      res = await fetch(url, {
        ...init,
        headers: retryHeaders,
      });
    }
  }

  if (
    res.status === 401 &&
    path !== "/auth/login" &&
    path !== "/auth/refresh"
  ) {
    clearAuthSession();
    if (
      typeof window !== "undefined" &&
      window.location.pathname !== "/login"
    ) {
      window.location.assign("/login");
    }
    throw new ApiError(401, "Session expired. Please log in again.");
  }

  if (!res.ok) {
    const rawBody = await res.text().catch(() => res.statusText);
    let message = rawBody;
    let code: string | undefined;
    try {
      const parsed = JSON.parse(rawBody) as {
        message?: string | string[];
        code?: string;
      };
      if (Array.isArray(parsed.message)) {
        message = parsed.message.join(" ");
      } else if (typeof parsed.message === "string") {
        message = parsed.message;
      }
      code = parsed.code;
    } catch {
      // rawBody wasn't JSON; fall back to it as-is
    }
    throw new ApiError(res.status, `${res.status} ${message}`, code);
  }

  const envelope: ApiEnvelope<T> = await res.json();
  return envelope.data;
}

function get<T>(path: string) {
  return request<T>(path);
}

function post<T>(path: string, body: unknown) {
  return request<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function put<T>(path: string, body: unknown) {
  return request<T>(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

function del<T>(path: string) {
  return request<T>(path, {
    method: "DELETE",
  });
}

function qs(params: Record<string, string | undefined>) {
  const entries = Object.entries(params).filter(
    (pair): pair is [string, string] => pair[1] !== undefined && pair[1] !== "",
  );
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries).toString();
}

// ── Dashboard ──────────────────────────────────────────────
export function fetchDashboardOverview(branchId?: string) {
  return get<DashboardOverview>(
    `/pos/overview${qs({ branchId: branchId === "all" ? undefined : branchId })}`,
  );
}

export type PosTerminalSettingsResponse = {
  id: string;
  branchId: string;
  name: string;
  defaultName: string;
  serialNumber: string;
  cashierName: string;
  status: "ONLINE" | "OFFLINE" | "SYNCING";
  lastSeenAt: string;
  hasCustomName: boolean;
  updatedAt: string | null;
};

export function fetchPosTerminals(branchId?: string) {
  return get<PosTerminalSettingsResponse[]>(
    `/pos/terminals${qs({ branchId: branchId === "all" ? undefined : branchId })}`,
  );
}

export function updatePosTerminalName(
  terminalId: string,
  payload: { name: string },
) {
  return put<PosTerminalSettingsResponse>(
    `/pos/terminals/${encodeURIComponent(terminalId)}`,
    payload,
  );
}

export function resetPosTerminalName(terminalId: string) {
  return del<PosTerminalSettingsResponse>(
    `/pos/terminals/${encodeURIComponent(terminalId)}`,
  );
}

// ── Receipts / Transactions ────────────────────────────────
export function fetchReceipts(branchId?: string) {
  return get<ReceiptsResponse>(
    `/pos/transactions${qs({ branchId: branchId === "all" ? undefined : branchId })}`,
  );
}

// ── Catalog ────────────────────────────────────────────────
export function fetchCatalog(branchId?: string) {
  return get<CatalogSnapshotResponse>(
    `/catalog/snapshot${qs({ branchId: branchId === "all" ? undefined : branchId })}`,
  );
}

export function replaceCatalogSnapshot(
  branchId: string,
  payload: {
    categories: Array<{
      id: string;
      name: string;
      color: string;
      groupName: string;
    }>;
    items: Array<{
      id: string;
      categoryId: string;
      name: string;
      sku: string;
      barcode: string;
      unit: string;
      price: number;
      vatType: string;
      trackInventory: boolean;
      hasVariants: boolean;
    }>;
  },
) {
  const sanitizedPayload = {
    categories: payload.categories.map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      groupName: category.groupName,
    })),
    items: payload.items.map((item) => ({
      id: item.id,
      categoryId: item.categoryId,
      name: item.name,
      sku: item.sku,
      barcode: item.barcode,
      unit: item.unit,
      price: item.price,
      vatType: item.vatType,
      trackInventory: item.trackInventory,
      hasVariants: item.hasVariants,
    })),
  };

  return put<CatalogSnapshotResponse>(
    `/catalog/snapshot/${encodeURIComponent(branchId)}`,
    sanitizedPayload,
  );
}

export type CustomerDisplaySettingsResponse = {
  branchId: string;
  thankYouMessage: string;
  launchFullscreen: boolean;
  imageDurationSeconds: number;
  updatedAt: string;
  assets: Array<{
    id: string;
    fileName: string;
    kind: "image" | "video";
    mimeType: string;
    sizeBytes: number;
    uploadedAt: string;
    url: string;
  }>;
};

export function fetchCustomerDisplaySettings(branchId: string) {
  return get<CustomerDisplaySettingsResponse>(
    `/customer-display/settings${qs({ branchId })}`,
  );
}

export function updateCustomerDisplaySettings(
  branchId: string,
  payload: {
    thankYouMessage: string;
    launchFullscreen: boolean;
    imageDurationSeconds: number;
    assetIds: string[];
  },
) {
  return put<CustomerDisplaySettingsResponse>(
    `/customer-display/settings/${branchId}`,
    payload,
  );
}

export function uploadCustomerDisplayAssets(branchId: string, files: File[]) {
  const body = new FormData();
  for (const file of files) {
    body.append("files", file);
  }

  return request<CustomerDisplaySettingsResponse>(
    `/customer-display/assets/${branchId}`,
    {
      method: "POST",
      body,
    },
  );
}

// ── Inventory ──────────────────────────────────────────────
export function fetchInventory(branchId?: string) {
  return get<InventorySummary[]>(
    `/inventory/stocks${qs({ branchId: branchId === "all" ? undefined : branchId })}`,
  );
}

export type InventoryAdjustmentRecord = {
  id: string;
  branchId: string;
  stockRowId: string;
  itemId?: string;
  itemName: string;
  warehouseName: string;
  action: "STOCK_IN" | "SET_BALANCE";
  quantity: number;
  previousQuantity: number;
  nextQuantity: number;
  reorderPoint: number;
  reason?: string;
  createdAt: string;
};

export function fetchInventoryAdjustments(branchId?: string) {
  return get<InventoryAdjustmentRecord[]>(
    `/inventory/adjustments${qs({ branchId: branchId === "all" ? undefined : branchId })}`,
  );
}

export type InventoryAdjustmentAction = "STOCK_IN" | "SET_BALANCE";

export type InventoryStockImportResponse = {
  branchId: string;
  importedCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
};

export function createInventoryAdjustment(payload: {
  branchId: string;
  itemId?: string;
  itemName: string;
  warehouseName: string;
  action: InventoryAdjustmentAction;
  quantity: number;
  reorderPoint: number;
  reason?: string;
}) {
  return post<InventorySummary>("/inventory/adjustments", payload);
}

export function importInventoryStocks(payload: {
  branchId: string;
  sourceFileName?: string;
  rows: Array<{
    itemId?: string;
    itemName: string;
    warehouseName: string;
    quantityOnHand: number;
    reorderPoint?: number;
  }>;
}) {
  return post<InventoryStockImportResponse>(
    "/inventory/stocks/import",
    payload,
  );
}

// ── Reports ────────────────────────────────────────────────
export function fetchSalesTrend() {
  return get<ReportPoint[]>("/reports/sales-trend");
}

export function fetchBranchComparison() {
  return get<BranchSummary[]>("/reports/branch-comparison");
}

export function fetchQueueBlueprint() {
  return get<QueueBlueprintEntry[]>("/reports/queue-blueprint");
}

export function fetchCashBalancing(branchId?: string) {
  return get<CashBalancingRow[]>(
    `/reports/cash-balancing${qs({ branchId: branchId === "all" ? undefined : branchId })}`,
  );
}

export function fetchSalesSummary(params: {
  branchId: string;
  terminalId?: string;
  cashierId?: string;
  date?: string;
  fromDate?: string;
  toDate?: string;
}) {
  return get<SalesSummaryResponse>(`/reports/sales-summary${qs(params)}`);
}

export function fetchEndOfDayReport(params: {
  branchId: string;
  terminalId?: string;
  date?: string;
}) {
  return get<EndOfDayReportResponse>(`/reports/end-of-day${qs(params)}`);
}

export function generateEndOfDayReport(payload: {
  branchId: string;
  terminalId?: string;
  cashierId?: string;
  date?: string;
  generatedBy?: string;
}) {
  return post<EndOfDayGeneratedReport>("/reports/end-of-day/generate", payload);
}

// ── Employees ──────────────────────────────────────────────
export function fetchEmployees(branchId?: string) {
  return get<EmployeeSummary[]>(
    `/employees${qs({ branchId: branchId === "all" ? undefined : branchId })}`,
  );
}

export function fetchManagedBranches() {
  return get<ManagedBranch[]>("/employees/branches");
}

export function createManagedBranch(payload: { name: string; id?: string }) {
  return post<ManagedBranch>("/employees/branches", payload);
}

export function deleteManagedBranch(branchId: string) {
  return del<{ id: string; name: string }>(
    `/employees/branches/${encodeURIComponent(branchId)}`,
  );
}

export function fetchManagedUsers(branchId?: string) {
  return get<ManagedUser[]>(
    `/employees/managed-users${qs({
      branchId: branchId === "all" ? undefined : branchId,
    })}`,
  );
}

export function fetchEmployeesAdminAuditLog(limit = 200) {
  return get<ManagedAdminAuditLogRecord[]>(
    `/employees/audit-log${qs({ limit: String(limit) })}`,
  );
}

export function createManagedUser(payload: {
  branchId: string;
  employeeCode: string;
  name: string;
  role: "ADMIN" | "SUPERVISOR" | "CASHIER" | "INVENTORY" | "AUDITOR";
  pin: string;
  isActive?: boolean;
}) {
  return post<ManagedUser>("/employees/managed-users", payload);
}

export function updateManagedUserStatus(
  userId: string,
  payload: { isActive: boolean },
) {
  return put<ManagedUser>(
    `/employees/managed-users/${encodeURIComponent(userId)}/status`,
    payload,
  );
}

export function fetchWorkHours(branchId?: string) {
  return get<
    Array<{
      employeeId: string;
      employeeName: string;
      hoursThisWeek: number;
      projectedPayroll: number;
    }>
  >(
    `/employees/work-hours${qs({ branchId: branchId === "all" ? undefined : branchId })}`,
  );
}

// ── Pricing & Payments ─────────────────────────────────────
export function fetchPricingConfig() {
  return get<PricingConfigResponse>("/pricing/config");
}

export function fetchPaymentMethods(branchId?: string) {
  return get<PaymentMethodConfig[]>(
    `/payments/methods${qs({ branchId: branchId === "all" ? undefined : branchId })}`,
  );
}

export function fetchPaymentSettings(branchId: string) {
  return get<PaymentSettingsResponse>(`/payments/settings${qs({ branchId })}`);
}

export function updatePaymentSettings(
  branchId: string,
  payload: {
    defaultMethod: PaymentMethod;
    methods: Array<{
      code: PaymentMethod;
      enabled: boolean;
    }>;
  },
) {
  return put<PaymentSettingsResponse>(
    `/payments/settings/${branchId}`,
    payload,
  );
}

// ── BIR ────────────────────────────────────────────────────
export function fetchBirZReadings(params?: {
  terminalId?: string;
  date?: string;
}) {
  return get<BirZReadingResponse[]>(`/bir/z-readings${qs(params ?? {})}`);
}

export function fetchBirXReading(params: {
  branchId: string;
  terminalId?: string;
}) {
  return get<BirXReadingResponse>(`/bir/x-reading${qs(params)}`);
}

export function fetchBirSettings(branchId: string) {
  return get<BirSettingsResponse>(`/bir/settings${qs({ branchId })}`);
}

export function updateBirSettings(
  branchId: string,
  payload: {
    birEnabled: boolean;
    autoZRead: boolean;
    storeName: string;
    proprietorName: string;
    vatTin: string;
    permitNumber: string;
    permitDateIssued: string;
    authorityToPrintNumber: string;
    authorityToPrintDateIssued: string;
    approvedSerialRange: string;
    machineIdentificationNumber: string;
    serialNumber: string;
    businessAddressLines: string[];
    footerLines: string[];
  },
) {
  return put<BirSettingsResponse>(`/bir/settings/${branchId}`, payload);
}

export function fetchBirZSummary(params: {
  branchId: string;
  terminalId?: string;
}) {
  return get<BirZSummaryResponse>(`/bir/z-summary${qs(params)}`);
}

export function generateBirZReading(payload: {
  branchId: string;
  terminalId: string;
  date?: string;
  generatedBy?: string;
}) {
  return post<BirZReadingResponse>("/bir/z-readings/generate", payload);
}

export type BirEisSubmissionStatus = "PENDING" | "SUBMITTED" | "FAILED";
export type BirEisSubmissionEventType = "SALE" | "REFUND" | "VOID";

export type BirEisSubmissionRecord = {
  id: string;
  transactionId: string;
  branchId: string;
  terminalId: string;
  orNumber: number;
  eventType: BirEisSubmissionEventType;
  status: BirEisSubmissionStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  retryCount: number;
  nextRetryAt: string | null;
  lastError: string | null;
  responseCode: number | null;
  remoteReference: string | null;
  payloadHash: string;
  lastAttemptAt: string | null;
  ackPayload?: unknown;
  mode: "REMOTE" | "SIMULATED" | "REMOTE_REQUIRED";
};

export type BirEisSubmissionsResponse = {
  items: BirEisSubmissionRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type BirEisSummaryResponse = {
  mode: "REMOTE" | "SIMULATED" | "REMOTE_REQUIRED";
  endpointConfigured: boolean;
  liveSubmissionReady: boolean;
  readinessIssues: string[];
  totals: {
    queued: number;
    submitted: number;
    pending: number;
    failed: number;
    retryDue: number;
  };
  lastSubmittedAt: string | null;
  fromDate: string;
  toDate: string;
  filedByDay: Array<{
    date: string;
    submitted: number;
    failed: number;
    pending: number;
  }>;
};

export type BirEisFlushResponse = {
  processed: number;
  submitted: number;
  failed: number;
  pending: number;
  mode: "REMOTE" | "SIMULATED" | "REMOTE_REQUIRED";
};

export function fetchBirEisSubmissions(params?: {
  branchId?: string;
  status?: BirEisSubmissionStatus | "all";
  page?: number;
  pageSize?: number;
}) {
  return get<BirEisSubmissionsResponse>(
    `/bir/eis/submissions${qs({
      branchId: params?.branchId === "all" ? undefined : params?.branchId,
      status: params?.status === "all" ? undefined : params?.status,
      page: params?.page !== undefined ? String(params.page) : undefined,
      pageSize:
        params?.pageSize !== undefined ? String(params.pageSize) : undefined,
    })}`,
  );
}

export function fetchBirEisSummary(params?: {
  branchId?: string;
  fromDate?: string;
  toDate?: string;
}) {
  return get<BirEisSummaryResponse>(
    `/bir/eis/summary${qs({
      branchId: params?.branchId === "all" ? undefined : params?.branchId,
      fromDate: params?.fromDate,
      toDate: params?.toDate,
    })}`,
  );
}

export function flushBirEisQueue(payload: {
  branchId?: string;
  maxItems?: number;
}) {
  return post<BirEisFlushResponse>("/bir/eis/flush", payload);
}

export function retryBirEisSubmission(payload: { submissionId: string }) {
  return post<{
    submission: BirEisSubmissionRecord;
    queueResult: BirEisFlushResponse;
  }>("/bir/eis/retry", payload);
}

// ── Sync ───────────────────────────────────────────────────
export function submitSyncBatch(payload: {
  branchId: string;
  terminalId: string;
  cursor?: string;
  entries: SyncQueueRecord[];
}) {
  return post<SyncBatchResponse>("/sync/batch", payload);
}

// ── Auth ───────────────────────────────────────────────────
export function login(payload: {
  branchId: string;
  terminalId: string;
  employeeCode: string;
  pin: string;
  mfaCode?: string;
}) {
  return post<AuthLoginResponse>("/auth/login", payload);
}

export function signupOrganization(payload: {
  businessName: string;
  ownerEmail: string;
  ownerName: string;
  employeeCode: string;
  pin: string;
}) {
  return post<AuthLoginResponse>("/organizations/signup", payload);
}

export function getMyOrganization() {
  return get<OrganizationSummary>("/organizations/me");
}

export function changeOwnPin(
  payload: { currentPin: string; newPin: string },
  options?: { accessTokenOverride?: string | null },
) {
  return request<ChangePinResponse>(
    "/auth/change-pin",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    options,
  );
}

// ── POS Transactions ───────────────────────────────────────
export function fetchAccountProfile() {
  return get<AccountProfileResponse>("/account/profile");
}

export function updateAccountProfile(payload: {
  companyName: string;
  companyDescription: string;
}) {
  return put<AccountProfileResponse>("/account/profile", payload);
}

export function fetchMfaStatus() {
  return get<MfaStatusResponse>("/account/mfa");
}

export function beginMfaSetup() {
  return post<MfaSetupResponse>("/account/mfa/setup", {});
}

export function confirmMfaSetup(code: string) {
  return post<MfaConfirmResponse>("/account/mfa/confirm", { code });
}

export function disableMfa(code: string) {
  return post<MfaDisableResponse>("/account/mfa/disable", { code });
}

export function resetAccountPassword() {
  return post<AccountDangerActionResponse>("/account/reset-password", {});
}

export function resetAccountTransactions() {
  return post<AccountDangerActionResponse>("/account/reset-transactions", {});
}

export function resetAccountShiftManagement() {
  return post<AccountDangerActionResponse>(
    "/account/reset-shift-management",
    {},
  );
}

export function resetAccountInventoryManagement() {
  return post<AccountDangerActionResponse>(
    "/account/reset-inventory-management",
    {},
  );
}

export function resetAccountEmployeeManagement() {
  return post<AccountDangerActionResponse>(
    "/account/reset-employee-management",
    {},
  );
}

export function deleteAccount() {
  return post<AccountDangerActionResponse>("/account/delete-account", {});
}

export function createTransaction(payload: unknown) {
  return post<ReceiptRecord>("/pos/transactions", payload);
}

export function voidTransaction(transactionId: string, payload: unknown) {
  return post<{ voidId: string; transaction: ReceiptRecord }>(
    `/pos/transactions/${transactionId}/void`,
    payload,
  );
}

export function refundTransaction(transactionId: string, payload: unknown) {
  return post<ReceiptRecord>(
    `/pos/transactions/${transactionId}/refund`,
    payload,
  );
}

export function fetchAuditTrail(params?: Record<string, string>) {
  return get<{
    items: Array<{
      id: string;
      branchId: string;
      userId?: string;
      action: string;
      tableName: string;
      recordId: string;
      oldVal?: unknown;
      newVal?: unknown;
      createdAt: string;
      previousHash: string | null;
      hash: string;
    }>;
    total: number;
  }>(`/pos/audit-trail${qs(params ?? {})}`);
}

// ── Health ─────────────────────────────────────────────────
export function fetchHealth() {
  return get<HealthResponse>("/health");
}

export { ApiError };
