import { Injectable } from '@nestjs/common';
import { assertBranchAllowed } from '../../common/auth/branch-scope';
import { dashboardOverview } from '../../data/mock-data';
import {
  EisSubmissionEventType,
  EisSubmissionService,
  EisSubmissionTransaction,
} from '../eis/eis-submission.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { AuditQueryDto } from './dto/audit-query.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { RefundTransactionDto } from './dto/refund-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { VoidTransactionDto } from './dto/void-transaction.dto';
import { PosLedgerService } from './pos-ledger.service';
import { PosTerminalSettingsService } from './pos-terminal-settings.service';

type LedgerSummary = Awaited<ReturnType<PosLedgerService['getSalesSummary']>>;

@Injectable()
export class PosService {
  constructor(
    private readonly posLedgerService: PosLedgerService,
    private readonly posTerminalSettingsService: PosTerminalSettingsService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly eisSubmissionService: EisSubmissionService,
  ) {}

  async getOverview(branchId?: string, allowedBranchIds?: string[]) {
    const summaryDate = this.asManilaDayKey(new Date().toISOString());
    const scopedBranches = allowedBranchIds
      ? dashboardOverview.branches.filter((branch) =>
          allowedBranchIds.includes(branch.id),
        )
      : dashboardOverview.branches;
    const targetBranchIds =
      branchId && branchId !== 'all'
        ? [branchId]
        : scopedBranches.map((branch) => branch.id);
    const summaryEntries = await Promise.all(
      targetBranchIds.map(async (id) => {
        const summary = await this.posLedgerService.getSalesSummary({
          branchId: id,
          date: summaryDate,
        });

        return [id, summary] as const;
      }),
    );
    const summaryByBranch = new Map<string, LedgerSummary>(summaryEntries);
    const branches =
      branchId && branchId !== 'all'
        ? scopedBranches
            .filter((branch) => branch.id === branchId)
            .map((branch) => {
              const summary = summaryByBranch.get(branch.id);
              return {
                ...branch,
                grossSalesToday: summary?.grossSales ?? 0,
              };
            })
        : scopedBranches.map((branch) => {
            const summary = summaryByBranch.get(branch.id);
            return {
              ...branch,
              grossSalesToday: summary?.grossSales ?? 0,
            };
          });
    const scopedBranchIds = new Set(scopedBranches.map((branch) => branch.id));
    const terminals =
      branchId && branchId !== 'all'
        ? dashboardOverview.terminals.filter(
            (terminal) => terminal.branchId === branchId,
          )
        : dashboardOverview.terminals.filter((terminal) =>
            scopedBranchIds.has(terminal.branchId),
          );
    const resolvedTerminals =
      await this.posTerminalSettingsService.applyConfiguredNames(terminals);
    const salesSummary =
      branchId && branchId !== 'all'
        ? summaryByBranch.get(branchId)
        : this.mergeSummaries(Array.from(summaryByBranch.values()));

    return {
      sales: salesSummary
        ? this.toOverviewSalesSnapshot(salesSummary)
        : dashboardOverview.sales,
      branches,
      terminals: resolvedTerminals,
    };
  }

  listTerminals(branchId?: string, allowedBranchIds?: string[]) {
    return this.posTerminalSettingsService.listTerminals(
      branchId,
      allowedBranchIds,
    );
  }

  updateTerminalName(
    terminalId: string,
    name: string,
    allowedBranchIds?: string[],
  ) {
    return this.posTerminalSettingsService.updateTerminalName(
      terminalId,
      name,
      allowedBranchIds,
    );
  }

  resetTerminalName(terminalId: string, allowedBranchIds?: string[]) {
    return this.posTerminalSettingsService.resetTerminalName(
      terminalId,
      allowedBranchIds,
    );
  }

  async createTransaction(
    payload: CreateTransactionDto,
    allowedBranchIds?: string[],
  ) {
    assertBranchAllowed(payload.branchId, allowedBranchIds);
    const result = await this.posLedgerService.createSale(payload);
    this.realtimeGateway.broadcastTransactionCreated(
      payload.branchId,
      result.id,
    );
    this.queueEisSubmission(result, 'SALE');
    return result;
  }

  listTransactions(filters: TransactionQueryDto, allowedBranchIds?: string[]) {
    if (filters.branchId) {
      assertBranchAllowed(filters.branchId, allowedBranchIds);
    }
    return this.posLedgerService.listTransactions(filters, allowedBranchIds);
  }

