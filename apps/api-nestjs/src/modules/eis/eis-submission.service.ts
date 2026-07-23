import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { isBranchAllowed } from '../../common/auth/branch-scope';

export type EisSubmissionStatus = 'PENDING' | 'SUBMITTED' | 'FAILED';
export type EisSubmissionEventType = 'SALE' | 'REFUND' | 'VOID';
export type EisSubmissionMode = 'REMOTE' | 'SIMULATED' | 'REMOTE_REQUIRED';

export type EisSubmissionTransaction = {
  id: string;
  branchId: string;
  terminalId: string;
  cashierId?: string | null;
  orNumber: number;
  refNumber: string;
  total: number;
  subtotal?: number;
  vatAmount?: number;
  discountAmount?: number;
  status?: string;
  type?: string;
  createdAt: string;
  items?: Array<{
    name: string;
    qty: number;
    price: number;
  }>;
  payments?: Array<Record<string, unknown>>;
};

type EisSubmissionRecord = {
  id: string;
  transactionKey: string;
  transactionId: string;
  branchId: string;
  terminalId: string;
  orNumber: number;
  eventType: EisSubmissionEventType;
  status: EisSubmissionStatus;
  payload: Record<string, unknown>;
  payloadHash: string;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  retryCount: number;
  nextRetryAt: string | null;
  lastError: string | null;
  responseCode: number | null;
  remoteReference: string | null;
  lastSignature: string | null;
  lastAttemptAt: string | null;
  ackPayload: unknown;
};

type EisSubmissionStore = {
  version: 1;
  submissions: EisSubmissionRecord[];
  lastUpdatedAt: string;
};

type SubmissionAttemptResult =
  | {
      ok: true;
      responseCode: number;
      remoteReference: string;
      signature: string;
      ackPayload: unknown;
    }
  | {
      ok: false;
      responseCode: number | null;
      error: string;
      signature: string | null;
      ackPayload: unknown;
    };

const manilaDayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

@Injectable()
export class EisSubmissionService {
  private readonly storageFilePath = this.resolveStorageFilePath();
  private readonly endpointUrl = process.env.EIS_ENDPOINT_URL?.trim() ?? '';
  private readonly allowSimulation = this.readBooleanFromEnv(
    'EIS_ALLOW_SIMULATION',
    false,
  );
  private readonly apiKey = process.env.EIS_API_KEY?.trim() ?? '';
  private readonly taxpayerTin = process.env.EIS_TAXPAYER_TIN?.trim() ?? '';
  private readonly signingSecret =
    process.env.EIS_SIGNING_SECRET?.trim() || 'eis-local-dev-secret';
  private readonly maxRetries = this.readNumberFromEnv('EIS_MAX_RETRIES', 5);
  private readonly maxBatchSize = this.readNumberFromEnv(
    'EIS_FLUSH_BATCH_SIZE',
    50,
  );
  private readonly retryTickMs = this.readNumberFromEnv(
    'EIS_RETRY_TICK_MS',
    15_000,
  );
  private writeQueue: Promise<void> = Promise.resolve();
  private processingQueue = false;
  private retryTimer: NodeJS.Timeout | null = null;

  async onModuleInit() {
    await this.ensureStoreFile();
    this.retryTimer = setInterval(() => {
      void this.processPendingQueue();
    }, this.retryTickMs);
    void this.processPendingQueue();
  }

  onModuleDestroy() {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
  }

  async enqueueTransaction(params: {
    transaction: EisSubmissionTransaction;
    eventType?: EisSubmissionEventType;
    metadata?: Record<string, unknown>;
  }) {
    const eventType =
      params.eventType ??
      this.resolveEventTypeFromTransaction(params.transaction.type);
    const payload = this.buildPayload(
      params.transaction,
      eventType,
      params.metadata,
    );
    const payloadHash = this.hashPayload(payload);
    const transactionKey = `${params.transaction.id}:${eventType}`;
    const now = new Date().toISOString();
    const record = await this.mutateStore((store) => {
      const existing = store.submissions.find(
        (entry) => entry.transactionKey === transactionKey,
      );

      if (existing) {
        return existing;
      }

      const created: EisSubmissionRecord = {
        id: randomUUID(),
        transactionKey,
        transactionId: params.transaction.id,
        branchId: params.transaction.branchId,
        terminalId: params.transaction.terminalId,
        orNumber: params.transaction.orNumber,
        eventType,
        status: 'PENDING',
        payload,
        payloadHash,
        createdAt: now,
        updatedAt: now,
        submittedAt: null,
        retryCount: 0,
        nextRetryAt: null,
        lastError: null,
        responseCode: null,
        remoteReference: null,
        lastSignature: null,
        lastAttemptAt: null,
        ackPayload: null,
      };

      store.submissions.push(created);
      return created;
    });

    void this.processPendingQueue({ branchId: record.branchId });
    return this.toSubmissionView(record);
  }

