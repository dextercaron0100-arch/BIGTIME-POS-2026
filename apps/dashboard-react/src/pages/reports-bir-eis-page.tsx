import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  Download,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "../components/ui/page-header";
import { SectionCard } from "../components/ui/section-card";
import { StatusPill } from "../components/ui/status-pill";
import {
  type BirEisSubmissionRecord,
  type BirEisSubmissionStatus,
  fetchBirEisSubmissions,
  fetchBirEisSummary,
  flushBirEisQueue,
  retryBirEisSubmission,
} from "../lib/api-client";
import { formatDateTime } from "../lib/utils";
import { useUiStore } from "../store/ui-store";

const manilaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type Notice = {
  tone: "success" | "error" | "info";
  message: string;
};

function formatManilaDate(value: Date) {
  return manilaDateFormatter.format(value);
}

function ReportBadge({ value }: { value: string }) {
  return (
    <div className="rounded-full bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--muted)]">
      {value}
    </div>
  );
}

function statusTone(
  status: BirEisSubmissionStatus,
): "success" | "warning" | "danger" | "neutral" {
  if (status === "SUBMITTED") {
    return "success";
  }
  if (status === "PENDING") {
    return "warning";
  }
  return "danger";
}

export function ReportsBirEisPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch);
  const queryClient = useQueryClient();
  const defaultRange = useMemo(() => {
    const toDate = formatManilaDate(new Date());
    const [year, month] = toDate.split("-");
    return {
      fromDate: `${year}-${month}-01`,
      toDate,
    };
  }, []);

  const [fromDate, setFromDate] = useState(defaultRange.fromDate);
  const [toDate, setToDate] = useState(defaultRange.toDate);
  const [statusFilter, setStatusFilter] = useState<
    "all" | BirEisSubmissionStatus
  >("all");
  const [pageSize, setPageSize] = useState(25);
  const [pageIndex, setPageIndex] = useState(0);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const summaryQuery = useQuery({
    queryKey: ["bir-eis-summary", selectedBranch, fromDate, toDate],
    queryFn: () =>
      fetchBirEisSummary({
        branchId: selectedBranch,
        fromDate,
        toDate,
      }),
    refetchInterval: 15_000,
  });

  const submissionsQuery = useQuery({
    queryKey: [
      "bir-eis-submissions",
      selectedBranch,
      statusFilter,
      pageIndex,
      pageSize,
    ],
    queryFn: () =>
      fetchBirEisSubmissions({
        branchId: selectedBranch,
        status: statusFilter,
        page: pageIndex + 1,
        pageSize,
      }),
    refetchInterval: 10_000,
  });

  const totals = summaryQuery.data?.totals ?? {
    queued: 0,
    submitted: 0,
    pending: 0,
    failed: 0,
    retryDue: 0,
  };
  const submissions = useMemo(
    () => submissionsQuery.data?.items ?? [],
    [submissionsQuery.data?.items],
  );
  const totalRows = submissionsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const statusLabel =
    statusFilter === "all" ? "All statuses" : `${statusFilter} only`;
  const modeLabel = summaryQuery.data?.mode ?? "REMOTE_REQUIRED";
  const isRemoteMode = modeLabel === "REMOTE";
  const liveSubmissionReady = summaryQuery.data?.liveSubmissionReady ?? false;
  const readinessIssues = summaryQuery.data?.readinessIssues ?? [];
  const dailyRows = summaryQuery.data?.filedByDay ?? [];

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPageIndex(0);
  }, [selectedBranch, statusFilter, pageSize]);

  useEffect(() => {
    if (safePageIndex !== pageIndex) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPageIndex(safePageIndex);
    }
  }, [pageIndex, safePageIndex]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 3_500);

    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const refreshAll = useCallback(async () => {
    await Promise.all([summaryQuery.refetch(), submissionsQuery.refetch()]);
  }, [summaryQuery, submissionsQuery]);

  const flushMutation = useMutation({
    mutationFn: () =>
      flushBirEisQueue({
        branchId: selectedBranch,
        maxItems: 80,
      }),
    onSuccess: async (result) => {
      setNotice({
        tone: "success",
        message: `Queue flush completed: ${result.submitted} submitted, ${result.failed} failed, ${result.pending} pending.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["bir-eis-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["bir-eis-submissions"] }),
      ]);
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to flush EIS queue.",
      });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (record: BirEisSubmissionRecord) =>
      retryBirEisSubmission({ submissionId: record.id }),
    onMutate: (record) => {
      setRetryingId(record.id);
    },
    onSuccess: async (_, record) => {
      setNotice({
        tone: "success",
        message: `Retry queued for OR #${record.orNumber}.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["bir-eis-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["bir-eis-submissions"] }),
      ]);
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to retry submission.",
      });
    },
    onSettled: () => {
      setRetryingId(null);
    },
  });

  const exportCsv = useCallback(() => {
    const headers = [
      "Submission ID",
      "Created At",
      "Branch ID",
      "Terminal ID",
      "OR Number",
      "Event Type",
      "Status",
      "Retry Count",
      "Last Attempt",
      "Response Code",
      "Remote Reference",
      "Next Retry At",
      "Last Error",
      "Payload Hash",
    ];

    const rows = submissions.map((record) =>
      [
        record.id,
        record.createdAt,
        record.branchId,
        record.terminalId,
        String(record.orNumber),
        record.eventType,
        record.status,
        String(record.retryCount),
        record.lastAttemptAt ?? "",
        record.responseCode != null ? String(record.responseCode) : "",
        record.remoteReference ?? "",
        record.nextRetryAt ?? "",
        record.lastError ?? "",
        record.payloadHash,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bir-eis-monitor-${fromDate}-to-${toDate}-${statusFilter}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [fromDate, statusFilter, submissions, toDate]);

  const stats = [
    {
      label: "Queued",
      value: String(totals.queued),
      icon: ReceiptText,
      tone: "text-slate-900",
    },
    {
      label: "Submitted",
      value: String(totals.submitted),
      icon: CheckCircle2,
      tone: "text-emerald-700",
    },
    {
      label: "Pending",
      value: String(totals.pending),
      icon: Clock3,
      tone: "text-amber-700",
    },
    {
      label: "Failed",
      value: String(totals.failed),
      icon: AlertTriangle,
      tone: "text-rose-700",
    },
    {
      label: "Retry Due",
      value: String(totals.retryDue),
      icon: RotateCcw,
      tone: "text-indigo-700",
    },
    {
      label: "Endpoint Mode",
      value: modeLabel,
      icon: ShieldCheck,
      tone: isRemoteMode ? "text-emerald-700" : "text-slate-700",
    },
    {
      label: "Live Ready",
      value: liveSubmissionReady ? "YES" : "NO",
      icon: ShieldCheck,
      tone: liveSubmissionReady ? "text-emerald-700" : "text-rose-700",
    },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title="BIR EIS Filing Monitor"
        description="Track signed EIS submissions, watch retries, and recover the queue from one place."
      />

      {notice ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            notice.tone === "success"
              ? "bg-emerald-50 text-emerald-700"
              : notice.tone === "error"
                ? "bg-rose-50 text-rose-700"
                : "bg-[color:var(--header-tint)] text-slate-700"
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      <SectionCard
        title="Filing Controls"
        description="Set the filing window and queue status view, then run refresh/flush actions."
      >
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--accent)]/30"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--accent)]/30"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
              Queue Status
            </label>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as "all" | BirEisSubmissionStatus,
                )
              }
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--accent)]/30"
            >
              <option value="all">All</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="SUBMITTED">Submitted</option>
            </select>
          </div>

          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
            >
              <RotateCcw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => exportCsv()}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button
              type="button"
              onClick={() => flushMutation.mutate()}
              disabled={flushMutation.isPending}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[color:var(--accent)] px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {flushMutation.isPending ? (
                <RotateCcw className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRightLeft className="h-4 w-4" />
              )}
              Flush Queue
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--muted)]">
          Branch:{" "}
          <span className="font-semibold text-slate-900">{selectedBranch}</span>
          {" | "}
          Mode:{" "}
          <span className="font-semibold text-slate-900">{modeLabel}</span>
          {" | "}
          Endpoint:{" "}
          <span className="font-semibold text-slate-900">
            {summaryQuery.data?.endpointConfigured
              ? "Configured"
              : "Not configured"}
          </span>
          {" | "}
          Last Submitted:{" "}
          <span className="font-semibold text-slate-900">
            {summaryQuery.data?.lastSubmittedAt
              ? formatDateTime(summaryQuery.data.lastSubmittedAt)
              : "None yet"}
          </span>
        </div>
        {readinessIssues.length > 0 ? (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {readinessIssues.join(" ")}
          </div>
        ) : null}
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
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
                <Icon className={`h-4 w-4 ${stat.tone}`} />
              </div>
              <p
                className={`mt-6 text-[2rem] font-bold tracking-tight ${stat.tone}`}
              >
                {stat.value}
              </p>
            </article>
          );
        })}
      </div>

      <SectionCard
        title="Submission Queue"
        description="Queue view with status, retries, response codes, and acknowledgment references."
        action={<ReportBadge value={`${totalRows} records | ${statusLabel}`} />}
      >
        <div className="space-y-4">
          {submissionsQuery.isLoading ? (
            <div className="flex min-h-44 items-center justify-center rounded-2xl bg-[color:var(--surface-soft)] text-sm text-[color:var(--muted)]">
              <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
              Loading EIS queue...
            </div>
          ) : submissionsQuery.isError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Failed to load EIS queue records.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-[1280px] w-full">
                  <thead>
                    <tr className="border-b border-[color:var(--border)] text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                      <th className="px-3 py-3">Created</th>
                      <th className="px-3 py-3">Branch</th>
                      <th className="px-3 py-3">Terminal</th>
                      <th className="px-3 py-3">OR #</th>
                      <th className="px-3 py-3">Event</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3 text-right">Retries</th>
                      <th className="px-3 py-3">Response</th>
                      <th className="px-3 py-3">Reference</th>
                      <th className="px-3 py-3">Next Retry</th>
                      <th className="px-3 py-3">Error</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={12}
                          className="px-3 py-8 text-center text-sm text-[color:var(--muted)]"
                        >
                          No submissions found for the selected filter.
                        </td>
                      </tr>
                    ) : (
                      submissions.map((record) => (
                        <tr
                          key={record.id}
                          className="border-b border-[color:var(--border)] transition-colors hover:bg-[color:var(--surface-soft)]"
                        >
                          <td className="whitespace-nowrap px-3 py-3 text-sm text-[color:var(--muted)]">
                            {formatDateTime(record.createdAt)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-900">
                            {record.branchId}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-sm text-[color:var(--muted)]">
                            {record.terminalId}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-sm font-medium text-slate-900">
                            {record.orNumber.toLocaleString("en-PH")}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-sm text-[color:var(--muted)]">
                            {record.eventType}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <StatusPill
                              tone={statusTone(record.status)}
                              label={record.status}
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-[color:var(--muted)]">
                            {record.retryCount}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-sm text-[color:var(--muted)]">
                            {record.responseCode ?? "N/A"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-sm text-[color:var(--muted)]">
                            {record.remoteReference ?? "N/A"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-sm text-[color:var(--muted)]">
                            {record.nextRetryAt
                              ? formatDateTime(record.nextRetryAt)
                              : "N/A"}
                          </td>
                          <td
                            className="max-w-[280px] truncate px-3 py-3 text-sm text-rose-700"
                            title={record.lastError ?? ""}
                          >
                            {record.lastError ?? "N/A"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <button
                              type="button"
                              disabled={
                                record.status === "SUBMITTED" ||
                                retryMutation.isPending
                              }
                              onClick={() => retryMutation.mutate(record)}
                              className="rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {retryingId === record.id
                                ? "Retrying..."
                                : record.status === "SUBMITTED"
                                  ? "Acked"
                                  : "Retry"}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-[color:var(--muted)]">
                    Rows per page
                  </label>
                  <select
                    value={pageSize}
                    onChange={(event) =>
                      setPageSize(Number(event.target.value))
                    }
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
            </>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Daily Filing Breakdown"
        description="Daily submitted/pending/failed totals in the selected filing window."
        action={
          <ReportBadge
            value={`${summaryQuery.data?.fromDate ?? fromDate} to ${summaryQuery.data?.toDate ?? toDate}`}
          />
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[color:var(--border)] text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3 text-right">Submitted</th>
                <th className="px-3 py-3 text-right">Pending</th>
                <th className="px-3 py-3 text-right">Failed</th>
              </tr>
            </thead>
            <tbody>
              {dailyRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-8 text-center text-sm text-[color:var(--muted)]"
                  >
                    No filing activity in the selected date range.
                  </td>
                </tr>
              ) : (
                dailyRows.map((day) => (
                  <tr
                    key={day.date}
                    className="border-b border-[color:var(--border)] transition-colors hover:bg-[color:var(--surface-soft)]"
                  >
                    <td className="whitespace-nowrap px-3 py-3 text-sm font-medium text-slate-900">
                      {day.date}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-emerald-700">
                      {day.submitted}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-amber-700">
                      {day.pending}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-rose-700">
                      {day.failed}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
