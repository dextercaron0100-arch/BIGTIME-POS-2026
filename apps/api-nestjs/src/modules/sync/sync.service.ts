import type {
  PaymentMethod,
  SyncBatchResponse,
  SyncTransactionReceiptAck,
} from '@apex-pos/shared-types';
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { EisSubmissionService } from '../eis/eis-submission.service';
import { CatalogService } from '../catalog/catalog.service';
import { PosLedgerService } from '../pos/pos-ledger.service';
import { CreateSyncBatchDto } from './dto/create-sync-batch.dto';
import { assertBranchAllowed } from '../../common/auth/branch-scope';

const appendOnlyTables = new Set([
  'transactions',
  'payments',
  'stock_movements',
  'receipt_events',
  'cash_movements',
]);

type SyncEntry = CreateSyncBatchDto['entries'][number];

type SyncTransactionItem = {
  itemId?: string;
  item_id?: string;
  name?: string;
  sku?: string;
  unit?: string;
  vatType?: string;
  vat_type?: string;
  qty?: number;
  quantity?: number;
  unitPrice?: number;
  unit_price?: number;
  unitPriceMinor?: number;
  unit_price_minor?: number;
  variantId?: string;
  variant_id?: string;
};

type SyncTransactionPayment = {
  method?: string;
  paymentMethod?: string;
  payment_method?: string;
  amount?: number;
  amountMinor?: number;
  amount_minor?: number;
  reference?: string;
};

type SyncTransactionPayload = {
  branchId?: string;
  branch_id?: string;
  terminalId?: string;
  terminal_id?: string;
  terminalName?: string;
  terminal_name?: string;
  cashierId?: string;
  cashier_id?: string;
  cashierName?: string;
  cashier_name?: string;
  shiftId?: string;
  shift_id?: string;
  customerName?: string;
  customer_name?: string;
  customerTin?: string;
  customer_tin?: string;
  customerAddress?: string;
  customer_address?: string;
  customerBusinessStyle?: string;
  customer_business_style?: string;
  note?: string;
  referenceNumber?: string;
  reference_number?: string;
  discountAmount?: number;
  discount_amount?: number;
  discountAmountMinor?: number;
  discount_amount_minor?: number;
  paymentMethod?: string;
  payment_method?: string;
  paymentReference?: string;
  payment_reference?: string;
  total?: number;
  totalMinor?: number;
  total_minor?: number;
  items?: SyncTransactionItem[];
  payments?: SyncTransactionPayment[];
};

type SyncReceiptEventPayload = {
  branchId?: string;
  branch_id?: string;
  terminalId?: string;
  terminal_id?: string;
  cashierId?: string;
  cashier_id?: string;
  transactionId?: string;
  transaction_id?: string;
  orNumber?: number;
  or_number?: number;
  referenceNumber?: string;
  reference_number?: string;
  eventType?: string;
  event_type?: string;
  copyLabel?: string;
  copy_label?: string;
  reason?: string;
  occurredAt?: string;
  occurred_at?: string;
};

