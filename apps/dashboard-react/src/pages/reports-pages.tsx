import {
  useDeferredValue,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { InventorySummary, ReceiptRecord } from "@apex-pos/shared-types";
import { useQuery } from "@tanstack/react-query";
import type { ManagedUser } from "../lib/api-client";
import {
  AlertTriangle,
  ArrowRightLeft,
  BadgePercent,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  Landmark,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UsersRound,
  Wallet,
} from "lucide-react";
import { PageHeader } from "../components/ui/page-header";
import { SectionCard } from "../components/ui/section-card";
import { StatusPill } from "../components/ui/status-pill";
import { useCashBalancing } from "../hooks/use-cash-balancing";
import { useReceipts } from "../hooks/use-receipts";
import { useReports } from "../hooks/use-reports";
import {
  fetchBirSettings,
  fetchInventory,
  fetchManagedUsers,
  type BirSettingsResponse,
} from "../lib/api-client";
import { normalizeCashierName } from "../lib/cashier-options";
import { formatCurrency, formatDateTime } from "../lib/utils";
import { readAuthSession } from "../lib/auth-session";
import { useBirTerminalReadingStore } from "../store/bir-terminal-reading-store";
import { useUiStore } from "../store/ui-store";

const TransactionBarChart = lazy(() =>
  import("../components/charts/transaction-bar-chart").then((module) => ({
    default: module.TransactionBarChart,
  })),
);

const SOFTWARE_NAME = "BIGTIME POS";
const SOFTWARE_VERSION = "1.0.0";

const shiftSummaries: {
  cashier: string;
  terminal: string;
  openedAt: string;
  grossSales: number;
  status: string;
}[] = [];

const expiryAlerts: {
  item: string;
  warehouse: string;
  expiresOn: string;
  daysLeft: number;
}[] = [];

const discountUsage: {
  type: string;
  cashier: string;
  reference: string;
  amount: number;
}[] = [];

const pullOutRecords: {
  item: string;
  quantity: number;
  approvedBy: string;
  reason: string;
}[] = [];

type BirTaxRow = {
  id: string;
  transactionNumber: number;
  date: string;
  time: string;
  grossTotal: number;
  vatableSales: number;
  vatExemptSales: number;
  vatAmount: number;
  scPwdDiscount: number;
  customerCount: number;
  seniorCount: number;
  pwdCount: number;
  refundTotal: number;
  itemDiscountTotal: number;
};

const birTaxRows: BirTaxRow[] = [];

function sumBirTaxRows(rows: BirTaxRow[]) {
  return rows.reduce(
    (totals, row) => ({
      grossTotal: totals.grossTotal + row.grossTotal,
      refundTotal: totals.refundTotal + row.refundTotal,
      itemDiscountTotal: totals.itemDiscountTotal + row.itemDiscountTotal,
      vatableSales: totals.vatableSales + row.vatableSales,
      vatExemptSales: totals.vatExemptSales + row.vatExemptSales,
      scPwdDiscount: totals.scPwdDiscount + row.scPwdDiscount,
      vatAmount: totals.vatAmount + row.vatAmount,
      customerCount: totals.customerCount + row.customerCount,
      seniorCount: totals.seniorCount + row.seniorCount,
      pwdCount: totals.pwdCount + row.pwdCount,
    }),
    {
      grossTotal: 0,
      refundTotal: 0,
      itemDiscountTotal: 0,
      vatableSales: 0,
      vatExemptSales: 0,
      scPwdDiscount: 0,
      vatAmount: 0,
      customerCount: 0,
      seniorCount: 0,
      pwdCount: 0,
    },
  );
}

interface EsalesDailyRow {
  date: string;
  beginningSi: string;
  endingSi: string;
  grandAccumSalesEnding: number;
  grandAccumSalesBeginning: number;
  salesIssued: number;
  vatAmount: number;
  vatableSales: number;
  vatExemptSales: number;
  zeroRatedSales: number;
  governmentDiscount: number;
  regularDiscount: number;
  returns: number;
  voids: number;
  totalDeductions: number;
}

function generateEsalesDailyData(): EsalesDailyRow[] {
  return [];
}

const esalesDailyData = generateEsalesDailyData();

function ReportShell({
  eyebrow,
  title,
  description,
  children,
}: React.PropsWithChildren<{
  eyebrow: string;
  title: string;
  description: string;
}>) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      {children}
    </div>
  );
}

