import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  CreateTransactionDto,
  TransactionLineItemDto,
  TransactionPaymentDto,
} from './dto/create-transaction.dto';
import { AuditQueryDto } from './dto/audit-query.dto';
import { RefundTransactionDto } from './dto/refund-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { VoidTransactionDto } from './dto/void-transaction.dto';
import { isBranchAllowed } from '../../common/auth/branch-scope';

type PaymentMethodCode = TransactionPaymentDto['method'];

type LedgerTransactionKind = 'SALE' | 'REFUND';

type LedgerDerivedStatus = 'COMPLETED' | 'VOID' | 'REFUNDED' | 'RETURNED';
type ReceiptEventType = 'PRINT' | 'REPRINT' | 'EMAIL';

type SummaryFilters = {
  branchId: string;
  terminalId?: string;
  cashierId?: string;
  date?: string;
  fromDate?: string;
  toDate?: string;
};

type PaymentBucket = {
  method: PaymentMethodCode;
  total: number;
};

type LedgerLineItem = {
  id: string;
  itemId: string;
  name?: string;
  sku?: string;
  unit?: string;
  vatType?: 'VATABLE' | 'VAT_EXEMPT' | 'ZERO_RATED';
  variantId?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type LedgerPayment = {
  id: string;
  method: PaymentMethodCode;
  amount: number;
  reference?: string;
  changeAmount: number;
};

type LedgerTransaction = {
  id: string;
  refNumber: string;
  orNumber: number;
  branchId: string;
  terminalId: string;
  terminalName?: string;
  cashierId: string;
  cashierName?: string;
  shiftId?: string;
  customerName?: string;
  customerTin?: string;
  customerAddress?: string;
  customerBusinessStyle?: string;
  note?: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  vatableSales: number;
  vatExemptSales: number;
  zeroRatedSales: number;
  total: number;
  kind: LedgerTransactionKind;
  originalTxnId?: string;
  reason?: string;
  items: LedgerLineItem[];
  payments: LedgerPayment[];
  createdAt: string;
  recordHash: string;
};

type LedgerVoidEvent = {
  id: string;
  branchId: string;
  terminalId: string;
  cashierId: string;
  shiftId?: string;
  supervisorId?: string;
  originalTxnId: string;
  originalOrNumber: number;
  voidRef: string;
  reason: string;
  createdAt: string;
  recordHash: string;
};

type LedgerZReading = {
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

type LedgerEndOfDayReport = {
  id: string;
  branchId: string;
  terminalId?: string;
  cashierId?: string;
  date: string;
  summary: LedgerSalesSummary;
  generatedBy?: string;
  generatedAt: string;
  recordHash: string;
};

type LedgerAuditEntry = {
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
};

type LedgerStore = {
  version: 1;
  storageMode: 'append-only-file';
  counters: {
    orNumber: number;
    zNumber: number;
  };
  transactions: LedgerTransaction[];
  voids: LedgerVoidEvent[];
  zReadings: LedgerZReading[];
  endOfDayReports: LedgerEndOfDayReport[];
  auditTrail: LedgerAuditEntry[];
  lastUpdatedAt: string;
};

type LedgerSalesSummary = {
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

const paymentMethodOrder: PaymentMethodCode[] = [
  'CASH',
  'CARD',
  'GCASH',
  'MAYA',
  'SPLIT',
];

const OR_COUNTER_RESET_VALUE = -1;
const Z_COUNTER_RESET_VALUE = 1000;

@Injectable()
export class PosLedgerService {
  private readonly storageFilePath = this.resolveStorageFilePath();
  private writeQueue = Promise.resolve();

  getStorageStatus = async () => {
    const store = await this.readStore();
    const details = await stat(this.storageFilePath).catch(() => null);

    return {
      mode: store.storageMode,
      filePath: this.storageFilePath,
      fileSizeBytes: details?.size ?? 0,
      counts: {
        transactions: store.transactions.length,
        voids: store.voids.length,
        zReadings: store.zReadings.length,
        endOfDayReports: store.endOfDayReports.length,
        auditTrail: store.auditTrail.length,
      },
      lastUpdatedAt: store.lastUpdatedAt,
      lastAuditHash: store.auditTrail.at(-1)?.hash ?? null,
    };
  };

  resetTransactions() {
    throw new ForbiddenException(
      'Destructive transaction resets are disabled in compliance mode.',
    );
  }

  resetShiftManagement() {
    throw new ForbiddenException(
      'Destructive shift resets are disabled in compliance mode.',
    );
  }

  async createSale(payload: CreateTransactionDto) {
    return this.mutateStore((store) => {
      const transaction = this.buildSaleTransaction(store, payload);
      store.transactions.push(transaction);
      this.appendAuditEntry(store, {
        branchId: transaction.branchId,
        userId: transaction.cashierId,
        action: 'SALE_RECORDED',
        tableName: 'transactions',
        recordId: transaction.id,
        newVal: transaction,
      });

      return this.serializeTransaction(transaction, store);
    });
  }

  async recordReceiptEvent(payload: {
    branchId?: string;
    terminalId?: string;
    cashierId?: string;
    transactionId: string;
    orNumber?: number | null;
    refNumber?: string | null;
    eventType: ReceiptEventType;
    copyLabel?: string;
    occurredAt?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.mutateStore((store) => {
      const transaction = store.transactions.find(
        (entry) => entry.id === payload.transactionId,
      );

      const branchId = payload.branchId ?? transaction?.branchId;
      if (!branchId) {
        throw new BadRequestException(
          'branchId is required for receipt event logging.',
        );
      }

      const eventId = randomUUID();
      const event = {
        id: eventId,
        branchId,
        terminalId:
          payload.terminalId ?? transaction?.terminalId ?? 'unknown-terminal',
        cashierId:
          payload.cashierId ?? transaction?.cashierId ?? 'unknown-cashier',
        transactionId: payload.transactionId,
        orNumber: payload.orNumber ?? transaction?.orNumber ?? null,
        refNumber: payload.refNumber ?? transaction?.refNumber ?? null,
        eventType: payload.eventType,
        copyLabel: payload.copyLabel ?? null,
        occurredAt: payload.occurredAt ?? new Date().toISOString(),
        metadata: payload.metadata ?? {},
      };

      this.appendAuditEntry(store, {
        branchId,
        userId: event.cashierId,
        action: `RECEIPT_${payload.eventType}`,
        tableName: 'receipt_events',
        recordId: eventId,
        newVal: event,
      });

      return event;
    });
  }

  async createSaleFromSync(
    payload: CreateTransactionDto & {
      transactionId: string;
      createdAt?: string;
      refNumber?: string;
      cashierName?: string;
      terminalName?: string;
    },
  ) {
    return this.mutateStore((store) => {
      const existing = store.transactions.find(
        (transaction) => transaction.id === payload.transactionId,
      );

      if (existing) {
        return this.serializeTransaction(existing, store);
      }

      const transaction = this.buildSaleTransaction(store, payload, {
        transactionId: payload.transactionId,
        createdAt: payload.createdAt,
        refNumber: payload.refNumber,
        cashierName: payload.cashierName,
        terminalName: payload.terminalName,
      });

      store.transactions.push(transaction);
      this.appendAuditEntry(store, {
        branchId: transaction.branchId,
        userId: transaction.cashierId,
        action: 'SALE_SYNCED',
        tableName: 'transactions',
        recordId: transaction.id,
        newVal: transaction,
      });

      return this.serializeTransaction(transaction, store);
    });
  }

  async listTransactions(
    filters: TransactionQueryDto,
    allowedBranchIds?: string[],
  ) {
    const store = await this.readStore();
    const transactions = store.transactions
      .filter((transaction) =>
        this.matchesTransactionFilters(transaction, filters),
      )
      .filter((transaction) =>
        isBranchAllowed(transaction.branchId, allowedBranchIds),
      )
      .map((transaction) => this.serializeTransaction(transaction, store))
      .filter((transaction) =>
        filters.status ? transaction.status === filters.status : true,
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return {
      items: transactions,
      total: transactions.length,
    };
  }

  async voidTransaction(transactionId: string, payload: VoidTransactionDto) {
    return this.mutateStore((store) => {
      const original = this.findTransactionOrThrow(store, transactionId);
      this.assertVoidable(store, original, payload.branchId);

      const voidEvent: LedgerVoidEvent = {
        id: randomUUID(),
        branchId: payload.branchId,
        terminalId: payload.terminalId,
        cashierId: payload.cashierId,
        shiftId: payload.shiftId,
        supervisorId: payload.supervisorId,
        originalTxnId: original.id,
        originalOrNumber: original.orNumber,
        voidRef: this.buildReferenceNumber('VOID', payload.branchId),
        reason: payload.reason,
        createdAt: new Date().toISOString(),
        recordHash: this.hashRecord({
          action: 'VOID',
          originalTxnId: original.id,
          reason: payload.reason,
          cashierId: payload.cashierId,
        }),
      };

      store.voids.push(voidEvent);
      this.appendAuditEntry(store, {
        branchId: payload.branchId,
        userId: payload.supervisorId ?? payload.cashierId,
        action: 'TRANSACTION_VOIDED',
        tableName: 'transactions',
        recordId: original.id,
        oldVal: this.serializeTransaction(original, store, false),
        newVal: {
          voidEvent,
          status: 'VOID',
        },
      });

      return {
        voidId: voidEvent.id,
        transaction: this.serializeTransaction(original, store),
      };
    });
  }

  async refundTransaction(
    transactionId: string,
    payload: RefundTransactionDto,
  ) {
    return this.mutateStore((store) => {
      const original = this.findTransactionOrThrow(store, transactionId);
      this.assertRefundable(store, original, payload.branchId);

      const payments = this.buildRefundPayments(original, payload.payments);
      const refundTotal = this.roundMoney(Math.abs(original.total));
      const paymentTotal = this.roundMoney(
        payments.reduce((total, payment) => total + payment.amount, 0),
      );

      if (paymentTotal !== refundTotal) {
        throw new BadRequestException(
          'Refund payment total must match the original transaction total.',
        );
      }

      const refundTransaction: LedgerTransaction = {
        id: randomUUID(),
        refNumber: this.buildReferenceNumber('REFUND', payload.branchId),
        orNumber: ++store.counters.orNumber,
        branchId: payload.branchId,
        terminalId: payload.terminalId,
        terminalName: original.terminalName,
        cashierId: payload.cashierId,
        cashierName: original.cashierName ?? payload.cashierId,
        shiftId: payload.shiftId,
        customerName: original.customerName,
        customerTin: original.customerTin,
        customerAddress: original.customerAddress,
        customerBusinessStyle: original.customerBusinessStyle,
        note: payload.note,
        subtotal: this.roundMoney(-Math.abs(original.subtotal)),
        discountAmount: this.roundMoney(-Math.abs(original.discountAmount)),
        taxAmount: this.roundMoney(-Math.abs(original.taxAmount)),
        vatableSales: this.roundMoney(-Math.abs(original.vatableSales)),
        vatExemptSales: this.roundMoney(-Math.abs(original.vatExemptSales)),
        zeroRatedSales: this.roundMoney(-Math.abs(original.zeroRatedSales)),
        total: this.roundMoney(-refundTotal),
        kind: 'REFUND',
        originalTxnId: original.id,
        reason: payload.reason,
        items: original.items.map((item) => ({
          ...item,
          id: randomUUID(),
          quantity: this.roundMoney(-Math.abs(item.quantity)),
          lineTotal: this.roundMoney(-Math.abs(item.lineTotal)),
        })),
        payments,
        createdAt: new Date().toISOString(),
        recordHash: this.hashRecord({
          action: 'REFUND',
          originalTxnId: original.id,
          refundTotal,
          cashierId: payload.cashierId,
        }),
      };

      store.transactions.push(refundTransaction);
      this.appendAuditEntry(store, {
        branchId: payload.branchId,
        userId: payload.cashierId,
        action: 'REFUND_RECORDED',
        tableName: 'transactions',
        recordId: refundTransaction.id,
        newVal: refundTransaction,
      });

      return this.serializeTransaction(refundTransaction, store);
    });
  }

  async listAuditTrail(filters: AuditQueryDto, allowedBranchIds?: string[]) {
    const store = await this.readStore();
    const items = store.auditTrail
      .filter((entry) => {
        if (!isBranchAllowed(entry.branchId, allowedBranchIds)) {
          return false;
        }
        if (filters.branchId && entry.branchId !== filters.branchId) {
          return false;
        }
        if (filters.recordId && entry.recordId !== filters.recordId) {
          return false;
        }
        if (filters.tableName && entry.tableName !== filters.tableName) {
          return false;
        }
        if (filters.action && entry.action !== filters.action) {
          return false;
        }
        if (
          filters.fromDate &&
          this.asDayKey(entry.createdAt) < this.asDayKey(filters.fromDate)
        ) {
          return false;
        }
        if (
          filters.toDate &&
          this.asDayKey(entry.createdAt) > this.asDayKey(filters.toDate)
        ) {
          return false;
        }
        return true;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return {
      items,
      total: items.length,
    };
  }

  async getSalesSummary(filters: SummaryFilters) {
    const store = await this.readStore();
    return this.buildSalesSummary(store, filters);
  }

  async getXReading(filters: SummaryFilters) {
    const summary = await this.getSalesSummary(filters);

    return {
      type: 'X' as const,
      ...summary,
    };
  }

  async listZReadings(
    terminalId?: string,
    date?: string,
    allowedBranchIds?: string[],
  ) {
    const store = await this.readStore();
    return store.zReadings
      .filter((reading) => isBranchAllowed(reading.branchId, allowedBranchIds))
      .filter((reading) =>
        terminalId ? reading.terminalId === terminalId : true,
      )
      .filter((reading) => (date ? reading.date === this.asDayKey(date) : true))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async generateZReading(payload: {
    branchId: string;
    terminalId: string;
    date?: string;
    generatedBy?: string;
  }) {
    return this.mutateStore((store) => {
      const dayKey = this.asDayKey(payload.date ?? new Date().toISOString());
      const existing = store.zReadings.find(
        (reading) =>
          reading.branchId === payload.branchId &&
          reading.terminalId === payload.terminalId &&
          reading.date === dayKey,
      );

      if (existing) {
        throw new ConflictException(
          `Terminal ${payload.terminalId} already has a Z-reading for ${dayKey}.`,
        );
      }

      const summary = this.buildSalesSummary(store, {
        branchId: payload.branchId,
        terminalId: payload.terminalId,
        date: dayKey,
      });

      const reading: LedgerZReading = {
        id: randomUUID(),
        branchId: payload.branchId,
        terminalId: payload.terminalId,
        date: dayKey,
        zNumber: ++store.counters.zNumber,
        begOr: summary.beginningOr,
        endOr: summary.endingOr,
        grossSales: summary.grossSales,
        vatableSales: summary.vatableSales,
        vatAmount: summary.includedTax,
        vatExemptSales: summary.vatExemptSales,
        zeroRatedSales: summary.zeroRatedSales,
        discountTotal: summary.discountTotal,
        voidTotal: summary.voidTotal,
        refundTotal: summary.refundTotal,
        netSales: summary.netSales,
        transactionCount: summary.salesCount,
        submittedAt: null,
        createdAt: new Date().toISOString(),
        recordHash: this.hashRecord({
          action: 'Z_READING',
          terminalId: payload.terminalId,
          date: dayKey,
          zNumber: store.counters.zNumber,
          grossSales: summary.grossSales,
        }),
      };

      store.zReadings.push(reading);
      this.appendAuditEntry(store, {
        branchId: payload.branchId,
        userId: payload.generatedBy,
        action: 'Z_READING_GENERATED',
        tableName: 'bir_z_readings',
        recordId: reading.id,
        newVal: reading,
      });

      return reading;
    });
  }

  async getLatestZReadingSummary(filters: SummaryFilters) {
    const store = await this.readStore();
    const summary = this.buildSalesSummary(store, filters);
    const latestReading = store.zReadings
      .filter((reading) => reading.branchId === filters.branchId)
      .filter((reading) =>
        filters.terminalId ? reading.terminalId === filters.terminalId : true,
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

    return {
      latestReading,
      currentSummary: summary,
    };
  }

  async generateEndOfDayReport(payload: {
    branchId: string;
    terminalId?: string;
    cashierId?: string;
    date?: string;
    generatedBy?: string;
  }) {
    return this.mutateStore((store) => {
      const dayKey = this.asDayKey(payload.date ?? new Date().toISOString());
      const summary = this.buildSalesSummary(store, {
        branchId: payload.branchId,
        terminalId: payload.terminalId,
        cashierId: payload.cashierId,
        date: dayKey,
      });

      const report: LedgerEndOfDayReport = {
        id: randomUUID(),
        branchId: payload.branchId,
        terminalId: payload.terminalId,
        cashierId: payload.cashierId,
        date: dayKey,
        summary,
        generatedBy: payload.generatedBy,
        generatedAt: new Date().toISOString(),
        recordHash: this.hashRecord({
          action: 'END_OF_DAY',
          branchId: payload.branchId,
          terminalId: payload.terminalId,
          cashierId: payload.cashierId,
          date: dayKey,
          netSales: summary.netSales,
        }),
      };

      store.endOfDayReports.push(report);
      this.appendAuditEntry(store, {
        branchId: payload.branchId,
        userId: payload.generatedBy,
        action: 'END_OF_DAY_GENERATED',
        tableName: 'end_of_day_reports',
        recordId: report.id,
        newVal: report,
      });

      return report;
    });
  }

  async getEndOfDayReport(filters: SummaryFilters) {
    const store = await this.readStore();
    const dayKey = this.asDayKey(filters.date ?? new Date().toISOString());
    const existing = store.endOfDayReports
      .filter((report) => report.branchId === filters.branchId)
      .filter((report) =>
        filters.terminalId ? report.terminalId === filters.terminalId : true,
      )
      .filter((report) =>
        filters.cashierId ? report.cashierId === filters.cashierId : true,
      )
      .filter((report) => report.date === dayKey)
      .sort((left, right) =>
        right.generatedAt.localeCompare(left.generatedAt),
      )[0];

    return {
      savedReport: existing ?? null,
      currentSummary: this.buildSalesSummary(store, {
        ...filters,
        date: dayKey,
      }),
    };
  }

  private async mutateStore<T>(
    mutator: (store: LedgerStore) => Promise<T> | T,
  ): Promise<T> {
    let result!: T;

    const runMutation = async () => {
      const store = await this.readStore();
      result = await mutator(store);
      store.lastUpdatedAt = new Date().toISOString();
      await this.writeStore(store);
    };

    const next = this.writeQueue.then(runMutation, runMutation);
    this.writeQueue = next.then(
      () => undefined,
      () => undefined,
    );

    await next;

    return result;
  }

  private buildSaleTransaction(
    store: LedgerStore,
    payload: CreateTransactionDto,
    overrides?: {
      transactionId?: string;
      createdAt?: string;
      refNumber?: string;
      cashierName?: string;
      terminalName?: string;
    },
  ): LedgerTransaction {
    const items = payload.items.map((item) => this.mapLineItem(item));
    const subtotal = this.roundMoney(
      items.reduce((total, item) => total + item.lineTotal, 0),
    );
    const discountAmount = this.roundMoney(payload.discountAmount ?? 0);

    if (discountAmount > subtotal) {
      throw new BadRequestException(
        'Discount amount cannot exceed the transaction subtotal.',
      );
    }

    const taxProfile = this.buildTaxProfile(items, discountAmount);
    const total = this.roundMoney(subtotal - discountAmount);
    const taxAmount = taxProfile.taxAmount;
    const amountTendered = this.roundMoney(
      payload.payments.reduce(
        (totalPaid, payment) => totalPaid + payment.amount,
        0,
      ),
    );

    if (amountTendered < total) {
      throw new BadRequestException(
        'Payment total is less than the transaction total.',
      );
    }

    const changeAmount = this.roundMoney(amountTendered - total);
    const payments = payload.payments.map((payment, index) => ({
      id: randomUUID(),
      method: payment.method,
      amount: this.roundMoney(payment.amount),
      reference: payment.reference,
      changeAmount: index === 0 && payment.method === 'CASH' ? changeAmount : 0,
    }));

    return {
      id: overrides?.transactionId ?? randomUUID(),
      refNumber:
        overrides?.refNumber ??
        this.buildReferenceNumber('SALE', payload.branchId),
      orNumber: ++store.counters.orNumber,
      branchId: payload.branchId,
      terminalId: payload.terminalId,
      terminalName: overrides?.terminalName,
      cashierId: payload.cashierId,
      cashierName: overrides?.cashierName,
      shiftId: payload.shiftId,
      customerName: payload.customerName,
      customerTin: payload.customerTin,
      customerAddress: payload.customerAddress,
      customerBusinessStyle: payload.customerBusinessStyle,
      note: payload.note,
      subtotal,
      discountAmount,
      taxAmount,
      vatableSales: taxProfile.vatableSales,
      vatExemptSales: taxProfile.vatExemptSales,
      zeroRatedSales: taxProfile.zeroRatedSales,
      total,
      kind: 'SALE',
      items,
      payments,
      createdAt: overrides?.createdAt ?? new Date().toISOString(),
      recordHash: this.hashRecord({
        action: 'SALE',
        branchId: payload.branchId,
        terminalId: payload.terminalId,
        cashierId: payload.cashierId,
        subtotal,
        total,
      }),
    };
  }

  private buildRefundPayments(
    original: LedgerTransaction,
    overridePayments?: TransactionPaymentDto[],
  ): LedgerPayment[] {
    const sourcePayments =
      overridePayments && overridePayments.length > 0
        ? overridePayments
        : [
            {
              method: original.payments[0]?.method ?? 'CASH',
              amount: this.roundMoney(Math.abs(original.total)),
              reference: original.payments[0]?.reference,
            },
          ];

    return sourcePayments.map((payment) => ({
      id: randomUUID(),
      method: payment.method,
      amount: this.roundMoney(Math.abs(payment.amount)),
      reference: payment.reference,
      changeAmount: 0,
    }));
  }

  private buildSalesSummary(
    store: LedgerStore,
    filters: SummaryFilters,
  ): LedgerSalesSummary {
    const range = this.normalizeRange(filters);
    const matchingTransactions = store.transactions.filter((transaction) =>
      this.matchesSummaryFilters(transaction, filters, range),
    );

    const saleTransactions = matchingTransactions.filter(
      (transaction) => transaction.kind === 'SALE',
    );
    const refundTransactions = matchingTransactions.filter(
      (transaction) => transaction.kind === 'REFUND',
    );
    const voidedIds = new Set(
      store.voids
        .filter((voidEvent) => voidEvent.branchId === filters.branchId)
        .map((voidEvent) => voidEvent.originalTxnId),
    );
    const voidedSales = saleTransactions.filter((transaction) =>
      voidedIds.has(transaction.id),
    );
    const completedSales = saleTransactions.filter(
      (transaction) => !voidedIds.has(transaction.id),
    );
    const grossSales = this.roundMoney(
      completedSales.reduce(
        (total, transaction) => total + transaction.total,
        0,
      ),
    );
    const voidTotal = this.roundMoney(
      voidedSales.reduce((total, transaction) => total + transaction.total, 0),
    );
    const refundTotal = this.roundMoney(
      refundTransactions.reduce(
        (total, transaction) => total + Math.abs(transaction.total),
        0,
      ),
    );
    const discountTotal = this.roundMoney(
      completedSales.reduce(
        (total, transaction) => total + transaction.discountAmount,
        0,
      ),
    );
    const netSales = this.roundMoney(grossSales - refundTotal);
    const includedTax = this.roundMoney(
      completedSales.reduce(
        (total, transaction) => total + Math.abs(transaction.taxAmount),
        0,
      ),
    );
    const vatableSales = this.roundMoney(
      completedSales.reduce(
        (total, transaction) => total + Math.abs(transaction.vatableSales),
        0,
      ),
    );
    const vatExemptSales = this.roundMoney(
      completedSales.reduce(
        (total, transaction) => total + Math.abs(transaction.vatExemptSales),
        0,
      ),
    );
    const zeroRatedSales = this.roundMoney(
      completedSales.reduce(
        (total, transaction) => total + Math.abs(transaction.zeroRatedSales),
        0,
      ),
    );
    const allTransactionsForRange = matchingTransactions
      .map((transaction) => transaction.orNumber)
      .sort((left, right) => left - right);
    const paymentTotals = new Map<PaymentMethodCode, number>();

    for (const method of paymentMethodOrder) {
      paymentTotals.set(method, 0);
    }

    for (const transaction of completedSales) {
      for (const payment of transaction.payments) {
        paymentTotals.set(
          payment.method,
          this.roundMoney(
            (paymentTotals.get(payment.method) ?? 0) + payment.amount,
          ),
        );
      }
    }

    for (const transaction of refundTransactions) {
      for (const payment of transaction.payments) {
        paymentTotals.set(
          payment.method,
          this.roundMoney(
            (paymentTotals.get(payment.method) ?? 0) - Math.abs(payment.amount),
          ),
        );
      }
    }

    return {
      branchId: filters.branchId,
      terminalId: filters.terminalId ?? null,
      cashierId: filters.cashierId ?? null,
      fromDate: range.from,
      toDate: range.to,
      salesCount: completedSales.length,
      refundCount: refundTransactions.length,
      voidCount: voidedSales.length,
      grossSales,
      voidTotal,
      refundTotal,
      discountTotal,
      netSales,
      includedTax,
      vatableSales,
      vatExemptSales,
      zeroRatedSales,
      beginningOr: allTransactionsForRange[0] ?? null,
      endingOr: allTransactionsForRange.at(-1) ?? null,
      payments: paymentMethodOrder.map((method) => ({
        method,
        total: this.roundMoney(paymentTotals.get(method) ?? 0),
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  private serializeTransaction(
    transaction: LedgerTransaction,
    store: LedgerStore,
    includeAuditHash = true,
  ) {
    const voidEvent = store.voids.find(
      (v) => v.originalTxnId === transaction.id,
    );
    const isVoided = voidEvent !== undefined;
    const isRefunded =
      transaction.kind === 'SALE' &&
      store.transactions.some(
        (entry) =>
          entry.kind === 'REFUND' && entry.originalTxnId === transaction.id,
      );
    const status: LedgerDerivedStatus =
      transaction.kind === 'REFUND'
        ? 'RETURNED'
        : isVoided
          ? 'VOID'
          : isRefunded
            ? 'REFUNDED'
            : 'COMPLETED';
    const paymentMethod =
      transaction.payments.length > 1
        ? 'SPLIT'
        : (transaction.payments[0]?.method ?? 'CASH');
    const changeAmount = this.roundMoney(
      transaction.payments.reduce(
        (total, payment) => total + payment.changeAmount,
        0,
      ),
    );

    return {
      id: transaction.id,
      branchId: transaction.branchId,
      terminalId: transaction.terminalId,
      terminalName: transaction.terminalName ?? transaction.terminalId,
      cashierName: transaction.cashierName ?? transaction.cashierId,
      customerName: transaction.customerName ?? null,
      customerTin: transaction.customerTin ?? null,
      customerAddress: transaction.customerAddress ?? null,
      customerBusinessStyle: transaction.customerBusinessStyle ?? null,
      orNumber: transaction.orNumber,
      refNumber: transaction.refNumber,
      total: this.roundMoney(Math.abs(transaction.total)),
      subtotal: this.roundMoney(Math.abs(transaction.subtotal)),
      vatAmount: this.roundMoney(Math.abs(transaction.taxAmount)),
      discountAmount: this.roundMoney(Math.abs(transaction.discountAmount)),
      vatableSales: this.roundMoney(Math.abs(transaction.vatableSales)),
      vatExemptSales: this.roundMoney(Math.abs(transaction.vatExemptSales)),
      zeroRatedSales: this.roundMoney(Math.abs(transaction.zeroRatedSales)),
      changeAmount: this.roundMoney(Math.abs(changeAmount)),
      paymentMethod,
      status,
      createdAt: transaction.createdAt,
      items: transaction.items.map((item) => ({
        name: item.name ?? item.itemId,
        sku: item.sku ?? undefined,
        qty: Math.abs(item.quantity),
        price: Math.abs(item.unitPrice),
        unit: item.unit ?? undefined,
        vatType: item.vatType ?? 'VATABLE',
      })),
      cashierId: transaction.cashierId,
      shiftId: transaction.shiftId ?? null,
      note: transaction.note ?? null,
      taxAmount: transaction.taxAmount,
      type: transaction.kind,
      originalTxnId: transaction.originalTxnId ?? null,
      reason: transaction.reason ?? null,
      payments: transaction.payments,
      recordHash: includeAuditHash ? transaction.recordHash : undefined,
      ...(isVoided && voidEvent
        ? {
            voidRef: voidEvent.voidRef,
            voidReason: voidEvent.reason,
            voidedBy: voidEvent.supervisorId ?? voidEvent.cashierId,
            voidedAt: voidEvent.createdAt,
          }
        : {}),
    };
  }

  private appendAuditEntry(
    store: LedgerStore,
    params: {
      branchId: string;
      userId?: string;
      action: string;
      tableName: string;
      recordId: string;
      oldVal?: unknown;
      newVal?: unknown;
    },
  ) {
    const createdAt = new Date().toISOString();
    const previousHash = store.auditTrail.at(-1)?.hash ?? null;
    const entry: LedgerAuditEntry = {
      id: randomUUID(),
      branchId: params.branchId,
      userId: params.userId,
      action: params.action,
      tableName: params.tableName,
      recordId: params.recordId,
      oldVal: params.oldVal,
      newVal: params.newVal,
      createdAt,
      previousHash,
      hash: this.hashRecord({
        previousHash,
        action: params.action,
        tableName: params.tableName,
        recordId: params.recordId,
        oldVal: params.oldVal,
        newVal: params.newVal,
        createdAt,
      }),
    };

    store.auditTrail.push(entry);
  }

  private findTransactionOrThrow(store: LedgerStore, transactionId: string) {
    const transaction = store.transactions.find(
      (entry) => entry.id === transactionId,
    );

    if (!transaction) {
      throw new NotFoundException(
        `Transaction ${transactionId} was not found in the sales ledger.`,
      );
    }

    return transaction;
  }

  private assertVoidable(
    store: LedgerStore,
    transaction: LedgerTransaction,
    branchId: string,
  ) {
    if (transaction.branchId !== branchId) {
      throw new BadRequestException(
        'The transaction branch does not match the void request branch.',
      );
    }
    if (transaction.kind !== 'SALE') {
      throw new BadRequestException('Only sale transactions can be voided.');
    }
    if (
      store.voids.some(
        (voidEvent) => voidEvent.originalTxnId === transaction.id,
      )
    ) {
      throw new ConflictException('This transaction is already voided.');
    }
    if (
      store.transactions.some(
        (entry) =>
          entry.kind === 'REFUND' && entry.originalTxnId === transaction.id,
      )
    ) {
      throw new ConflictException(
        'Refunded transactions cannot be voided anymore.',
      );
    }
    const dayKey = this.asDayKey(transaction.createdAt);
    if (
      store.zReadings.some(
        (reading) =>
          reading.branchId === transaction.branchId &&
          reading.terminalId === transaction.terminalId &&
          reading.date === dayKey &&
          reading.begOr !== null &&
          reading.endOr !== null &&
          transaction.orNumber >= reading.begOr &&
          transaction.orNumber <= reading.endOr,
      )
    ) {
      throw new ConflictException(
        `Transaction OR ${transaction.orNumber} is already locked by a Z-reading for ${dayKey}.`,
      );
    }
  }

  private assertRefundable(
    store: LedgerStore,
    transaction: LedgerTransaction,
    branchId: string,
  ) {
    if (transaction.branchId !== branchId) {
      throw new BadRequestException(
        'The transaction branch does not match the refund request branch.',
      );
    }
    if (transaction.kind !== 'SALE') {
      throw new BadRequestException('Only sale transactions can be refunded.');
    }
    if (
      store.voids.some(
        (voidEvent) => voidEvent.originalTxnId === transaction.id,
      )
    ) {
      throw new ConflictException('Voided transactions cannot be refunded.');
    }
    if (
      store.transactions.some(
        (entry) =>
          entry.kind === 'REFUND' && entry.originalTxnId === transaction.id,
      )
    ) {
      throw new ConflictException(
        'This transaction already has a recorded refund.',
      );
    }
  }

  private matchesTransactionFilters(
    transaction: LedgerTransaction,
    filters: TransactionQueryDto,
  ) {
    if (filters.branchId && transaction.branchId !== filters.branchId) {
      return false;
    }
    if (filters.terminalId && transaction.terminalId !== filters.terminalId) {
      return false;
    }
    if (filters.cashierId && transaction.cashierId !== filters.cashierId) {
      return false;
    }
    if (filters.shiftId && transaction.shiftId !== filters.shiftId) {
      return false;
    }
    if (
      filters.transactionType &&
      transaction.kind !== filters.transactionType
    ) {
      return false;
    }

    const transactionDay = this.asDayKey(transaction.createdAt);

    if (filters.date && transactionDay !== this.asDayKey(filters.date)) {
      return false;
    }
    if (filters.fromDate && transactionDay < this.asDayKey(filters.fromDate)) {
      return false;
    }
    if (filters.toDate && transactionDay > this.asDayKey(filters.toDate)) {
      return false;
    }

    return true;
  }

  private matchesSummaryFilters(
    transaction: LedgerTransaction,
    filters: SummaryFilters,
    range: { from: string; to: string },
  ) {
    if (transaction.branchId !== filters.branchId) {
      return false;
    }
    if (filters.terminalId && transaction.terminalId !== filters.terminalId) {
      return false;
    }
    if (filters.cashierId && transaction.cashierId !== filters.cashierId) {
      return false;
    }

    const transactionDay = this.asDayKey(transaction.createdAt);

    return transactionDay >= range.from && transactionDay <= range.to;
  }

  private normalizeRange(filters: SummaryFilters) {
    const baseDay = this.asDayKey(filters.date ?? new Date().toISOString());
    return {
      from: this.asDayKey(filters.fromDate ?? baseDay),
      to: this.asDayKey(filters.toDate ?? baseDay),
    };
  }

  private mapLineItem(item: TransactionLineItemDto): LedgerLineItem {
    return {
      id: randomUUID(),
      itemId: item.itemId,
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      vatType: this.normalizeVatType(item.vatType),
      variantId: item.variantId,
      quantity: this.roundMoney(item.quantity),
      unitPrice: this.roundMoney(item.unitPrice),
      lineTotal: this.roundMoney(item.quantity * item.unitPrice),
    };
  }

  private buildTaxProfile(
    items: LedgerLineItem[],
    discountAmount: number,
  ): {
    taxAmount: number;
    vatableSales: number;
    vatExemptSales: number;
    zeroRatedSales: number;
  } {
    if (items.length === 0) {
      return {
        taxAmount: 0,
        vatableSales: 0,
        vatExemptSales: 0,
        zeroRatedSales: 0,
      };
    }

    const subtotal = this.roundMoney(
      items.reduce((total, item) => total + item.lineTotal, 0),
    );
    if (subtotal <= 0) {
      return {
        taxAmount: 0,
        vatableSales: 0,
        vatExemptSales: 0,
        zeroRatedSales: 0,
      };
    }

    let remainingDiscount = this.roundMoney(discountAmount);
    let vatableGross = 0;
    let vatExemptSales = 0;
    let zeroRatedSales = 0;

    items.forEach((item, index) => {
      const isLastItem = index === items.length - 1;
      const allocatedDiscount = isLastItem
        ? remainingDiscount
        : this.roundMoney((discountAmount * item.lineTotal) / subtotal);
      const safeAllocatedDiscount = Math.min(
        remainingDiscount,
        allocatedDiscount,
      );
      const discountedLineTotal = this.roundMoney(
        Math.max(0, item.lineTotal - safeAllocatedDiscount),
      );
      remainingDiscount = this.roundMoney(
        Math.max(0, remainingDiscount - safeAllocatedDiscount),
      );

      switch (this.normalizeVatType(item.vatType)) {
        case 'VAT_EXEMPT':
          vatExemptSales = this.roundMoney(
            vatExemptSales + discountedLineTotal,
          );
          break;
        case 'ZERO_RATED':
          zeroRatedSales = this.roundMoney(
            zeroRatedSales + discountedLineTotal,
          );
          break;
        default:
          vatableGross = this.roundMoney(vatableGross + discountedLineTotal);
          break;
      }
    });

    const taxAmount = this.roundMoney((vatableGross * 12) / 112);
    const vatableSales = this.roundMoney(vatableGross - taxAmount);

    return {
      taxAmount,
      vatableSales,
      vatExemptSales,
      zeroRatedSales,
    };
  }

  private normalizeVatType(value?: string) {
    switch ((value ?? 'VATABLE').trim().toUpperCase()) {
      case 'VAT_EXEMPT':
        return 'VAT_EXEMPT' as const;
      case 'ZERO_RATED':
        return 'ZERO_RATED' as const;
      default:
        return 'VATABLE' as const;
    }
  }

  private buildReferenceNumber(type: string, branchId: string) {
    const branchCode = branchId
      .replace(/[^a-z0-9]/gi, '')
      .slice(0, 8)
      .toUpperCase();
    const timestamp = Date.now().toString().slice(-8);

    return `${type}-${branchCode || 'BRANCH'}-${timestamp}`;
  }

  private roundMoney(value: number) {
    return Number(value.toFixed(4));
  }

  private hashRecord(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private resolveStorageFilePath() {
    if (process.env.POS_LEDGER_FILE) {
      return process.env.POS_LEDGER_FILE;
    }

    const cwd = process.cwd();
    if (cwd.endsWith(join('apps', 'api-nestjs'))) {
      return join(cwd, 'storage', 'sales-ledger.json');
    }

    return join(cwd, 'apps', 'api-nestjs', 'storage', 'sales-ledger.json');
  }

  private async readStore(): Promise<LedgerStore> {
    await this.ensureStoreFile();
    const content = await readFile(this.storageFilePath, 'utf8');
    const parsed = JSON.parse(content) as Partial<LedgerStore>;

    return {
      version: 1,
      storageMode: 'append-only-file',
      counters: {
        orNumber: parsed.counters?.orNumber ?? OR_COUNTER_RESET_VALUE,
        zNumber: parsed.counters?.zNumber ?? Z_COUNTER_RESET_VALUE,
      },
      transactions: parsed.transactions ?? [],
      voids: parsed.voids ?? [],
      zReadings: parsed.zReadings ?? [],
      endOfDayReports: parsed.endOfDayReports ?? [],
      auditTrail: parsed.auditTrail ?? [],
      lastUpdatedAt: parsed.lastUpdatedAt ?? new Date().toISOString(),
    };
  }

  private async writeStore(store: LedgerStore) {
    await mkdir(dirname(this.storageFilePath), { recursive: true });
    const tempPath = `${this.storageFilePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    await rename(tempPath, this.storageFilePath);
  }

  private async ensureStoreFile() {
    try {
      await stat(this.storageFilePath);
    } catch {
      const emptyStore: LedgerStore = {
        version: 1,
        storageMode: 'append-only-file',
        counters: {
          orNumber: OR_COUNTER_RESET_VALUE,
          zNumber: Z_COUNTER_RESET_VALUE,
        },
        transactions: [],
        voids: [],
        zReadings: [],
        endOfDayReports: [],
        auditTrail: [],
        lastUpdatedAt: new Date().toISOString(),
      };
      await mkdir(dirname(this.storageFilePath), { recursive: true });
      await writeFile(
        this.storageFilePath,
        `${JSON.stringify(emptyStore, null, 2)}\n`,
        'utf8',
      );
    }
  }

  private asDayKey(value: string) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

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
}