@Injectable()
export class SyncService {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly posLedgerService: PosLedgerService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly eisSubmissionService: EisSubmissionService,
  ) {}

  async processBatch(
    payload: CreateSyncBatchDto,
    allowedBranchIds?: string[],
  ): Promise<SyncBatchResponse> {
    const batchBranchId = assertBranchAllowed(
      payload.branchId,
      allowedBranchIds,
    );
    const acceptedIds: string[] = [];
    const rejectedIds: Array<{ id: string; reason: string }> = [];
    const transactionReceipts: SyncTransactionReceiptAck[] = [];

    for (const entry of payload.entries) {
      if (
        appendOnlyTables.has(entry.tableName) &&
        entry.operation !== 'INSERT'
      ) {
        rejectedIds.push({
          id: entry.id,
          reason: `Append-only table ${entry.tableName} only accepts INSERT operations.`,
        });
        continue;
      }

      try {
        const transactionReceipt = await this.applyEntry(
          { ...payload, branchId: batchBranchId },
          entry,
        );
        if (transactionReceipt) {
          transactionReceipts.push(transactionReceipt);
        }
        acceptedIds.push(`${entry.id}:${this.buildIdempotencyKey(entry)}`);
      } catch (error) {
        rejectedIds.push({
          id: entry.id,
          reason: this.toReason(error),
        });
      }
    }

    if (acceptedIds.length > 0) {
      this.realtimeGateway.broadcastSyncBatchProcessed(
        payload.branchId,
        payload.terminalId,
        acceptedIds.length,
      );
    }

    return {
      acceptedIds,
      rejectedIds,
      nextCursor: new Date().toISOString(),
      catalogItems: await this.catalogService.getItems(payload.branchId),
      transactionReceipts,
    };
  }

  private async applyEntry(
    batch: CreateSyncBatchDto,
    entry: SyncEntry,
  ): Promise<SyncTransactionReceiptAck | null> {
    switch (entry.tableName) {
      case 'transactions':
        return this.applyTransactionEntry(batch, entry);
      case 'receipt_events':
        await this.applyReceiptEventEntry(batch, entry);
        return null;
      case 'shift_sessions':
        this.realtimeGateway.broadcastShiftOpened(
          batch.branchId,
          batch.terminalId,
        );
        return null;
      case 'cash_movements':
        return null;
      case 'stock_movements':
        this.realtimeGateway.broadcastInventoryUpdated(batch.branchId);
        return null;
      default:
        return null;
    }
  }

  private async applyTransactionEntry(
    batch: CreateSyncBatchDto,
    entry: SyncEntry,
  ): Promise<SyncTransactionReceiptAck> {
    const payload = entry.payload as SyncTransactionPayload;
    const items = (payload.items ?? []).map((item) => ({
      itemId: this.pickString(item.itemId, item.item_id) ?? 'unknown-item',
      name: item.name,
      sku: this.pickString(item.sku),
      unit: this.pickString(item.unit),
      vatType: this.normalizeVatType(
        this.pickString(item.vatType, item.vat_type),
      ),
      variantId: this.pickString(item.variantId, item.variant_id),
      quantity: this.pickNumber(item.quantity, item.qty) ?? 1,
      unitPrice: this.toDecimalCurrency(
        this.pickNumber(item.unitPrice, item.unit_price),
        this.pickNumber(item.unitPriceMinor, item.unit_price_minor),
      ),
    }));

    if (items.length === 0) {
      throw new Error('Transaction payload does not contain any line items.');
    }

    const payments = this.buildPayments(payload, items);
    const branchId =
      this.pickString(payload.branchId, payload.branch_id) ?? batch.branchId;
    if (branchId.trim().toLowerCase() !== batch.branchId.trim().toLowerCase()) {
      throw new Error(
        'A sync entry cannot target a different branch from its batch.',
      );
    }
    const terminalId =
      this.pickString(payload.terminalId, payload.terminal_id) ??
      batch.terminalId;
    const cashierId =
      this.pickString(
        payload.cashierId,
        payload.cashier_id,
        payload.cashierName,
        payload.cashier_name,
      ) ?? 'unknown-cashier';

    const sale = await this.posLedgerService.createSaleFromSync({
      transactionId: entry.recordId,
      branchId,
      terminalId,
      type: 'SALE',
      terminalName: this.pickString(
        payload.terminalName,
        payload.terminal_name,
      ),
      cashierId,
      cashierName: this.pickString(payload.cashierName, payload.cashier_name),
      shiftId: this.pickString(payload.shiftId, payload.shift_id),
      customerName:
        this.pickString(payload.customerName, payload.customer_name) ??
        'Walk-in Customer',
      customerTin: this.pickString(payload.customerTin, payload.customer_tin),
      customerAddress: this.pickString(
        payload.customerAddress,
        payload.customer_address,
      ),
      customerBusinessStyle: this.pickString(
        payload.customerBusinessStyle,
        payload.customer_business_style,
      ),
      note: payload.note,
      refNumber: this.pickString(
        payload.referenceNumber,
        payload.reference_number,
      ),
      createdAt: entry.localCreatedAt,
      discountAmount: this.toDecimalCurrency(
        this.pickNumber(payload.discountAmount, payload.discount_amount),
        this.pickNumber(
          payload.discountAmountMinor,
          payload.discount_amount_minor,
        ),
      ),
      items,
      payments,
    });

    void this.eisSubmissionService
      .enqueueTransaction({
        transaction: sale,
        eventType: 'SALE',
        metadata: {
          source: 'sync-batch',
          syncEntryId: entry.id,
        },
      })
      .catch(() => undefined);

    this.realtimeGateway.broadcastTransactionCreated(branchId, entry.recordId);

    return {
      localTransactionId: entry.recordId,
      serverTransactionId: sale.id,
      orNumber: sale.orNumber,
      orLabel: `OR ${sale.orNumber}`,
      referenceNumber: sale.refNumber,
      total: sale.total,
      vatAmount: sale.vatAmount,
      changeAmount: sale.changeAmount,
      paymentMethod: sale.paymentMethod,
      createdAt: sale.createdAt,
    };
  }

  private async applyReceiptEventEntry(
    batch: CreateSyncBatchDto,
    entry: SyncEntry,
  ) {
    const payload = entry.payload as SyncReceiptEventPayload;
    const transactionId = this.pickString(
      payload.transactionId,
      payload.transaction_id,
      entry.recordId,
    );
    if (!transactionId) {
      throw new Error('Receipt event payload does not contain transactionId.');
    }
    const eventBranchId =
      this.pickString(payload.branchId, payload.branch_id) ?? batch.branchId;
    if (
      eventBranchId.trim().toLowerCase() !== batch.branchId.trim().toLowerCase()
    ) {
      throw new Error(
        'A receipt event cannot target a different branch from its batch.',
      );
    }

    const eventTypeRaw =
      this.pickString(payload.eventType, payload.event_type) ?? 'PRINT';
    const eventType = eventTypeRaw.trim().toUpperCase();
    if (!['PRINT', 'REPRINT', 'EMAIL'].includes(eventType)) {
      throw new Error(`Unsupported receipt event type: ${eventTypeRaw}`);
    }

    await this.posLedgerService.recordReceiptEvent({
      branchId: eventBranchId,
      terminalId:
        this.pickString(payload.terminalId, payload.terminal_id) ??
        batch.terminalId,
      cashierId: this.pickString(payload.cashierId, payload.cashier_id),
      transactionId,
      orNumber: this.pickNumber(payload.orNumber, payload.or_number),
      refNumber: this.pickString(
        payload.referenceNumber,
        payload.reference_number,
      ),
      eventType: eventType as 'PRINT' | 'REPRINT' | 'EMAIL',
      copyLabel: this.pickString(payload.copyLabel, payload.copy_label),
      occurredAt: this.pickString(payload.occurredAt, payload.occurred_at),
      metadata: {
        source: 'sync-batch',
        syncEntryId: entry.id,
        reason: this.pickString(payload.reason),
      },
    });
  }

  private buildPayments(
    payload: SyncTransactionPayload,
    items: Array<{
      itemId: string;
      name?: string;
      variantId?: string;
      quantity: number;
      unitPrice: number;
    }>,
  ) {
    const payments = (payload.payments ?? [])
      .map((payment) => {
        const method = this.normalizePaymentMethod(
          payment.method,
          payment.paymentMethod,
          payment.payment_method,
        );
        const amount = this.toDecimalCurrency(
          payment.amount,
          this.pickNumber(payment.amountMinor, payment.amount_minor),
        );

        if (!method || amount <= 0) {
          return null;
        }

        return {
          method,
          amount,
          reference: payment.reference,
        };
      })
      .filter((payment) => payment !== null);

    if (payments.length > 0) {
      return payments;
    }

    const inferredMethod =
      this.normalizePaymentMethod(
        payload.paymentMethod,
        payload.payment_method,
      ) ?? 'CASH';
    const inferredAmount =
      this.toDecimalCurrency(
        payload.total,
        this.pickNumber(payload.totalMinor, payload.total_minor),
      ) ||
      items.reduce((total, item) => total + item.quantity * item.unitPrice, 0);

    return [
      {
        method: inferredMethod,
        amount: inferredAmount,
        reference: this.pickString(
          payload.paymentReference,
          payload.payment_reference,
        ),
      },
    ];
  }

  private normalizePaymentMethod(
    ...values: Array<string | undefined>
  ): PaymentMethod | undefined {
    for (const value of values) {
      if (!value) {
        continue;
      }

      const normalized = value.trim().toUpperCase();
      switch (normalized) {
        case 'CASH':
          return 'CASH';
        case 'CARD':
          return 'CARD';
        case 'GCASH':
        case 'GCASH/MAYA':
          return 'GCASH';
        case 'MAYA':
          return 'MAYA';
        case 'SPLIT':
          return 'SPLIT';
      }
    }

    return undefined;
  }

  private pickString(...values: Array<string | undefined>) {
    return values.find((value) => value !== undefined && value.trim() !== '');
  }

  private pickNumber(...values: Array<number | undefined>) {
    return values.find(
      (value): value is number =>
        typeof value === 'number' && !Number.isNaN(value),
    );
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

  private toDecimalCurrency(value?: number, minorValue?: number) {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return Number(value.toFixed(4));
    }

    if (typeof minorValue === 'number' && !Number.isNaN(minorValue)) {
      return Number((minorValue / 100).toFixed(4));
    }

    return 0;
  }

  private toReason(error: unknown) {
    if (error instanceof Error && error.message.trim() !== '') {
      return error.message;
    }

    return 'The sync entry could not be processed.';
  }

  private buildIdempotencyKey(entry: SyncEntry) {
    return createHash('sha256')
      .update(`${entry.tableName}:${entry.recordId}:${entry.localCreatedAt}`)
      .digest('hex');
  }
}