  async listSubmissions(
    params?: {
      branchId?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    },
    allowedBranchIds?: string[],
  ) {
    const page = Math.max(params?.page ?? 1, 1);
    const pageSize = Math.min(Math.max(params?.pageSize ?? 25, 1), 200);
    const normalizedStatus = this.normalizeStatus(params?.status);
    const store = await this.readStore();
    const filtered = store.submissions
      .filter((entry) => isBranchAllowed(entry.branchId, allowedBranchIds))
      .filter((entry) =>
        params?.branchId ? entry.branchId === params.branchId : true,
      )
      .filter((entry) =>
        normalizedStatus ? entry.status === normalizedStatus : true,
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const items = filtered
      .slice(start, end)
      .map((entry) => this.toSubmissionView(entry));

    return {
      items,
      total: filtered.length,
      page,
      pageSize,
    };
  }

  async getSubmissionSummary(
    params?: {
      branchId?: string;
      fromDate?: string;
      toDate?: string;
    },
    allowedBranchIds?: string[],
  ) {
    const store = await this.readStore();
    const range = this.normalizeDateRange(params?.fromDate, params?.toDate);
    const filtered = store.submissions.filter((entry) => {
      if (!isBranchAllowed(entry.branchId, allowedBranchIds)) {
        return false;
      }
      if (params?.branchId && entry.branchId !== params.branchId) {
        return false;
      }
      const dayKey = this.asManilaDayKey(entry.createdAt);
      return dayKey >= range.from && dayKey <= range.to;
    });
    const now = Date.now();
    const totals = filtered.reduce(
      (accumulator, entry) => {
        accumulator.queued += 1;
        if (entry.status === 'SUBMITTED') {
          accumulator.submitted += 1;
        } else if (entry.status === 'FAILED') {
          accumulator.failed += 1;
        } else {
          accumulator.pending += 1;
        }
        if (
          entry.status !== 'SUBMITTED' &&
          entry.nextRetryAt &&
          new Date(entry.nextRetryAt).getTime() <= now
        ) {
          accumulator.retryDue += 1;
        }
        return accumulator;
      },
      {
        queued: 0,
        submitted: 0,
        pending: 0,
        failed: 0,
        retryDue: 0,
      },
    );
    const lastSubmittedAt =
      filtered
        .filter((entry) => entry.submittedAt !== null)
        .map((entry) => entry.submittedAt as string)
        .sort((left, right) => right.localeCompare(left))[0] ?? null;
    const byDay = new Map<
      string,
      { date: string; submitted: number; failed: number; pending: number }
    >();

    for (const entry of filtered) {
      const dayKey = this.asManilaDayKey(entry.createdAt);
      const bucket = byDay.get(dayKey) ?? {
        date: dayKey,
        submitted: 0,
        failed: 0,
        pending: 0,
      };
      if (entry.status === 'SUBMITTED') {
        bucket.submitted += 1;
      } else if (entry.status === 'FAILED') {
        bucket.failed += 1;
      } else {
        bucket.pending += 1;
      }
      byDay.set(dayKey, bucket);
    }

    return {
      mode: this.resolveSubmissionMode(),
      endpointConfigured: this.endpointUrl.length > 0,
      liveSubmissionReady: this.isLiveSubmissionReady(),
      readinessIssues: this.getReadinessIssues(),
      totals,
      lastSubmittedAt,
      fromDate: range.from,
      toDate: range.to,
      filedByDay: [...byDay.values()].sort((left, right) =>
        left.date.localeCompare(right.date),
      ),
    };
  }

  async retrySubmission(submissionId: string, allowedBranchIds?: string[]) {
    const reset = await this.mutateStore((store) => {
      const entry = store.submissions.find(
        (candidate) => candidate.id === submissionId,
      );
      if (!entry) {
        throw new NotFoundException(
          `EIS submission ${submissionId} was not found.`,
        );
      }
      if (!isBranchAllowed(entry.branchId, allowedBranchIds)) {
        throw new NotFoundException(
          `EIS submission ${submissionId} was not found.`,
        );
      }

      entry.status = 'PENDING';
      entry.retryCount = 0;
      entry.nextRetryAt = null;
      entry.lastError = null;
      entry.updatedAt = new Date().toISOString();
      return entry;
    });
    const queueResult = await this.processPendingQueue({
      maxItems: 1,
      forceIds: [submissionId],
    });

    return {
      submission: this.toSubmissionView(reset),
      queueResult,
    };
  }

  async processPendingQueue(options?: {
    branchId?: string;
    maxItems?: number;
    forceIds?: string[];
  }) {
    if (this.processingQueue) {
      return {
        processed: 0,
        submitted: 0,
        failed: 0,
        pending: await this.countPending(options?.branchId),
        mode: this.resolveSubmissionMode(),
      };
    }

    this.processingQueue = true;
    let processed = 0;
    let submitted = 0;
    let failed = 0;

    try {
      const dueEntries = await this.getDueSubmissions(options);
      for (const entry of dueEntries) {
        processed += 1;
        const attempt = await this.submitRecord(entry);

        if (attempt.ok) {
          submitted += 1;
          await this.mutateStore((store) => {
            const target = store.submissions.find(
              (candidate) => candidate.id === entry.id,
            );
            if (!target) {
              return;
            }

            const now = new Date().toISOString();
            target.status = 'SUBMITTED';
            target.updatedAt = now;
            target.submittedAt = now;
            target.nextRetryAt = null;
            target.lastError = null;
            target.responseCode = attempt.responseCode;
            target.remoteReference = attempt.remoteReference;
            target.lastSignature = attempt.signature;
            target.lastAttemptAt = now;
            target.ackPayload = attempt.ackPayload;
          });
          continue;
        }

        failed += 1;
        await this.mutateStore((store) => {
          const target = store.submissions.find(
            (candidate) => candidate.id === entry.id,
          );
          if (!target) {
            return;
          }

          const now = new Date().toISOString();
          const nextRetryCount = target.retryCount + 1;
          const exhausted = nextRetryCount >= this.maxRetries;
          target.status = 'FAILED';
          target.retryCount = nextRetryCount;
          target.updatedAt = now;
          target.lastAttemptAt = now;
          target.lastError = attempt.error;
          target.responseCode = attempt.responseCode;
          target.lastSignature = attempt.signature;
          target.ackPayload = attempt.ackPayload;
          target.nextRetryAt = exhausted
            ? null
            : new Date(
                Date.now() + this.retryDelayMs(nextRetryCount),
              ).toISOString();
        });
      }
    } finally {
      this.processingQueue = false;
    }

    return {
      processed,
      submitted,
      failed,
      pending: await this.countPending(options?.branchId),
      mode: this.resolveSubmissionMode(),
    };
  }

  private async submitRecord(
    record: EisSubmissionRecord,
  ): Promise<SubmissionAttemptResult> {
    const timestamp = new Date().toISOString();
    const envelope = {
      taxpayerTin: this.taxpayerTin,
      branchId: record.branchId,
      terminalId: record.terminalId,
      eventType: record.eventType,
      submissionId: record.id,
      sentAt: timestamp,
      payload: record.payload,
    };
    const signature = this.signPayload(timestamp, envelope);

    if (this.endpointUrl.length === 0) {
      if (!this.allowSimulation) {
        return {
          ok: false,
          responseCode: 503,
          error:
            'EIS endpoint is not configured. Set EIS_ENDPOINT_URL for live BIR filing.',
          signature,
          ackPayload: {
            acknowledged: false,
            mode: 'REMOTE_REQUIRED',
            reason: 'EIS endpoint is not configured.',
          },
        };
      }

      return {
        ok: true,
        responseCode: 200,
        remoteReference: `SIM-${record.id.substring(0, 8)}-${Date.now().toString().substring(8)}`,
        signature,
        ackPayload: {
          acknowledged: true,
          mode: 'SIMULATED',
          submittedAt: timestamp,
        },
      };
    }

    const configurationIssues = this.getReadinessIssues().filter(
      (issue) => issue !== 'EIS endpoint URL is not configured.',
    );
    if (configurationIssues.length > 0) {
      return {
        ok: false,
        responseCode: 400,
        error: `EIS configuration is incomplete: ${configurationIssues.join(' ')}`,
        signature,
        ackPayload: {
          acknowledged: false,
          mode: 'REMOTE',
          issues: configurationIssues,
        },
      };
    }

    try {
      const response = await fetch(this.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-EIS-Signature': signature,
          'X-EIS-Timestamp': timestamp,
          ...(this.apiKey.length > 0
            ? { 'X-EIS-Api-Key': this.apiKey }
            : undefined),
        },
        body: JSON.stringify(envelope),
      });

      const rawBody = await response.text();
      const parsedBody = this.tryParseJson(rawBody);

      if (!response.ok) {
        return {
          ok: false,
          responseCode: response.status,
          error: this.extractErrorMessage(parsedBody, rawBody),
          signature,
          ackPayload: parsedBody ?? rawBody,
        };
      }

      return {
        ok: true,
        responseCode: response.status,
        remoteReference:
          this.extractReference(parsedBody) ??
          `ACK-${record.id.substring(0, 8)}-${Date.now().toString().substring(8)}`,
        signature,
        ackPayload: parsedBody ?? rawBody,
      };
    } catch (error) {
      return {
        ok: false,
        responseCode: null,
        error: this.extractErrorMessage(null, error),
        signature,
        ackPayload: null,
      };
    }
  }

  private extractReference(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const map = payload as Record<string, unknown>;
    const reference = map.reference ?? map.referenceNumber ?? map.ackId;
    if (typeof reference === 'string' && reference.trim().length > 0) {
      return reference;
    }
    return null;
  }

  private extractErrorMessage(payload: unknown, fallback: unknown): string {
    if (payload && typeof payload === 'object') {
      const map = payload as Record<string, unknown>;
      const message = map.message ?? map.error ?? map.detail;
      if (typeof message === 'string' && message.trim().length > 0) {
        return message;
      }
    }

    const text = typeof fallback === 'string' ? fallback : String(fallback);
    return text.trim().length === 0 ? 'EIS submission failed.' : text.trim();
  }

  private signPayload(timestamp: string, payload: unknown) {
    return createHmac('sha256', this.signingSecret)
      .update(`${timestamp}.${JSON.stringify(payload)}`)
      .digest('hex');
  }

  private hashPayload(payload: unknown) {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private buildPayload(
    transaction: EisSubmissionTransaction,
    eventType: EisSubmissionEventType,
    metadata?: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      transactionId: transaction.id,
      eventType,
      branchId: transaction.branchId,
      terminalId: transaction.terminalId,
      cashierId: transaction.cashierId ?? null,
      orNumber: transaction.orNumber,
      referenceNumber: transaction.refNumber,
      status: transaction.status ?? null,
      transactionType: transaction.type ?? null,
      createdAt: transaction.createdAt,
      totals: {
        subtotal: this.roundMoney(transaction.subtotal ?? 0),
        vatAmount: this.roundMoney(transaction.vatAmount ?? 0),
        discountAmount: this.roundMoney(transaction.discountAmount ?? 0),
        total: this.roundMoney(transaction.total),
      },
      items: transaction.items ?? [],
      payments: transaction.payments ?? [],
      metadata: metadata ?? {},
    };
  }

  private resolveEventTypeFromTransaction(
    transactionType?: string,
  ): EisSubmissionEventType {
    if (transactionType?.toUpperCase() == 'REFUND') {
      return 'REFUND';
    }
    return 'SALE';
  }

  private normalizeStatus(status?: string): EisSubmissionStatus | null {
    const normalized = status?.trim().toUpperCase();
    if (
      normalized === 'PENDING' ||
      normalized === 'SUBMITTED' ||
      normalized === 'FAILED'
    ) {
      return normalized;
    }
    return null;
  }

  private async getDueSubmissions(options?: {
    branchId?: string;
    maxItems?: number;
    forceIds?: string[];
  }) {
    const forceSet = new Set(options?.forceIds ?? []);
    const now = Date.now();
    const maxItems = Math.max(
      1,
      Math.min(options?.maxItems ?? this.maxBatchSize, this.maxBatchSize),
    );
    const store = await this.readStore();

    return store.submissions
      .filter((entry) =>
        options?.branchId ? entry.branchId === options.branchId : true,
      )
      .filter((entry) => {
        if (forceSet.has(entry.id)) {
          return true;
        }
        if (entry.status === 'SUBMITTED') {
          return false;
        }
        if (entry.retryCount >= this.maxRetries) {
          return false;
        }
        if (entry.status === 'PENDING') {
          return true;
        }
        if (!entry.nextRetryAt) {
          return false;
        }
        return new Date(entry.nextRetryAt).getTime() <= now;
      })
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .slice(0, maxItems);
  }

  private retryDelayMs(retryCount: number) {
    const minutes = Math.min(30, Math.max(1, 2 ** retryCount));
    return minutes * 60_000;
  }

  private resolveSubmissionMode(): EisSubmissionMode {
    if (this.endpointUrl.length > 0) {
      return 'REMOTE';
    }
    return this.allowSimulation ? 'SIMULATED' : 'REMOTE_REQUIRED';
  }

  private isLiveSubmissionReady() {
    return this.getReadinessIssues().length === 0;
  }

  private getReadinessIssues() {
    const issues: string[] = [];
    if (this.endpointUrl.length === 0) {
      issues.push('EIS endpoint URL is not configured.');
    }
    if (this.taxpayerTin.length === 0) {
      issues.push('Taxpayer TIN is not configured.');
    }
    if (this.apiKey.length === 0) {
      issues.push('EIS API key is not configured.');
    }
    if (
      this.signingSecret.length === 0 ||
      this.signingSecret === 'eis-local-dev-secret'
    ) {
      issues.push('EIS signing secret is using default or empty value.');
    }
    return issues;
  }

  private roundMoney(value: number) {
    return Number(value.toFixed(2));
  }

  private normalizeDateRange(fromDate?: string, toDate?: string) {
    const today = this.asManilaDayKey(new Date().toISOString());
    const from = this.asManilaDayKey(fromDate ?? today);
    const to = this.asManilaDayKey(toDate ?? today);
    if (from <= to) {
      return { from, to };
    }
    return { from: to, to: from };
  }

  private asManilaDayKey(value: string) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    const parts = manilaDayKeyFormatter.formatToParts(new Date(value));
    const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
    const month = parts.find((part) => part.type === 'month')?.value ?? '01';
    const day = parts.find((part) => part.type === 'day')?.value ?? '01';
    return `${year}-${month}-${day}`;
  }

  private toSubmissionView(record: EisSubmissionRecord) {
    return {
      id: record.id,
      transactionId: record.transactionId,
      branchId: record.branchId,
      terminalId: record.terminalId,
      orNumber: record.orNumber,
      eventType: record.eventType,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      submittedAt: record.submittedAt,
      retryCount: record.retryCount,
      nextRetryAt: record.nextRetryAt,
      lastError: record.lastError,
      responseCode: record.responseCode,
      remoteReference: record.remoteReference,
      payloadHash: record.payloadHash,
      lastAttemptAt: record.lastAttemptAt,
      ackPayload: record.ackPayload,
      mode: this.resolveSubmissionMode(),
    };
  }

  private async countPending(branchId?: string) {
    const store = await this.readStore();
    return store.submissions.filter((entry) => {
      if (branchId && entry.branchId !== branchId) {
        return false;
      }
      return entry.status !== 'SUBMITTED';
    }).length;
  }

  private async mutateStore<T>(
    mutator: (store: EisSubmissionStore) => Promise<T> | T,
  ) {
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

  private async readStore(): Promise<EisSubmissionStore> {
    await this.ensureStoreFile();
    const content = await readFile(this.storageFilePath, 'utf8');
    let parsed: Partial<EisSubmissionStore> = {};

    try {
      parsed = JSON.parse(content) as Partial<EisSubmissionStore>;
    } catch {
      parsed = {};
    }

    return {
      version: 1,
      submissions: parsed.submissions ?? [],
      lastUpdatedAt: parsed.lastUpdatedAt ?? new Date().toISOString(),
    };
  }

  private async writeStore(store: EisSubmissionStore) {
    await mkdir(dirname(this.storageFilePath), { recursive: true });
    const tempPath = `${this.storageFilePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    await rename(tempPath, this.storageFilePath);
  }

  private async ensureStoreFile() {
    try {
      await stat(this.storageFilePath);
    } catch {
      await mkdir(dirname(this.storageFilePath), { recursive: true });
      const emptyStore: EisSubmissionStore = {
        version: 1,
        submissions: [],
        lastUpdatedAt: new Date().toISOString(),
      };
      await writeFile(
        this.storageFilePath,
        `${JSON.stringify(emptyStore, null, 2)}\n`,
        'utf8',
      );
    }
  }

  private resolveStorageFilePath() {
    if (process.env.EIS_SUBMISSIONS_FILE) {
      return process.env.EIS_SUBMISSIONS_FILE;
    }

    const cwd = process.cwd();
    if (cwd.endsWith(join('apps', 'api-nestjs'))) {
      return join(cwd, 'storage', 'eis-submissions.json');
    }

    return join(cwd, 'apps', 'api-nestjs', 'storage', 'eis-submissions.json');
  }

  private tryParseJson(value: string) {
    if (value.trim().length === 0) {
      return null;
    }
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }

  private readNumberFromEnv(name: string, fallback: number) {
    const raw = process.env[name];
    if (!raw) {
      return fallback;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.round(parsed);
  }

  private readBooleanFromEnv(name: string, fallback: boolean) {
    const raw = process.env[name];
    if (!raw) {
      return fallback;
    }

    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false;
    }

    return fallback;
  }
}