function ReportBadge({ value }: { value: string }) {
  return (
    <div className="rounded-full bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--muted)]">
      {value}
    </div>
  );
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function csvRow(values: unknown[]) {
  return values.map(csvCell).join(",");
}

function buildBirMetadataRows({
  reportTitle,
  branchId,
  birSettings,
  coveredPeriod,
}: {
  reportTitle: string;
  branchId: string;
  birSettings?: BirSettingsResponse;
  coveredPeriod?: string;
}) {
  const branchLabel =
    branchId === "all"
      ? "All Branches"
      : birSettings?.storeName.trim() || branchId;
  const address =
    birSettings?.businessAddressLines.filter(Boolean).join(", ") || "Not configured";
  const tinLabel = birSettings?.vatTin.trim()
    ? `VAT REG TIN ${birSettings.vatTin.trim()}`
    : "Not configured";
  const session = readAuthSession();
  const generatedBy = session
    ? `${session.user.name} (${session.user.employeeCode})`
    : "Unknown";

  return [
    csvRow(["Report", reportTitle]),
    csvRow(["Software Name", SOFTWARE_NAME]),
    csvRow(["Software Version", SOFTWARE_VERSION]),
    csvRow(["Generated At", formatDateTime(new Date().toISOString())]),
    csvRow(["Generated By", generatedBy]),
    csvRow(["Branch", branchLabel]),
    csvRow(["Registered Name", birSettings?.storeName.trim() || "Not configured"]),
    csvRow(["Registered Address", address]),
    csvRow(["TIN", tinLabel]),
    csvRow(["Permit / ATP", birSettings?.permitNumber.trim() || "Not configured"]),
    csvRow([
      "Machine Identification Number",
      birSettings?.machineIdentificationNumber.trim() || "Not configured",
    ]),
    csvRow(["Serial Number", birSettings?.serialNumber.trim() || "Not configured"]),
    ...(coveredPeriod ? [csvRow(["Covered Period", coveredPeriod])] : []),
    "",
  ];
}

function reportTone(
  status: string,
): "success" | "warning" | "danger" | "neutral" {
  if (
    status === "OPEN" ||
    status === "READY" ||
    status === "FILED" ||
    status === "CLOSED"
  ) {
    return "success";
  }

  if (status === "BALANCING" || status === "ARCHIVED") {
    return "warning";
  }

  return "neutral";
}

function ChartFallback() {
  return <div className="h-full rounded-3xl bg-[color:var(--surface-soft)]" />;
}

type SalesSummaryRow = {
  id: string;
  label: string;
  txnCount: number;
  grossSales: number;
  payOut: number;
  itemCost: number;
  grossProfit: number;
  serviceFee: number;
  diningOptionFee: number;
  includedTax: number;
  addedTax: number;
  discount: number;
  refund: number;
  netSales: number;
};

function parseReportDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function normalizeReportDateRange(startDate: string, endDate: string) {
  return parseReportDate(startDate) <= parseReportDate(endDate)
    ? { startDate, endDate }
    : { startDate: endDate, endDate: startDate };
}

function formatReportHourLabel(hour: number) {
  const period = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalizedHour}:00 ${period}`;
}

const reportDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
});

function getReportDateTimeParts(value: string) {
  const parts = reportDateTimeFormatter.formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");

  return {
    dayKey: `${year}-${month}-${day}`,
    hour,
  };
}

function roundReportAmount(value: number) {
  return Number(value.toFixed(2));
}

function buildSalesSummaryRowsFromReceipts(
  receipts: ReceiptRecord[],
  range: { startDate: string; endDate: string },
  cashierFilter: string,
  managedUsers: ManagedUser[],
) {
  const rows = Array.from(
    { length: 24 },
    (_, hour) =>
      ({
        id: `sales-hour-${hour}`,
        label: formatReportHourLabel(hour),
        txnCount: 0,
        grossSales: 0,
        payOut: 0,
        itemCost: 0,
        grossProfit: 0,
        serviceFee: 0,
        diningOptionFee: 0,
        includedTax: 0,
        addedTax: 0,
        discount: 0,
        refund: 0,
        netSales: 0,
      }) satisfies SalesSummaryRow,
  );

  for (const receipt of receipts) {
    const { dayKey, hour } = getReportDateTimeParts(receipt.createdAt);

    if (dayKey < range.startDate || dayKey > range.endDate) {
      continue;
    }

    if (
      cashierFilter !== "all" &&
      normalizeCashierName(receipt.cashierName, managedUsers) !== cashierFilter
    ) {
      continue;
    }

    const row = rows[hour];
    const total = Number(receipt.total ?? 0);
    const discount = Number(receipt.discountAmount ?? 0);
    const vat = Number(receipt.vatAmount ?? 0);
    const isSale =
      receipt.status === "COMPLETED" || receipt.status === "REFUNDED";
    const isRefund = receipt.status === "RETURNED";

    if (isSale) {
      row.txnCount += 1;
      row.grossSales += total;
      row.discount += discount;
      row.includedTax += vat;
    }

    if (isRefund) {
      row.refund += total;
      row.includedTax -= vat;
    }
  }

  return rows.map((row) => {
    const grossSales = roundReportAmount(row.grossSales);
    const refund = roundReportAmount(row.refund);
    const discount = roundReportAmount(row.discount);
    const includedTax = roundReportAmount(row.includedTax);
    const netSales = roundReportAmount(grossSales - refund);
    const itemCost = roundReportAmount(row.itemCost);

    return {
      ...row,
      grossSales,
      discount,
      refund,
      includedTax,
      netSales,
      itemCost,
      grossProfit: roundReportAmount(netSales - itemCost),
    } satisfies SalesSummaryRow;
  });
}

function sumSalesSummaryRows(rows: SalesSummaryRow[]) {
  return rows.reduce(
    (totals, row) => ({
      txnCount: totals.txnCount + row.txnCount,
      grossSales: totals.grossSales + row.grossSales,
      payOut: totals.payOut + row.payOut,
      itemCost: totals.itemCost + row.itemCost,
      grossProfit: totals.grossProfit + row.grossProfit,
      serviceFee: totals.serviceFee + row.serviceFee,
      diningOptionFee: totals.diningOptionFee + row.diningOptionFee,
      includedTax: totals.includedTax + row.includedTax,
      addedTax: totals.addedTax + row.addedTax,
      discount: totals.discount + row.discount,
      refund: totals.refund + row.refund,
      netSales: totals.netSales + row.netSales,
    }),
    {
      txnCount: 0,
      grossSales: 0,
      payOut: 0,
      itemCost: 0,
      grossProfit: 0,
      serviceFee: 0,
      diningOptionFee: 0,
      includedTax: 0,
      addedTax: 0,
      discount: 0,
      refund: 0,
      netSales: 0,
    },
  );
}

function downloadSalesCsv(
  rows: SalesSummaryRow[],
  totals: ReturnType<typeof sumSalesSummaryRows>,
  options: {
    branchId: string;
    birSettings?: BirSettingsResponse;
    coveredPeriod: string;
  },
) {
  const header = [
    "Date/Time",
    "Txn Count",
    "Gross Sales",
    "Pay Out",
    "Item Cost",
    "Gross Profit",
    "Service Fee",
    "Dining Option Fee",
    "Included Tax",
    "Added Tax",
    "Discount",
    "Refund",
    "Net Sales",
  ];

  const lines = [
    ...buildBirMetadataRows({
      reportTitle: "Sales Summary Report",
      branchId: options.branchId,
      birSettings: options.birSettings,
      coveredPeriod: options.coveredPeriod,
    }),
    header.join(","),
    ...rows.map((row) =>
      [
        row.label,
        row.txnCount,
        row.grossSales.toFixed(2),
        row.payOut.toFixed(2),
        row.itemCost.toFixed(2),
        row.grossProfit.toFixed(2),
        row.serviceFee.toFixed(2),
        row.diningOptionFee.toFixed(2),
        row.includedTax.toFixed(2),
        row.addedTax.toFixed(2),
        row.discount.toFixed(2),
        row.refund.toFixed(2),
        row.netSales.toFixed(2),
      ].join(","),
    ),
    [
      "Total",
      totals.txnCount,
      totals.grossSales.toFixed(2),
      totals.payOut.toFixed(2),
      totals.itemCost.toFixed(2),
      totals.grossProfit.toFixed(2),
      totals.serviceFee.toFixed(2),
      totals.diningOptionFee.toFixed(2),
      totals.includedTax.toFixed(2),
      totals.addedTax.toFixed(2),
      totals.discount.toFixed(2),
      totals.refund.toFixed(2),
      totals.netSales.toFixed(2),
    ].join(","),
  ];

  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sales-summary-report.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsSalesPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch);
  const appliedFilters = useUiStore((state) => state.dateFilters);
  const receiptsQuery = useReceipts(selectedBranch);
  const birSettingsQuery = useQuery({
    queryKey: ["bir-settings", selectedBranch],
    queryFn: () => fetchBirSettings(selectedBranch),
    enabled: selectedBranch !== "all",
  });
  const managedUsersQuery = useQuery({
    queryKey: ["managed-users", selectedBranch],
    queryFn: () => fetchManagedUsers(selectedBranch),
  });
  const [searchValue, setSearchValue] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const deferredSearch = useDeferredValue(searchValue.trim().toLowerCase());

  const normalizedRange = useMemo(
    () =>
      normalizeReportDateRange(
        appliedFilters.startDate,
        appliedFilters.endDate,
      ),
    [appliedFilters.startDate, appliedFilters.endDate],
  );
  const managedUsers = managedUsersQuery.data ?? [];
  const allRows = useMemo(
    () =>
      buildSalesSummaryRowsFromReceipts(
        receiptsQuery.data ?? [],
        normalizedRange,
        appliedFilters.cashier,
        managedUsers,
      ),
    [receiptsQuery.data, normalizedRange, appliedFilters.cashier, managedUsers],
  );
  const filteredRows = useMemo(() => {
    if (!deferredSearch) {
      return allRows;
    }

    return allRows.filter((row) =>
      row.label.toLowerCase().includes(deferredSearch),
    );
  }, [allRows, deferredSearch]);
  const totalRow = useMemo(
    () => sumSalesSummaryRows(filteredRows),
    [filteredRows],
  );
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const paginatedRows = filteredRows.slice(
    safePageIndex * pageSize,
    safePageIndex * pageSize + pageSize,
  );
  const pageStart =
    filteredRows.length === 0 ? 0 : safePageIndex * pageSize + 1;
  const pageEnd = Math.min(filteredRows.length, (safePageIndex + 1) * pageSize);
  const allVisibleSelected =
    paginatedRows.length > 0 &&
    paginatedRows.every((row) => selectedRowIds.includes(row.id));

  function handleSearchChange(value: string) {
    setSearchValue(value);
    setPageIndex(0);
  }

  function handlePageSizeChange(value: number) {
    setPageSize(value);
    setPageIndex(0);
  }

  function toggleAllVisibleRows() {
    setSelectedRowIds((current) => {
      if (allVisibleSelected) {
        return current.filter(
          (id) => !paginatedRows.some((row) => row.id === id),
        );
      }

      return Array.from(
        new Set([...current, ...paginatedRows.map((row) => row.id)]),
      );
    });
  }

  function toggleRow(rowId: string) {
    setSelectedRowIds((current) =>
      current.includes(rowId)
        ? current.filter((id) => id !== rowId)
        : [...current, rowId],
    );
  }

  return (
    <ReportShell
      eyebrow="Reports"
      title="Sales"
      description="Analyze your sales performance with hourly metrics, totals, and export-ready reporting from one screen."
    >
      <div className="space-y-6">
        <SectionCard
          title="Sales Summary"
          description="Analyze your sales performance with comprehensive metrics, trends, and transaction details. Filter by date ranges, products, or payment methods to gain valuable insights."
          action={
            <button
              type="button"
              onClick={() =>
                downloadSalesCsv(filteredRows, totalRow, {
                  branchId: selectedBranch,
                  birSettings: birSettingsQuery.data,
                  coveredPeriod: `${normalizedRange.startDate} to ${normalizedRange.endDate}`,
                })
              }
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm font-medium text-slate-800 transition hover:bg-[color:var(--surface-soft)]"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Sales Report
            </button>
          }
        >
          <div className="space-y-5">
            <label className="relative block max-w-[250px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
              <input
                value={searchValue}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Search ..."
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
              />
            </label>

            <div className="overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--panel-strong)]">
              <div className="overflow-x-auto">
                <table className="min-w-[1320px] w-full border-collapse text-left text-sm">
                  <thead className="bg-[color:var(--surface-soft)] text-sm font-semibold text-[#637b94]">
                    <tr>
                      <th className="w-12 px-3 py-3">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleAllVisibleRows}
                          className="h-4 w-4 rounded border-slate-300"
                          aria-label="Select visible sales rows"
                        />
                      </th>
                      <th className="px-3 py-3">Date/Time</th>
                      <th className="px-3 py-3">Txn Count</th>
                      <th className="px-3 py-3">Gross Sales</th>
                      <th className="px-3 py-3">Pay Out</th>
                      <th className="px-3 py-3">Item Cost</th>
                      <th className="px-3 py-3">Gross Profit</th>
                      <th className="px-3 py-3">Service Fee</th>
                      <th className="px-3 py-3">Dining Option Fee</th>
                      <th className="px-3 py-3">Included Tax</th>
                      <th className="px-3 py-3">Added Tax</th>
                      <th className="px-3 py-3">Discount</th>
                      <th className="px-3 py-3">Refund</th>
                      <th className="px-3 py-3">Net Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-t border-[color:var(--border)] text-slate-900"
                      >
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedRowIds.includes(row.id)}
                            onChange={() => toggleRow(row.id)}
                            className="h-4 w-4 rounded border-slate-300"
                            aria-label={`Select ${row.label}`}
                          />
                        </td>
                        <td className="px-3 py-3 font-medium">{row.label}</td>
                        <td className="px-3 py-3">{row.txnCount}</td>
                        <td className="px-3 py-3">
                          {formatCurrency(row.grossSales)}
                        </td>
                        <td className="px-3 py-3">
                          {formatCurrency(row.payOut)}
                        </td>
                        <td className="px-3 py-3">
                          {formatCurrency(row.itemCost)}
                        </td>
                        <td className="px-3 py-3">
                          {formatCurrency(row.grossProfit)}
                        </td>
                        <td className="px-3 py-3">
                          {formatCurrency(row.serviceFee)}
                        </td>
                        <td className="px-3 py-3">
                          {formatCurrency(row.diningOptionFee)}
                        </td>
                        <td className="px-3 py-3">
                          {formatCurrency(row.includedTax)}
                        </td>
                        <td className="px-3 py-3">
                          {formatCurrency(row.addedTax)}
                        </td>
                        <td className="px-3 py-3">
                          {formatCurrency(row.discount)}
                        </td>
                        <td className="px-3 py-3">
                          {formatCurrency(row.refund)}
                        </td>
                        <td className="px-3 py-3">
                          {formatCurrency(row.netSales)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-[color:var(--border)] bg-[color:var(--header-tint)] font-semibold text-slate-950">
                    <tr>
                      <td className="px-3 py-3" />
                      <td className="px-3 py-3">Total</td>
                      <td className="px-3 py-3">{totalRow.txnCount}</td>
                      <td className="px-3 py-3">
                        {formatCurrency(totalRow.grossSales)}
                      </td>
                      <td className="px-3 py-3">
                        {formatCurrency(totalRow.payOut)}
                      </td>
                      <td className="px-3 py-3">
                        {formatCurrency(totalRow.itemCost)}
                      </td>
                      <td className="px-3 py-3">
                        {formatCurrency(totalRow.grossProfit)}
                      </td>
                      <td className="px-3 py-3">
                        {formatCurrency(totalRow.serviceFee)}
                      </td>
                      <td className="px-3 py-3">
                        {formatCurrency(totalRow.diningOptionFee)}
                      </td>
                      <td className="px-3 py-3">
                        {formatCurrency(totalRow.includedTax)}
                      </td>
                      <td className="px-3 py-3">
                        {formatCurrency(totalRow.addedTax)}
                      </td>
                      <td className="px-3 py-3">
                        {formatCurrency(totalRow.discount)}
                      </td>
                      <td className="px-3 py-3">
                        {formatCurrency(totalRow.refund)}
                      </td>
                      <td className="px-3 py-3">
                        {formatCurrency(totalRow.netSales)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-6 text-sm text-[color:var(--muted)]">
                No sales rows match the current date, cashier, and search
                filters.
              </div>
            ) : null}

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-end">
              <div className="flex items-center gap-3 text-sm text-slate-700">
                <span>No. of rows</span>
                <select
                  value={pageSize}
                  onChange={(event) =>
                    handlePageSizeChange(Number(event.target.value))
                  }
                  className="h-10 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-3 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                >
                  <option value={10}>10</option>
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                </select>
              </div>

              <div className="text-sm text-slate-700">
                {pageStart}-{pageEnd} of {filteredRows.length}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPageIndex(0)}
                  disabled={safePageIndex === 0}
                  className="inline-flex h-10 min-w-10 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-3 text-sm text-slate-700 transition hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {"<<"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPageIndex(Math.max(0, safePageIndex - 1))
                  }
                  disabled={safePageIndex === 0}
                  className="inline-flex h-10 min-w-10 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-3 text-sm text-slate-700 transition hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {"<"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPageIndex(Math.min(totalPages - 1, safePageIndex + 1))
                  }
                  disabled={safePageIndex >= totalPages - 1}
                  className="inline-flex h-10 min-w-10 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-3 text-sm text-slate-700 transition hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {">"}
                </button>
                <button
                  type="button"
                  onClick={() => setPageIndex(Math.max(0, totalPages - 1))}
                  disabled={safePageIndex >= totalPages - 1}
                  className="inline-flex h-10 min-w-10 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-3 text-sm text-slate-700 transition hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {">>"}
                </button>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </ReportShell>
  );
}

export function ReportsBranchComparisonPage() {
  const reportsQuery = useReports();
  const data = reportsQuery.data;

  return (
    <ReportShell
      eyebrow="Reports"
      title="Branch Comparison"
      description="Compare branch performance, open shifts, and active terminals side by side for quick operations review."
    >
      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <SectionCard
          title="Sales by branch"
          description="Relative volume is easier to spot when the weekly series stays aligned to the same comparison window."
        >
          <div className="h-[320px]">
            <Suspense fallback={<ChartFallback />}>
              <TransactionBarChart data={data?.series ?? []} />
            </Suspense>
          </div>
        </SectionCard>

        <SectionCard
          title="Branch snapshot"
          description="This summary mirrors the branch comparison dashboard module in the architecture plan."
        >
          <div className="space-y-3">
            {data?.branches?.map((branch) => (
              <article key={branch.id} className="rounded-3xl bg-[color:var(--surface-soft)] p-4">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-[color:var(--accent)]" />
                  <div>
                    <p className="section-title text-lg font-bold">
                      {branch.name}
                    </p>
                    <p className="text-sm text-[color:var(--muted)]">
                      {branch.activeTerminals} active terminals
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-[color:var(--muted)]">
                  <p>
                    Gross sales today: {formatCurrency(branch.grossSalesToday)}
                  </p>
                  <p>Open shifts: {branch.openShifts}</p>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </ReportShell>
  );
}

export function ReportsShiftPage() {
  return (
    <ReportShell
      eyebrow="Reports"
      title="Shift"
      description="Review cashier shifts, their current state, and the sales volume each terminal has processed so far."
    >
      <SectionCard
        title="Shift summaries"
        description="Shift reporting supports balancing, cashier accountability, and daily operations review."
        action={
          <ReportBadge value={`${shiftSummaries.length} active records`} />
        }
      >
        <div className="grid gap-4 xl:grid-cols-3">
          {shiftSummaries.map((shift) => (
            <article
              key={`${shift.cashier}-${shift.terminal}`}
              className="rounded-3xl bg-[color:var(--surface-soft)] p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Clock3 className="h-5 w-5 text-[color:var(--accent)]" />
                  <div>
                    <p className="section-title text-lg font-bold">
                      {shift.cashier}
                    </p>
                    <p className="text-sm text-[color:var(--muted)]">
                      {shift.terminal}
                    </p>
                  </div>
                </div>
                <StatusPill
                  tone={reportTone(shift.status)}
                  label={shift.status}
                />
              </div>
              <div className="mt-4 grid gap-2 text-sm text-[color:var(--muted)]">
                <p>Opened: {formatDateTime(shift.openedAt)}</p>
                <p>Gross sales: {formatCurrency(shift.grossSales)}</p>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </ReportShell>
  );
}

export function ReportsCashBalancingPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch);
  const balancingQuery = useCashBalancing(selectedBranch);
  const rows = useMemo(() => balancingQuery.data ?? [], [balancingQuery.data]);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filtered = useMemo(() => {
    if (statusFilter === "ALL") return rows;
    return rows.filter((row) => row.status === statusFilter);
  }, [rows, statusFilter]);

  const totalExpected = rows.reduce((sum, r) => sum + r.expected, 0);
  const closedRows = rows.filter((r) => r.variance !== null);
  const totalVariance = closedRows.reduce(
    (sum, r) => sum + (r.variance ?? 0),
    0,
  );
  const shortCount = closedRows.filter((r) => (r.variance ?? 0) < 0).length;
  const overCount = closedRows.filter((r) => (r.variance ?? 0) > 0).length;
  const balancedCount = closedRows.filter((r) => r.variance === 0).length;

  return (
    <ReportShell
      eyebrow="Reports"
      title="Cash Balancing"
      description="Compare expected versus actual cash per shift before closeout and surface variances immediately."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl bg-[color:var(--surface-soft)] p-5">
          <p className="text-sm text-[color:var(--muted)]">Total Expected</p>
          <p className="mt-1 text-2xl font-bold">
            {formatCurrency(totalExpected)}
          </p>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            {rows.length} shift(s)
          </p>
        </article>
        <article className="rounded-3xl bg-[color:var(--surface-soft)] p-5">
          <p className="text-sm text-[color:var(--muted)]">Net Variance</p>
          <p
            className={`mt-1 text-2xl font-bold ${totalVariance < 0 ? "text-red-600" : totalVariance > 0 ? "text-amber-600" : "text-emerald-600"}`}
          >
            {totalVariance >= 0 ? "+" : ""}
            {formatCurrency(totalVariance)}
          </p>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            {closedRows.length} counted
          </p>
        </article>
        <article className="rounded-3xl bg-[color:var(--surface-soft)] p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <p className="text-sm text-[color:var(--muted)]">Balanced</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {balancedCount}
          </p>
        </article>
        <article className="rounded-3xl bg-[color:var(--surface-soft)] p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <p className="text-sm text-[color:var(--muted)]">With Variance</p>
          </div>
          <p className="mt-1 text-2xl font-bold">
            <span className="text-red-600">{shortCount} short</span>
            {" / "}
            <span className="text-amber-600">{overCount} over</span>
          </p>
        </article>
      </div>

      <SectionCard
        title="Balancing checks"
        description="Cash discrepancies are surfaced before final shift closure and audit sign-off."
        action={
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-full bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--muted)] outline-none"
            >
              <option value="ALL">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="BALANCING">Balancing</option>
              <option value="CLOSED">Closed</option>
            </select>
            <ReportBadge value={`${filtered.length} balancing rows`} />
          </div>
        }
      >
        <div className="grid gap-4 xl:grid-cols-3">
          {filtered.map((row) => {
            const hasVariance = row.variance !== null && row.variance !== 0;
            const isShort = (row.variance ?? 0) < 0;

            return (
              <article
                key={row.id}
                className={`rounded-3xl p-5 transition-colors ${
                  hasVariance
                    ? isShort
                      ? "bg-red-50 ring-1 ring-red-200"
                      : "bg-amber-50 ring-1 ring-amber-200"
                    : "bg-[color:var(--surface-soft)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-[color:var(--accent)]" />
                    <div>
                      <p className="section-title text-lg font-bold">
                        {row.shift}
                      </p>
                      <p className="text-sm text-[color:var(--muted)]">
                        {row.cashier} &middot; {row.terminal}
                      </p>
                    </div>
                  </div>
                  <StatusPill
                    tone={reportTone(row.status)}
                    label={row.status}
                  />
                </div>

                <div className="mt-4 grid gap-1 text-sm text-[color:var(--muted)]">
                  <p>Opened: {formatDateTime(row.openedAt)}</p>
                  {row.closedAt && (
                    <p>Closed: {formatDateTime(row.closedAt)}</p>
                  )}
                </div>

                <div className="mt-3 rounded-2xl bg-[color:var(--surface-soft)] p-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-[color:var(--muted)]">
                        Opening cash
                      </p>
                      <p className="font-medium">
                        {formatCurrency(row.openingCash)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[color:var(--muted)]">
                        Cash sales
                      </p>
                      <p className="font-medium">
                        {formatCurrency(row.cashSales)}
                      </p>
                    </div>
                    {(row.cashReturns > 0 ||
                      row.payIn > 0 ||
                      row.payOut > 0) && (
                      <>
                        {row.cashReturns > 0 && (
                          <div>
                            <p className="text-xs text-[color:var(--muted)]">
                              Returns
                            </p>
                            <p className="font-medium text-red-600">
                              -{formatCurrency(row.cashReturns)}
                            </p>
                          </div>
                        )}
                        {row.payIn > 0 && (
                          <div>
                            <p className="text-xs text-[color:var(--muted)]">
                              Pay in
                            </p>
                            <p className="font-medium text-emerald-600">
                              +{formatCurrency(row.payIn)}
                            </p>
                          </div>
                        )}
                        {row.payOut > 0 && (
                          <div>
                            <p className="text-xs text-[color:var(--muted)]">
                              Pay out
                            </p>
                            <p className="font-medium text-red-600">
                              -{formatCurrency(row.payOut)}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-[color:var(--border)] pt-3">
                  <div>
                    <p className="text-xs text-[color:var(--muted)]">
                      Expected
                    </p>
                    <p className="text-base font-bold">
                      {formatCurrency(row.expected)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[color:var(--muted)]">Actual</p>
                    <p className="text-base font-bold">
                      {row.actual !== null ? formatCurrency(row.actual) : "---"}
                    </p>
                  </div>
                </div>

                {row.variance !== null && (
                  <div
                    className={`mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
                      row.variance === 0
                        ? "bg-emerald-100 text-emerald-700"
                        : row.variance < 0
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {row.variance === 0 ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : row.variance < 0 ? (
                      <TrendingDown className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingUp className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {row.variance === 0
                        ? "Balanced"
                        : `${row.variance > 0 ? "+" : ""}${formatCurrency(row.variance)} variance`}
                    </span>
                  </div>
                )}

                {row.status === "OPEN" && row.actual === null && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600">
                    <Clock3 className="h-3.5 w-3.5" />
                    <span>Awaiting cash count</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="mt-4 rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-6 text-sm text-[color:var(--muted)]">
            No balancing records found for the selected branch and status
            filter.
          </div>
        )}
      </SectionCard>
    </ReportShell>
  );
}

export function ReportsReferenceNumberPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch);
  const globalSearch = useUiStore((state) => state.globalSearch);
  const deferredSearch = useDeferredValue(globalSearch.toLowerCase());
  const receiptsQuery = useReceipts(selectedBranch);

  const filteredReceipts = (receiptsQuery.data ?? []).filter((receipt) => {
    if (!deferredSearch) {
      return true;
    }

    return (
      receipt.refNumber.toLowerCase().includes(deferredSearch) ||
      String(receipt.orNumber).includes(deferredSearch)
    );
  });

  return (
    <ReportShell
      eyebrow="Reports"
      title="Reference Number"
      description="Search OR numbers and reference codes quickly when validating a specific sale, void, or return."
    >
      <SectionCard
        title="Reference lookup"
        description="Reference matching uses the same receipt sample data that powers the receipt traceability page."
        action={
          <ReportBadge value={`${filteredReceipts.length} matching receipts`} />
        }
      >
        <div className="grid gap-4 xl:grid-cols-3">
          {filteredReceipts.map((receipt) => (
            <article key={receipt.id} className="rounded-3xl bg-[color:var(--surface-soft)] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Search className="h-5 w-5 text-[color:var(--accent)]" />
                  <div>
                    <p className="section-title text-lg font-bold">
                      {receipt.refNumber}
                    </p>
                    <p className="text-sm text-[color:var(--muted)]">
                      OR {receipt.orNumber}
                    </p>
                  </div>
                </div>
                <StatusPill
                  tone={receipt.status === "VOID" ? "danger" : "success"}
                  label={receipt.status}
                />
              </div>
              <div className="mt-4 grid gap-2 text-sm text-[color:var(--muted)]">
                <p>{receipt.cashierName}</p>
                <p>{formatCurrency(receipt.total)}</p>
                <p>{formatDateTime(receipt.createdAt)}</p>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </ReportShell>
  );
}

export function ReportsExpirationDatePage() {
  return (
    <ReportShell
      eyebrow="Reports"
      title="Expiration Date"
      description="Surface items nearing expiry so stock rotation and pull-out actions can happen before losses increase."
    >
      <SectionCard
        title="Expiry alerts"
        description="Expiry tracking belongs with reports because it drives operational action rather than cashier-facing selling."
        action={
          <ReportBadge value={`${expiryAlerts.length} near-expiry items`} />
        }
      >
        <div className="grid gap-4 xl:grid-cols-3">
          {expiryAlerts.map((alert) => (
            <article key={alert.item} className="rounded-3xl bg-[color:var(--surface-soft)] p-5">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-[color:var(--accent)]" />
                <div>
                  <p className="section-title text-lg font-bold">
                    {alert.item}
                  </p>
                  <p className="text-sm text-[color:var(--muted)]">
                    {alert.warehouse}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-[color:var(--muted)]">
                <p>Expires on: {alert.expiresOn}</p>
                <p>{alert.daysLeft} day(s) left</p>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </ReportShell>
  );
}

export function ReportsDiscountPage() {
  return (
    <ReportShell
      eyebrow="Reports"
      title="Discount"
      description="Track discount usage by type, cashier, and transaction reference to support review and compliance."
    >
      <SectionCard
        title="Discount usage"
        description="Discount audit visibility matters for cashier control and for BIR-sensitive discount handling."
        action={
          <ReportBadge value={`${discountUsage.length} recorded discounts`} />
        }
      >
        <div className="grid gap-4 xl:grid-cols-3">
          {discountUsage.map((discount) => (
            <article
              key={discount.reference}
              className="rounded-3xl bg-[color:var(--surface-soft)] p-5"
            >
              <div className="flex items-center gap-3">
                <BadgePercent className="h-5 w-5 text-[color:var(--accent)]" />
                <div>
                  <p className="section-title text-lg font-bold">
                    {discount.type}
                  </p>
                  <p className="text-sm text-[color:var(--muted)]">
                    {discount.cashier}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-[color:var(--muted)]">
                <p>{discount.reference}</p>
                <p>Amount: {formatCurrency(discount.amount)}</p>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </ReportShell>
  );
}

export function ReportsPullOutPage() {
  return (
    <ReportShell
      eyebrow="Reports"
      title="Pull Out"
      description="Review inventory removed from saleable stock and the approval chain behind each pull-out event."
    >
      <SectionCard
        title="Pull-out log"
        description="Pull-out actions remain explicit because they affect stock integrity, shrinkage review, and supervisor accountability."
        action={
          <ReportBadge value={`${pullOutRecords.length} pull-out entries`} />
        }
      >
        <div className="grid gap-4 xl:grid-cols-3">
          {pullOutRecords.map((record) => (
            <article
              key={`${record.item}-${record.reason}`}
              className="rounded-3xl bg-[color:var(--surface-soft)] p-5"
            >
              <div className="flex items-center gap-3">
                <ArrowRightLeft className="h-5 w-5 text-[color:var(--accent)]" />
                <div>
                  <p className="section-title text-lg font-bold">
                    {record.item}
                  </p>
                  <p className="text-sm text-[color:var(--muted)]">
                    {record.quantity} units
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-[color:var(--muted)]">
                <p>Approved by: {record.approvedBy}</p>
                <p>{record.reason}</p>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </ReportShell>
  );
}

export function ReportsBirTaxesPage() {
  const [searchValue, setSearchValue] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  const deferredSearch = useDeferredValue(searchValue.trim().toLowerCase());

  const filteredRows = useMemo(() => {
    if (!deferredSearch) {
      return birTaxRows;
    }

    return birTaxRows.filter((row) =>
      [String(row.transactionNumber), row.date, row.time].some((value) =>
        value.toLowerCase().includes(deferredSearch),
      ),
    );
  }, [deferredSearch]);

  const totals = useMemo(() => sumBirTaxRows(filteredRows), [filteredRows]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const paginatedRows = filteredRows.slice(
    safePageIndex * pageSize,
    safePageIndex * pageSize + pageSize,
  );

  function handleSearchChange(value: string) {
    setSearchValue(value);
    setPageIndex(0);
  }

  function handlePageSizeChange(value: number) {
    setPageSize(value);
    setPageIndex(0);
  }

  const stats = [
    { label: "Gross Total", value: totals.grossTotal, icon: CircleDollarSign },
    { label: "Refund Total", value: totals.refundTotal, icon: RotateCcw },
    {
      label: "Item Discount Total",
      value: totals.itemDiscountTotal,
      icon: BadgePercent,
    },
    { label: "Vatable Sales", value: totals.vatableSales, icon: Landmark },
    {
      label: "VAT Exempt Sales",
      value: totals.vatExemptSales,
      icon: ShieldCheck,
    },
    { label: "SC/PWD Discount", value: totals.scPwdDiscount, icon: UsersRound },
  ];

  return (
    <ReportShell
      eyebrow="Reports"
      title="BIR Taxes"
      description="Keep VAT buckets visible by reporting period so Z-readings and monthly submissions stay reconcilable."
    >
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-6">
        {/*
        description="These totals align with the architecture’s required VAT buckets for reporting and filing."
        */}
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <article
              key={stat.label}
              className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-slate-900">
                  {stat.label}
                </p>
                <Icon className="h-4 w-4 text-[color:var(--muted)]" />
              </div>
              <p className="mt-6 text-[2rem] font-bold tracking-tight text-slate-950">
                {formatCurrency(stat.value)}
              </p>
            </article>
          );
        })}
      </div>

      <SectionCard
        title="Transaction Details"
        description="Complete breakdown of all taxable transactions for the reporting period"
        action={
          <ReportBadge
            value={`${paginatedRows.length} of ${filteredRows.length}`}
          />
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-[color:var(--muted)]" />
            <input
              type="text"
              placeholder="Search by transaction number, date..."
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="flex-1 rounded-full bg-[color:var(--surface-soft)] px-4 py-2 text-sm outline-none placeholder:text-[color:var(--muted)]"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[color:var(--border)] text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                  <th className="px-4 py-3">Transaction</th>
                  <th className="px-4 py-3">Date/Time</th>
                  <th className="px-4 py-3 text-right">Gross Total</th>
                  <th className="px-4 py-3 text-right">Vatable Sales</th>
                  <th className="px-4 py-3 text-right">VAT Exempt</th>
                  <th className="px-4 py-3 text-right">VAT Amount</th>
                  <th className="px-4 py-3 text-right">SC/PWD Discount</th>
                  <th className="px-4 py-3 text-right">Refund Total</th>
                  <th className="px-4 py-3 text-right">Item Discount</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-sm text-[color:var(--muted)]"
                    >
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-[color:var(--border)] transition-colors hover:bg-[color:var(--surface-soft)]"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {row.transactionNumber}
                      </td>
                      <td className="px-4 py-3 text-sm text-[color:var(--muted)]">
                        {row.date} {row.time}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-900 font-medium">
                        {formatCurrency(row.grossTotal)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-[color:var(--muted)]">
                        {formatCurrency(row.vatableSales)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-[color:var(--muted)]">
                        {formatCurrency(row.vatExemptSales)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-[color:var(--muted)]">
                        {formatCurrency(row.vatAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-[color:var(--muted)]">
                        {formatCurrency(row.scPwdDiscount)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-[color:var(--muted)]">
                        {formatCurrency(row.refundTotal)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-[color:var(--muted)]">
                        {formatCurrency(row.itemDiscountTotal)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[color:var(--border)] bg-[color:var(--surface-soft)]">
                  <td
                    colSpan={2}
                    className="px-4 py-3 text-sm font-bold text-slate-900"
                  >
                    Page Totals
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">
                    {formatCurrency(
                      paginatedRows.reduce(
                        (sum, row) => sum + row.grossTotal,
                        0,
                      ),
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">
                    {formatCurrency(
                      paginatedRows.reduce(
                        (sum, row) => sum + row.vatableSales,
                        0,
                      ),
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">
                    {formatCurrency(
                      paginatedRows.reduce(
                        (sum, row) => sum + row.vatExemptSales,
                        0,
                      ),
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">
                    {formatCurrency(
                      paginatedRows.reduce(
                        (sum, row) => sum + row.vatAmount,
                        0,
                      ),
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">
                    {formatCurrency(
                      paginatedRows.reduce(
                        (sum, row) => sum + row.scPwdDiscount,
                        0,
                      ),
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">
                    {formatCurrency(
                      paginatedRows.reduce(
                        (sum, row) => sum + row.refundTotal,
                        0,
                      ),
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">
                    {formatCurrency(
                      paginatedRows.reduce(
                        (sum, row) => sum + row.itemDiscountTotal,
                        0,
                      ),
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-[color:var(--muted)]">Rows per page</label>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="rounded-full bg-[color:var(--surface-soft)] px-3 py-2 text-sm outline-none"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPageIndex(0)}
                disabled={safePageIndex === 0}
                className="p-2 rounded-lg border border-[color:var(--border)] text-[color:var(--muted)] disabled:opacity-50"
                title="First page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPageIndex(Math.max(0, safePageIndex - 1))}
                disabled={safePageIndex === 0}
                className="p-2 rounded-lg border border-[color:var(--border)] text-[color:var(--muted)] disabled:opacity-50"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-[color:var(--muted)]">
                Page {safePageIndex + 1} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setPageIndex(Math.min(totalPages - 1, safePageIndex + 1))
                }
                disabled={safePageIndex >= totalPages - 1}
                className="p-2 rounded-lg border border-[color:var(--border)] text-[color:var(--muted)] disabled:opacity-50"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPageIndex(totalPages - 1)}
                disabled={safePageIndex >= totalPages - 1}
                className="p-2 rounded-lg border border-[color:var(--border)] text-[color:var(--muted)] disabled:opacity-50"
                title="Last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </SectionCard>
    </ReportShell>
  );
}

export function ReportsBirTerminalReportPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch);
  const readings = useBirTerminalReadingStore((state) => state.readings);
  const ensureSeeded = useBirTerminalReadingStore(
    (state) => state.ensureSeeded,
  );

  const [searchValue, setSearchValue] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "X" | "Z">("ALL");
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  const deferredSearch = useDeferredValue(searchValue.trim().toLowerCase());

  useEffect(() => {
    ensureSeeded();
  }, [ensureSeeded]);

  const visibleReadings = useMemo(() => {
    let rows =
      selectedBranch === "all"
        ? readings
        : readings.filter((reading) => reading.branchId === selectedBranch);

    if (typeFilter !== "ALL") {
      rows = rows.filter((reading) => reading.readingType === typeFilter);
    }

    if (deferredSearch) {
      rows = rows.filter((reading) =>
        [
          reading.readingNumber,
          reading.terminalName,
          reading.serialNumber,
          reading.cashierName,
          String(reading.beginningOr),
          String(reading.endingOr),
        ].some((v) => v.toLowerCase().includes(deferredSearch)),
      );
    }

    return [...rows].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    );
  }, [readings, selectedBranch, typeFilter, deferredSearch]);

  const summaryStats = useMemo(() => {
    const xReadings = visibleReadings.filter((r) => r.readingType === "X");
    const zReadings = visibleReadings.filter((r) => r.readingType === "Z");
    const totalGross = visibleReadings.reduce((s, r) => s + r.grossSales, 0);
    const totalVat = visibleReadings.reduce((s, r) => s + r.vatAmount, 0);
    const totalVatable = visibleReadings.reduce(
      (s, r) => s + r.vatableSales,
      0,
    );
    const totalDiscount = visibleReadings.reduce(
      (s, r) => s + r.discountTotal,
      0,
    );
    return {
      xReadings,
      zReadings,
      totalGross,
      totalVat,
      totalVatable,
      totalDiscount,
    };
  }, [visibleReadings]);

  const totalPages = Math.max(1, Math.ceil(visibleReadings.length / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const paginatedRows = visibleReadings.slice(
    safePageIndex * pageSize,
    safePageIndex * pageSize + pageSize,
  );

  function handleSearchChange(value: string) {
    setSearchValue(value);
    setPageIndex(0);
  }

  function handleTypeFilterChange(nextType: "ALL" | "X" | "Z") {
    setTypeFilter(nextType);
    setPageIndex(0);
  }

  function handlePageSizeChange(value: number) {
    setPageSize(value);
    setPageIndex(0);
  }

  const stats = [
    {
      label: "Total Readings",
      value: String(visibleReadings.length),
      icon: ReceiptText,
    },
    {
      label: "X Readings",
      value: String(summaryStats.xReadings.length),
      icon: Clock3,
    },
    {
      label: "Z Readings",
      value: String(summaryStats.zReadings.length),
      icon: CheckCircle2,
    },
    {
      label: "Total Gross Sales",
      value: formatCurrency(summaryStats.totalGross),
      icon: CircleDollarSign,
    },
    {
      label: "Total VAT Amount",
      value: formatCurrency(summaryStats.totalVat),
      icon: Landmark,
    },
    {
      label: "Total Discounts",
      value: formatCurrency(summaryStats.totalDiscount),
      icon: BadgePercent,
    },
  ];

  return (
    <ReportShell
      eyebrow="Reports"
      title="BIR Terminal Report"
      description="Review X and Z reading output per registered terminal and verify the OR span each report covers."
    >
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article
              key={stat.label}
              className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-slate-900">
                  {stat.label}
                </p>
                <Icon className="h-4 w-4 text-[color:var(--muted)]" />
              </div>
              <p className="mt-6 text-[2rem] font-bold tracking-tight text-slate-950">
                {stat.value}
              </p>
            </article>
          );
        })}
      </div>

      {/* Terminal Readings Table */}
      <SectionCard
        title="Terminal Reading History"
        description="Each physical terminal needs its own reporting visibility because PTU registration is terminal-specific."
        action={<ReportBadge value={`${visibleReadings.length} readings`} />}
      >
        <div className="space-y-4">
          {/* Search + Type Filter */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-1 items-center gap-2">
              <Search className="h-4 w-4 text-[color:var(--muted)]" />
              <input
                type="text"
                placeholder="Search by reading #, terminal, serial, cashier..."
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="flex-1 rounded-full bg-[color:var(--surface-soft)] px-4 py-2 text-sm outline-none placeholder:text-[color:var(--muted)]"
              />
            </div>
            <div className="flex items-center gap-1 rounded-full bg-[color:var(--surface-soft)] p-1">
              {(["ALL", "X", "Z"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => handleTypeFilterChange(type)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    typeFilter === type
                      ? "bg-[color:var(--accent)] text-white"
                      : "text-[color:var(--muted)] hover:bg-[color:var(--header-tint)]"
                  }`}
                >
                  {type === "ALL" ? "All" : `${type}-Reading`}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[color:var(--border)] text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                  <th className="px-3 py-3">Reading #</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Terminal</th>
                  <th className="px-3 py-3">Serial #</th>
                  <th className="px-3 py-3">Cashier</th>
                  <th className="px-3 py-3">OR Range</th>
                  <th className="px-3 py-3 text-right">Gross Sales</th>
                  <th className="px-3 py-3 text-right">VATable Sales</th>
                  <th className="px-3 py-3 text-right">VAT Amount</th>
                  <th className="px-3 py-3 text-right">Discounts</th>
                  <th className="px-3 py-3">Generated</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-3 py-8 text-center text-sm text-[color:var(--muted)]"
                    >
                      No terminal readings found
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((report) => (
                    <tr
                      key={report.id}
                      className="border-b border-[color:var(--border)] transition-colors hover:bg-[color:var(--surface-soft)]"
                    >
                      <td className="whitespace-nowrap px-3 py-3 text-sm font-medium text-slate-900">
                        {report.readingNumber}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            report.readingType === "Z"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-sky-50 text-sky-700"
                          }`}
                        >
                          {report.readingType}-Reading
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-900">
                        {report.terminalName}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-[color:var(--muted)]">
                        {report.serialNumber}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-[color:var(--muted)]">
                        {report.cashierName}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-[color:var(--muted)]">
                        {report.beginningOr.toLocaleString()}–
                        {report.endingOr.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-sm font-medium text-slate-900">
                        {formatCurrency(report.grossSales)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-[color:var(--muted)]">
                        {formatCurrency(report.vatableSales)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-[color:var(--muted)]">
                        {formatCurrency(report.vatAmount)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-[color:var(--muted)]">
                        {formatCurrency(report.discountTotal)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-[color:var(--muted)]">
                        {formatDateTime(report.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {paginatedRows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-[color:var(--border)] bg-[color:var(--surface-soft)]">
                    <td
                      colSpan={6}
                      className="px-3 py-3 text-sm font-bold text-slate-900"
                    >
                      Page Totals
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-bold text-slate-900">
                      {formatCurrency(
                        paginatedRows.reduce((sum, r) => sum + r.grossSales, 0),
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-bold text-slate-900">
                      {formatCurrency(
                        paginatedRows.reduce(
                          (sum, r) => sum + r.vatableSales,
                          0,
                        ),
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-bold text-slate-900">
                      {formatCurrency(
                        paginatedRows.reduce((sum, r) => sum + r.vatAmount, 0),
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-bold text-slate-900">
                      {formatCurrency(
                        paginatedRows.reduce(
                          (sum, r) => sum + r.discountTotal,
                          0,
                        ),
                      )}
                    </td>
                    <td className="px-3 py-3" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-[color:var(--muted)]">Rows per page</label>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="rounded-full bg-[color:var(--surface-soft)] px-3 py-2 text-sm outline-none"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPageIndex(0)}
                disabled={safePageIndex === 0}
                className="rounded-lg border border-[color:var(--border)] p-2 text-[color:var(--muted)] disabled:opacity-50"
                title="First page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPageIndex(Math.max(0, safePageIndex - 1))}
                disabled={safePageIndex === 0}
                className="rounded-lg border border-[color:var(--border)] p-2 text-[color:var(--muted)] disabled:opacity-50"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-[color:var(--muted)]">
                Page {safePageIndex + 1} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setPageIndex(Math.min(totalPages - 1, safePageIndex + 1))
                }
                disabled={safePageIndex >= totalPages - 1}
                className="rounded-lg border border-[color:var(--border)] p-2 text-[color:var(--muted)] disabled:opacity-50"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPageIndex(totalPages - 1)}
                disabled={safePageIndex >= totalPages - 1}
                className="rounded-lg border border-[color:var(--border)] p-2 text-[color:var(--muted)] disabled:opacity-50"
                title="Last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </SectionCard>
    </ReportShell>
  );
}

export function ReportsBirEsalesPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch);
  const today = new Date();
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const years = [2024, 2025, 2026];

  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  const birSettingsQuery = useQuery({
    queryKey: ["bir-settings", selectedBranch],
    queryFn: () => fetchBirSettings(selectedBranch),
    enabled: selectedBranch !== "all",
  });

  const filteredRows = useMemo(() => {
    const monthStr = String(selectedMonth + 1).padStart(2, "0");
    const prefix = `${selectedYear}-${monthStr}`;
    return esalesDailyData.filter((row) => row.date.startsWith(prefix));
  }, [selectedMonth, selectedYear]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => ({
        salesIssued: acc.salesIssued + row.salesIssued,
        vatAmount: acc.vatAmount + row.vatAmount,
        vatableSales: acc.vatableSales + row.vatableSales,
        vatExemptSales: acc.vatExemptSales + row.vatExemptSales,
        zeroRatedSales: acc.zeroRatedSales + row.zeroRatedSales,
        governmentDiscount: acc.governmentDiscount + row.governmentDiscount,
        regularDiscount: acc.regularDiscount + row.regularDiscount,
        returns: acc.returns + row.returns,
        voids: acc.voids + row.voids,
        totalDeductions: acc.totalDeductions + row.totalDeductions,
      }),
      {
        salesIssued: 0,
        vatAmount: 0,
        vatableSales: 0,
        vatExemptSales: 0,
        zeroRatedSales: 0,
        governmentDiscount: 0,
        regularDiscount: 0,
        returns: 0,
        voids: 0,
        totalDeductions: 0,
      },
    );
  }, [filteredRows]);

  const lastSi =
    filteredRows.length > 0
      ? filteredRows[filteredRows.length - 1].endingSi
      : "—";

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const paginatedRows = filteredRows.slice(
    safePageIndex * pageSize,
    safePageIndex * pageSize + pageSize,
  );

  function handleMonthChange(value: number) {
    setSelectedMonth(value);
    setPageIndex(0);
  }

  function handleYearChange(value: number) {
    setSelectedYear(value);
    setPageIndex(0);
  }

  function handlePageSizeChange(value: number) {
    setPageSize(value);
    setPageIndex(0);
  }

  const exportCsv = useCallback(() => {
    const headers = [
      "Date",
      "Beginning SI",
      "Ending SI",
      "Grand Accum. Sales Ending",
      "Grand Accum. Sales Beginning",
      "Sales Issued",
      "VAT Amount",
      "VATable Sales",
      "VAT Exempt Sales",
      "Zero-Rated Sales",
      "Government Discount",
      "Regular Discount",
      "Returns",
      "Voids",
      "Total Deductions",
    ];

    const csvRows = [
      ...buildBirMetadataRows({
        reportTitle: "BIR E-Sales Report",
        branchId: selectedBranch,
        birSettings: birSettingsQuery.data,
        coveredPeriod: `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`,
      }),
      headers.join(","),
      ...filteredRows.map((row) =>
        [
          row.date,
          row.beginningSi,
          row.endingSi,
          row.grandAccumSalesEnding.toFixed(2),
          row.grandAccumSalesBeginning.toFixed(2),
          row.salesIssued.toFixed(2),
          row.vatAmount.toFixed(2),
          row.vatableSales.toFixed(2),
          row.vatExemptSales.toFixed(2),
          row.zeroRatedSales.toFixed(2),
          row.governmentDiscount.toFixed(2),
          row.regularDiscount.toFixed(2),
          row.returns.toFixed(2),
          row.voids.toFixed(2),
          row.totalDeductions.toFixed(2),
        ].join(","),
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bir-esales-${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [
    birSettingsQuery.data,
    filteredRows,
    selectedBranch,
    selectedMonth,
    selectedYear,
  ]);

  return (
    <ReportShell
      eyebrow="Reports"
      title="BIR E-Sales Report"
      description="Comprehensive sales reporting for BIR compliance."
    >
      {/* Covered Period + Export */}
      <SectionCard
        title="Covered Period"
        description="Select the reporting month and year."
      >
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(Number(e.target.value))}
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--accent)]/30"
            >
              {months.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--accent)]/30"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={exportCsv}
            className="ml-auto flex items-center gap-2 rounded-xl bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </SectionCard>

      {/* Company Details */}
      <SectionCard
        title="Company Details"
        description="Business registration information for BIR filing."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-[color:var(--surface-soft)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
              Registered TIN
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {birSettingsQuery.data?.vatTin?.trim() || "Not configured"}
            </p>
          </div>
          <div className="rounded-2xl bg-[color:var(--surface-soft)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
              MIN
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {birSettingsQuery.data?.machineIdentificationNumber?.trim() ||
                "Not configured"}
            </p>
          </div>
          <div className="rounded-2xl bg-[color:var(--surface-soft)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
              Registered Name
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {birSettingsQuery.data?.storeName?.trim() || "Not configured"}
            </p>
          </div>
          <div className="rounded-2xl bg-[color:var(--surface-soft)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
              Serial Number
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {birSettingsQuery.data?.serialNumber?.trim() || "Not configured"}
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-slate-900">
              Last Sales Invoice
            </p>
            <ReceiptText className="h-4 w-4 text-[color:var(--muted)]" />
          </div>
          <p className="mt-6 text-[2rem] font-bold tracking-tight text-slate-950">
            {lastSi}
          </p>
        </article>
        <article className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-slate-900">
              VAT Exempt Sales
            </p>
            <ShieldCheck className="h-4 w-4 text-[color:var(--muted)]" />
          </div>
          <p className="mt-6 text-[2rem] font-bold tracking-tight text-slate-950">
            {formatCurrency(totals.vatExemptSales)}
          </p>
        </article>
        <article className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-slate-900">VATable Sales</p>
            <Landmark className="h-4 w-4 text-[color:var(--muted)]" />
          </div>
          <p className="mt-6 text-[2rem] font-bold tracking-tight text-slate-950">
            {formatCurrency(totals.vatableSales)}
          </p>
        </article>
      </div>

      {/* Daily eSales Breakdown Table */}
      <SectionCard
        title="Daily eSales Breakdown"
        description="Daily transaction summary with BIR-required fields for eSales filing."
        action={<ReportBadge value={`${filteredRows.length} days`} />}
      >
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[color:var(--border)] text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Beginning SI</th>
                  <th className="px-3 py-3">Ending SI</th>
                  <th className="px-3 py-3 text-right">
                    Grand Accum. Sales Ending
                  </th>
                  <th className="px-3 py-3 text-right">
                    Grand Accum. Sales Beginning
                  </th>
                  <th className="px-3 py-3 text-right">Sales Issued</th>
                  <th className="px-3 py-3 text-right">VAT Amount</th>
                  <th className="px-3 py-3 text-right">VATable Sales</th>
                  <th className="px-3 py-3 text-right">VAT Exempt</th>
                  <th className="px-3 py-3 text-right">Zero-Rated</th>
                  <th className="px-3 py-3 text-right">Gov't Discount</th>
                  <th className="px-3 py-3 text-right">Regular Discount</th>
                  <th className="px-3 py-3 text-right">Returns</th>
                  <th className="px-3 py-3 text-right">Voids</th>
                  <th className="px-3 py-3 text-right">Total Deductions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={15}
                      className="px-3 py-8 text-center text-sm text-[color:var(--muted)]"
                    >
                      No data found for the selected period
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => (
                    <tr
                      key={row.date}
                      className="border-b border-[color:var(--border)] transition-colors hover:bg-[color:var(--surface-soft)]"
                    >
                      <td className="whitespace-nowrap px-3 py-3 text-sm font-medium text-slate-900">
                        {new Date(row.date + "T00:00:00").toLocaleDateString(
                          "en-PH",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-[color:var(--muted)]">
                        {row.beginningSi}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-[color:var(--muted)]">
                        {row.endingSi}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-[color:var(--muted)]">
                        {formatCurrency(row.grandAccumSalesEnding)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-[color:var(--muted)]">
                        {formatCurrency(row.grandAccumSalesBeginning)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-sm font-medium text-slate-900">
                        {formatCurrency(row.salesIssued)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-[color:var(--muted)]">
                        {formatCurrency(row.vatAmount)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-[color:var(--muted)]">
                        {formatCurrency(row.vatableSales)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-[color:var(--muted)]">
                        {formatCurrency(row.vatExemptSales)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-[color:var(--muted)]">
                        {formatCurrency(row.zeroRatedSales)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-[color:var(--muted)]">
                        {formatCurrency(row.governmentDiscount)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-[color:var(--muted)]">
                        {formatCurrency(row.regularDiscount)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-[color:var(--muted)]">
                        {formatCurrency(row.returns)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-[color:var(--muted)]">
                        {formatCurrency(row.voids)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-sm font-medium text-slate-900">
                        {formatCurrency(row.totalDeductions)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[color:var(--border)] bg-[color:var(--surface-soft)]">
                  <td
                    colSpan={5}
                    className="px-3 py-3 text-sm font-bold text-slate-900"
                  >
                    Totals
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-slate-900">
                    {formatCurrency(totals.salesIssued)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-slate-900">
                    {formatCurrency(totals.vatAmount)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-slate-900">
                    {formatCurrency(totals.vatableSales)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-slate-900">
                    {formatCurrency(totals.vatExemptSales)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-slate-900">
                    {formatCurrency(totals.zeroRatedSales)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-slate-900">
                    {formatCurrency(totals.governmentDiscount)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-slate-900">
                    {formatCurrency(totals.regularDiscount)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-slate-900">
                    {formatCurrency(totals.returns)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-slate-900">
                    {formatCurrency(totals.voids)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-slate-900">
                    {formatCurrency(totals.totalDeductions)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-[color:var(--muted)]">Rows per page</label>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="rounded-full bg-[color:var(--surface-soft)] px-3 py-2 text-sm outline-none"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPageIndex(0)}
                disabled={safePageIndex === 0}
                className="rounded-lg border border-[color:var(--border)] p-2 text-[color:var(--muted)] disabled:opacity-50"
                title="First page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPageIndex(Math.max(0, safePageIndex - 1))}
                disabled={safePageIndex === 0}
                className="rounded-lg border border-[color:var(--border)] p-2 text-[color:var(--muted)] disabled:opacity-50"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-[color:var(--muted)]">
                Page {safePageIndex + 1} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setPageIndex(Math.min(totalPages - 1, safePageIndex + 1))
                }
                disabled={safePageIndex >= totalPages - 1}
                className="rounded-lg border border-[color:var(--border)] p-2 text-[color:var(--muted)] disabled:opacity-50"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPageIndex(totalPages - 1)}
                disabled={safePageIndex >= totalPages - 1}
                className="rounded-lg border border-[color:var(--border)] p-2 text-[color:var(--muted)] disabled:opacity-50"
                title="Last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </SectionCard>
    </ReportShell>
  );
}


// ── Chart of Accounts constants ──────────────────────────────────────────
const GL_ACCOUNTS = {
  CASH: { code: "1010", name: "Cash on Hand" },
  SALES_REVENUE: { code: "4000", name: "Sales Revenue" },
  VAT_PAYABLE: { code: "2200", name: "Output VAT Payable" },
  DISCOUNT_EXPENSE: { code: "5500", name: "Sales Discount Expense" },
  SALES_RETURNS: { code: "4100", name: "Sales Returns and Allowances" },
} as const;

function triggerCsvDownload(content: string, filename: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadSalesJournalCsv(
  receipts: ReceiptRecord[],
  options: { branchId: string; birSettings?: BirSettingsResponse; coveredPeriod: string },
) {
  const lines = [
    ...buildBirMetadataRows({
      reportTitle: "Sales Journal",
      branchId: options.branchId,
      birSettings: options.birSettings,
      coveredPeriod: options.coveredPeriod,
    }),
    csvRow(["Date", "SI / OR No.", "Customer", "Customer TIN", "Vatable Sales", "VAT Exempt Sales", "Zero Rated Sales", "VAT Amount", "Discount", "Total", "Payment Method", "Status"]),
    ...receipts.map((r) =>
      csvRow([
        r.createdAt.slice(0, 10),
        r.refNumber,
        r.customerName ?? "Walk-in Customer",
        r.customerTin ?? "",
        (r.vatableSales ?? 0).toFixed(2),
        (r.vatExemptSales ?? 0).toFixed(2),
        (r.zeroRatedSales ?? 0).toFixed(2),
        (r.vatAmount ?? 0).toFixed(2),
        (r.discountAmount ?? 0).toFixed(2),
        r.total.toFixed(2),
        r.paymentMethod,
        r.status,
      ]),
    ),
  ];
  triggerCsvDownload(lines.join("\n"), `sales-journal-${options.coveredPeriod}.csv`);
}

function downloadGeneralLedgerCsv(
  receipts: ReceiptRecord[],
  options: { branchId: string; birSettings?: BirSettingsResponse; coveredPeriod: string },
) {
  type GlLine = { date: string; accountCode: string; accountName: string; debit: number; credit: number; reference: string; description: string };
  const entries: GlLine[] = [];
  for (const r of receipts) {
    const date = r.createdAt.slice(0, 10);
    const ref = r.refNumber;
    const total = r.total;
    const vat = r.vatAmount ?? 0;
    const discount = r.discountAmount ?? 0;
    if (r.status === "VOID" || r.status === "REFUNDED") {
      entries.push(
        { date, accountCode: GL_ACCOUNTS.SALES_RETURNS.code, accountName: GL_ACCOUNTS.SALES_RETURNS.name, debit: total, credit: 0, reference: ref, description: r.status + " - " + (r.voidReason ?? "") },
        { date, accountCode: GL_ACCOUNTS.CASH.code, accountName: GL_ACCOUNTS.CASH.name, debit: 0, credit: total, reference: ref, description: r.status + " reversal" },
      );
    } else {
      entries.push(
        { date, accountCode: GL_ACCOUNTS.CASH.code, accountName: GL_ACCOUNTS.CASH.name, debit: total, credit: 0, reference: ref, description: "Sale collection" },
        { date, accountCode: GL_ACCOUNTS.SALES_REVENUE.code, accountName: GL_ACCOUNTS.SALES_REVENUE.name, debit: 0, credit: total - vat, reference: ref, description: "Sales revenue" },
        { date, accountCode: GL_ACCOUNTS.VAT_PAYABLE.code, accountName: GL_ACCOUNTS.VAT_PAYABLE.name, debit: 0, credit: vat, reference: ref, description: "Output VAT" },
      );
      if (discount > 0) {
        entries.push(
          { date, accountCode: GL_ACCOUNTS.DISCOUNT_EXPENSE.code, accountName: GL_ACCOUNTS.DISCOUNT_EXPENSE.name, debit: discount, credit: 0, reference: ref, description: "Sales discount" },
          { date, accountCode: GL_ACCOUNTS.CASH.code, accountName: GL_ACCOUNTS.CASH.name, debit: 0, credit: discount, reference: ref, description: "Discount offset" },
        );
      }
    }
  }
  const lines = [
    ...buildBirMetadataRows({ reportTitle: "General Ledger", branchId: options.branchId, birSettings: options.birSettings, coveredPeriod: options.coveredPeriod }),
    csvRow(["Date", "Account Code", "Account Name", "Debit", "Credit", "Reference", "Description"]),
    ...entries.map((e) => csvRow([e.date, e.accountCode, e.accountName, e.debit.toFixed(2), e.credit.toFixed(2), e.reference, e.description])),
  ];
  triggerCsvDownload(lines.join("\n"), `general-ledger-${options.coveredPeriod}.csv`);
}

function downloadGeneralJournalCsv(
  receipts: ReceiptRecord[],
  options: { branchId: string; birSettings?: BirSettingsResponse; coveredPeriod: string },
) {
  const lines = [
    ...buildBirMetadataRows({ reportTitle: "General Journal", branchId: options.branchId, birSettings: options.birSettings, coveredPeriod: options.coveredPeriod }),
    csvRow(["Date", "Entry No.", "Account Code", "Account Name", "Debit", "Credit", "Description"]),
  ];
  let entryNo = 1;
  for (const r of receipts) {
    const date = r.createdAt.slice(0, 10);
    const total = r.total;
    const vat = r.vatAmount ?? 0;
    const discount = r.discountAmount ?? 0;
    const label = "JE-" + String(entryNo).padStart(5, "0");
    if (r.status === "VOID" || r.status === "REFUNDED") {
      lines.push(
        csvRow([date, label, GL_ACCOUNTS.SALES_RETURNS.code, GL_ACCOUNTS.SALES_RETURNS.name, total.toFixed(2), "", r.status + " " + r.refNumber]),
        csvRow([date, label, GL_ACCOUNTS.CASH.code, GL_ACCOUNTS.CASH.name, "", total.toFixed(2), r.status + " reversal"]),
      );
    } else {
      lines.push(
        csvRow([date, label, GL_ACCOUNTS.CASH.code, GL_ACCOUNTS.CASH.name, total.toFixed(2), "", "Sale " + r.refNumber]),
        csvRow([date, label, GL_ACCOUNTS.SALES_REVENUE.code, GL_ACCOUNTS.SALES_REVENUE.name, "", (total - vat).toFixed(2), "Sales revenue"]),
        csvRow([date, label, GL_ACCOUNTS.VAT_PAYABLE.code, GL_ACCOUNTS.VAT_PAYABLE.name, "", vat.toFixed(2), "Output VAT"]),
      );
      if (discount > 0) {
        lines.push(
          csvRow([date, label, GL_ACCOUNTS.DISCOUNT_EXPENSE.code, GL_ACCOUNTS.DISCOUNT_EXPENSE.name, discount.toFixed(2), "", "Sales discount"]),
          csvRow([date, label, GL_ACCOUNTS.CASH.code, GL_ACCOUNTS.CASH.name, "", discount.toFixed(2), "Discount offset"]),
        );
      }
    }
    entryNo++;
  }
  triggerCsvDownload(lines.join("\n"), `general-journal-${options.coveredPeriod}.csv`);
}

function downloadPurchaseJournalCsv(options: {
  branchId: string;
  birSettings?: BirSettingsResponse;
  coveredPeriod: string;
}) {
  const lines = [
    ...buildBirMetadataRows({ reportTitle: "Purchase Journal", branchId: options.branchId, birSettings: options.birSettings, coveredPeriod: options.coveredPeriod }),
    csvRow(["Note", "Purchase journal entries will be populated once the procurement module is integrated."]),
    "",
    csvRow(["Date", "Purchase Invoice No.", "Supplier Name", "Supplier TIN", "Purchases (Net)", "Input VAT", "Total Amount", "Reference"]),
  ];
  triggerCsvDownload(lines.join("\n"), `purchase-journal-${options.coveredPeriod}.csv`);
}

function downloadInventoryBookCsv(
  items: InventorySummary[],
  options: { branchId: string; birSettings?: BirSettingsResponse; coveredPeriod: string },
) {
  const lines = [
    ...buildBirMetadataRows({ reportTitle: "Inventory Book", branchId: options.branchId, birSettings: options.birSettings, coveredPeriod: options.coveredPeriod }),
    csvRow(["Item Name", "Warehouse", "Qty on Hand (Ending)", "Reorder Point", "Status"]),
    ...items.map((item) => csvRow([item.itemName, item.warehouseName, item.quantityOnHand, item.reorderPoint, item.status])),
  ];
  triggerCsvDownload(lines.join("\n"), `inventory-book-${options.coveredPeriod}.csv`);
}

export function ReportsBooksOfAccountsPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch);
  const receiptsQuery = useReceipts(selectedBranch);
  const inventoryQuery = useQuery({
    queryKey: ["inventory-books", selectedBranch],
    queryFn: () => fetchInventory(selectedBranch),
  });
  const birSettingsQuery = useQuery({
    queryKey: ["bir-settings", selectedBranch],
    queryFn: () => fetchBirSettings(selectedBranch),
    enabled: selectedBranch !== "all",
  });

  const now = new Date();
  const coveredPeriod = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  const receipts = receiptsQuery.data ?? [];
  const inventoryItems = inventoryQuery.data ?? [];
  const birSettings = birSettingsQuery.data;
  const exportOptions = { branchId: selectedBranch, birSettings, coveredPeriod };

  return (
    <ReportShell
      eyebrow="Reports"
      title="Books of Accounts"
      description="Export BIR-required Books of Accounts in CSV format per RR No. 9-2009 and RR No. 16-2006."
    >
      <SectionCard
        title="Export Books of Accounts"
        description="Each export includes BIR metadata headers (registered name, TIN, MIN, permit number)."
      >
        <div className="flex flex-wrap gap-3">
          <button
            className="flex items-center gap-2 rounded-lg bg-[color:var(--surface-soft)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] hover:bg-[color:var(--border)] disabled:opacity-50"
            disabled={receiptsQuery.isLoading}
            onClick={() => downloadSalesJournalCsv(receipts, exportOptions)}
          >
            <Download className="h-4 w-4" />
            Sales Journal
          </button>
          <button
            className="flex items-center gap-2 rounded-lg bg-[color:var(--surface-soft)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] hover:bg-[color:var(--border)] disabled:opacity-50"
            disabled={receiptsQuery.isLoading}
            onClick={() => downloadGeneralLedgerCsv(receipts, exportOptions)}
          >
            <Download className="h-4 w-4" />
            General Ledger
          </button>
          <button
            className="flex items-center gap-2 rounded-lg bg-[color:var(--surface-soft)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] hover:bg-[color:var(--border)] disabled:opacity-50"
            disabled={receiptsQuery.isLoading}
            onClick={() => downloadGeneralJournalCsv(receipts, exportOptions)}
          >
            <Download className="h-4 w-4" />
            General Journal
          </button>
          <button
            className="flex items-center gap-2 rounded-lg bg-[color:var(--surface-soft)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] hover:bg-[color:var(--border)] disabled:opacity-50"
            onClick={() => downloadPurchaseJournalCsv(exportOptions)}
          >
            <Download className="h-4 w-4" />
            Purchase Journal
          </button>
          <button
            className="flex items-center gap-2 rounded-lg bg-[color:var(--surface-soft)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] hover:bg-[color:var(--border)] disabled:opacity-50"
            disabled={inventoryQuery.isLoading}
            onClick={() => downloadInventoryBookCsv(inventoryItems, exportOptions)}
          >
            <Download className="h-4 w-4" />
            Inventory Book
          </button>
        </div>
        {receiptsQuery.isLoading && (
          <p className="mt-4 text-sm text-[color:var(--muted)]">Loading transaction data…</p>
        )}
      </SectionCard>
    </ReportShell>
  );
}
