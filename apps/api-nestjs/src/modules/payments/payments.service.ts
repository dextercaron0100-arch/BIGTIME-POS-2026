import type { PaymentMethod } from '@apex-pos/shared-types';
import { BadRequestException, Injectable } from '@nestjs/common';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto';
import { assertBranchAllowed } from '../../common/auth/branch-scope';

const paymentMethods: PaymentMethod[] = [
  'CASH',
  'CARD',
  'GCASH',
  'MAYA',
  'SPLIT',
];

type StoredPaymentSettings = {
  enabledMethods: PaymentMethod[];
  defaultMethod: PaymentMethod;
  updatedAt: string;
};

type PaymentSettingsStore = {
  version: 1;
  branches: Record<string, StoredPaymentSettings>;
  lastUpdatedAt: string;
};

const paymentMethodCatalog: Record<
  PaymentMethod,
  {
    label: string;
    supportsSplit: boolean;
    requiresReference: boolean;
  }
> = {
  CASH: {
    label: 'Cash',
    supportsSplit: true,
    requiresReference: false,
  },
  CARD: {
    label: 'Card',
    supportsSplit: true,
    requiresReference: true,
  },
  GCASH: {
    label: 'GCash',
    supportsSplit: true,
    requiresReference: true,
  },
  MAYA: {
    label: 'Maya',
    supportsSplit: true,
    requiresReference: true,
  },
  SPLIT: {
    label: 'Split',
    supportsSplit: false,
    requiresReference: false,
  },
};

@Injectable()
export class PaymentsService {
  private readonly storageFilePath = this.resolveStorageFilePath();
  private writeQueue = Promise.resolve();

  async getMethods(branchId: string, allowedBranchIds?: string[]) {
    const settings = await this.getSettings(branchId, allowedBranchIds);
    return settings.methods.filter((method) => method.enabled);
  }

  async getSettings(branchId: string, allowedBranchIds?: string[]) {
    const normalizedBranchId = assertBranchAllowed(branchId, allowedBranchIds);
    const store = await this.readStore();
    return this.presentSettings(
      normalizedBranchId,
      store.branches[normalizedBranchId],
    );
  }

  async updateSettings(
    branchId: string,
    payload: UpdatePaymentSettingsDto,
    allowedBranchIds?: string[],
  ) {
    const normalizedBranchId = assertBranchAllowed(branchId, allowedBranchIds);
    return this.mutateStore((store) => {
      const nextSettings = this.normalizePayload(payload);
      store.branches[normalizedBranchId] = nextSettings;
      return this.presentSettings(normalizedBranchId, nextSettings);
    });
  }

  private normalizePayload(
    payload: UpdatePaymentSettingsDto,
  ): StoredPaymentSettings {
    const enabledSet = new Set<PaymentMethod>();
    for (const method of payload.methods) {
      if (method.enabled) {
        enabledSet.add(method.code);
      }
    }

    const enabledMethods = paymentMethods.filter((code) =>
      enabledSet.has(code),
    );
    if (enabledMethods.length === 0) {
      throw new BadRequestException('Enable at least one payment method.');
    }

    const defaultMethod = enabledMethods.includes(payload.defaultMethod)
      ? payload.defaultMethod
      : enabledMethods[0];

    return {
      enabledMethods,
      defaultMethod,
      updatedAt: new Date().toISOString(),
    };
  }

  private presentSettings(branchId: string, settings?: StoredPaymentSettings) {
    const normalized = this.normalizeStoredSettings(settings);
    return {
      branchId,
      defaultMethod: normalized.defaultMethod,
      updatedAt: normalized.updatedAt,
      methods: paymentMethods.map((code) => ({
        code,
        label: paymentMethodCatalog[code].label,
        enabled: normalized.enabledMethods.includes(code),
        supportsSplit: paymentMethodCatalog[code].supportsSplit,
        requiresReference: paymentMethodCatalog[code].requiresReference,
      })),
    };
  }

  private normalizeStoredSettings(
    settings?: StoredPaymentSettings,
  ): StoredPaymentSettings {
    const enabledSet = new Set<PaymentMethod>();
    for (const value of settings?.enabledMethods ?? paymentMethods) {
      if (this.isPaymentMethod(value)) {
        enabledSet.add(value);
      }
    }

    const enabledMethods = paymentMethods.filter((code) =>
      enabledSet.has(code),
    );
    if (enabledMethods.length === 0) {
      enabledMethods.push('CASH');
    }

    const defaultMethod = this.isPaymentMethod(settings?.defaultMethod)
      ? settings.defaultMethod
      : 'CASH';

    return {
      enabledMethods,
      defaultMethod: enabledMethods.includes(defaultMethod)
        ? defaultMethod
        : enabledMethods[0],
      updatedAt: settings?.updatedAt ?? new Date().toISOString(),
    };
  }

  private isPaymentMethod(value: unknown): value is PaymentMethod {
    return paymentMethods.includes(value as PaymentMethod);
  }

  private async mutateStore<T>(
    mutator: (store: PaymentSettingsStore) => Promise<T> | T,
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

  private resolveStorageFilePath() {
    if (process.env.PAYMENT_SETTINGS_STORAGE_FILE) {
      return process.env.PAYMENT_SETTINGS_STORAGE_FILE;
    }

    const cwd = process.cwd();
    if (cwd.endsWith(join('apps', 'api-nestjs'))) {
      return join(cwd, 'storage', 'payment-settings.json');
    }

    return join(cwd, 'apps', 'api-nestjs', 'storage', 'payment-settings.json');
  }

  private async readStore(): Promise<PaymentSettingsStore> {
    await this.ensureStoreFile();
    const content = await readFile(this.storageFilePath, 'utf8');
    const parsed = JSON.parse(content) as Partial<PaymentSettingsStore>;

    return {
      version: 1,
      branches: parsed.branches ?? {},
      lastUpdatedAt: parsed.lastUpdatedAt ?? new Date().toISOString(),
    };
  }

  private async writeStore(store: PaymentSettingsStore) {
    await mkdir(dirname(this.storageFilePath), { recursive: true });
    const tempPath = `${this.storageFilePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    await rename(tempPath, this.storageFilePath);
  }

  private async ensureStoreFile() {
    try {
      await stat(this.storageFilePath);
    } catch {
      const seedStore: PaymentSettingsStore = {
        version: 1,
        branches: {},
        lastUpdatedAt: new Date().toISOString(),
      };
      await mkdir(dirname(this.storageFilePath), { recursive: true });
      await writeFile(
        this.storageFilePath,
        `${JSON.stringify(seedStore, null, 2)}\n`,
        'utf8',
      );
    }
  }
}