  async voidTransaction(
    transactionId: string,
    payload: VoidTransactionDto,
    allowedBranchIds?: string[],
  ) {
    assertBranchAllowed(payload.branchId, allowedBranchIds);
    const result = await this.posLedgerService.voidTransaction(
      transactionId,
      payload,
    );
    this.realtimeGateway.broadcastTransactionVoided(
      payload.branchId,
      transactionId,
    );
    this.queueEisSubmission(result.transaction, 'VOID', {
      reason: payload.reason,
      voidId: result.voidId,
      originalTxnId: transactionId,
    });
    return result;
  }

  async refundTransaction(
    transactionId: string,
    payload: RefundTransactionDto,
    allowedBranchIds?: string[],
  ) {
    assertBranchAllowed(payload.branchId, allowedBranchIds);
    const result = await this.posLedgerService.refundTransaction(
      transactionId,
      payload,
    );
    this.realtimeGateway.broadcastTransactionRefunded(
      payload.branchId,
      transactionId,
    );
    this.queueEisSubmission(result, 'REFUND', {
      reason: payload.reason,
      originalTxnId: transactionId,
    });
    return result;
  }

  listAuditTrail(filters: AuditQueryDto, allowedBranchIds?: string[]) {
    if (filters.branchId) {
      assertBranchAllowed(filters.branchId, allowedBranchIds);
    }
    return this.posLedgerService.listAuditTrail(filters, allowedBranchIds);
  }

  async getStorageStatus() {
    const status = await this.posLedgerService.getStorageStatus();
    return {
      mode: status.mode,
      lastUpdatedAt: status.lastUpdatedAt,
      healthy: true,
    };
  }

  private toOverviewSalesSnapshot(summary: LedgerSummary) {
    const averageBasket =
      summary.salesCount > 0 ? summary.grossSales / summary.salesCount : 0;

    return {
      grossSales: summary.grossSales,
      transactionCount: summary.salesCount,
      averageBasket: Number(averageBasket.toFixed(2)),
      includedTax: summary.includedTax,
      addedTax: 0,
      serviceFee: 0,
      diningOptionFee: 0,
      discountTotal: summary.discountTotal,
      refundTotal: summary.refundTotal,
      netSales: summary.netSales,
      payIn: 0,
      payOut: 0,
      itemCost: 0,
      grossProfit: summary.netSales,
      redeemedPoints: 0,
      voidTotal: summary.voidTotal,
      returnsTotal: summary.refundTotal,
      vatableSales: summary.vatableSales,
      vatAmount: summary.includedTax,
    };
  }

  private mergeSummaries(summaries: LedgerSummary[]): LedgerSummary {
    const merged = summaries.reduce(
      (totals, summary) => ({
        salesCount: totals.salesCount + summary.salesCount,
        refundCount: totals.refundCount + summary.refundCount,
        voidCount: totals.voidCount + summary.voidCount,
        grossSales: totals.grossSales + summary.grossSales,
        voidTotal: totals.voidTotal + summary.voidTotal,
        refundTotal: totals.refundTotal + summary.refundTotal,
        discountTotal: totals.discountTotal + summary.discountTotal,
        netSales: totals.netSales + summary.netSales,
        includedTax: totals.includedTax + summary.includedTax,
        vatableSales: totals.vatableSales + summary.vatableSales,
      }),
      {
        salesCount: 0,
        refundCount: 0,
        voidCount: 0,
        grossSales: 0,
        voidTotal: 0,
        refundTotal: 0,
        discountTotal: 0,
        netSales: 0,
        includedTax: 0,
        vatableSales: 0,
      },
    );

    return {
      branchId: 'all',
      terminalId: null,
      cashierId: null,
      fromDate: this.asManilaDayKey(new Date().toISOString()),
      toDate: this.asManilaDayKey(new Date().toISOString()),
      salesCount: merged.salesCount,
      refundCount: merged.refundCount,
      voidCount: merged.voidCount,
      grossSales: Number(merged.grossSales.toFixed(4)),
      voidTotal: Number(merged.voidTotal.toFixed(4)),
      refundTotal: Number(merged.refundTotal.toFixed(4)),
      discountTotal: Number(merged.discountTotal.toFixed(4)),
      netSales: Number(merged.netSales.toFixed(4)),
      includedTax: Number(merged.includedTax.toFixed(4)),
      vatableSales: Number(merged.vatableSales.toFixed(4)),
      vatExemptSales: 0,
      zeroRatedSales: 0,
      beginningOr: null,
      endingOr: null,
      payments: [],
      generatedAt: new Date().toISOString(),
    };
  }

  private asManilaDayKey(value: string) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(new Date(value));
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    return `${year}-${month}-${day}`;
  }

  private queueEisSubmission(
    transaction: EisSubmissionTransaction,
    eventType: EisSubmissionEventType,
    metadata?: Record<string, unknown>,
  ) {
    void this.eisSubmissionService
      .enqueueTransaction({
        transaction,
        eventType,
        metadata,
      })
      .catch(() => undefined);
  }
}
