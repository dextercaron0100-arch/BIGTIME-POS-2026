import { Injectable } from '@nestjs/common';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { UpdateBirSettingsDto } from './dto/update-bir-settings.dto';

export type StoredBirSettings = {
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

type BirSettingsStore = {
  version: 1;
  branches: Record<string, StoredBirSettings>;
  lastUpdatedAt: string;
};

@Injectable()
export class BirSettingsService {
  private readonly storageFilePath = this.resolveStorageFilePath();
  private writeQueue = Promise.resolve();

  async getSettings(branchId: string) {
    const store = await this.readStore();
    return this.presentSettings(branchId, store.branches[branchId]);
  }

  async updateSettings(branchId: string, payload: UpdateBirSettingsDto) {
    return this.mutateStore((store) => {
      const nextSettings = this.normalizePayload(payload);
      store.branches[branchId] = nextSettings;
      return this.presentSettings(branchId, nextSettings);
    });
  }

  private presentSettings(branchId: string, settings?: StoredBirSettings) {
    const normalized = this.normalizeStoredSettings(settings);
    return {
      branchId,
      birEnabled: normalized.birEnabled,
      autoZRead: normalized.autoZRead,
      storeName: normalized.storeName,
      proprietorName: normalized.proprietorName,
      vatTin: normalized.vatTin,
      permitNumber: normalized.permitNumber,
      permitDateIssued: normalized.permitDateIssued,
      authorityToPrintNumber: normalized.authorityToPrintNumber,
      authorityToPrintDateIssued: normalized.authorityToPrintDateIssued,
      approvedSerialRange: normalized.approvedSerialRange,
      machineIdentificationNumber: normalized.machineIdentificationNumber,
      serialNumber: normalized.serialNumber,
      businessAddressLines: normalized.businessAddressLines,
      footerLines: normalized.footerLines,
      updatedAt: normalized.updatedAt,
    };
  }

  private normalizePayload(payload: UpdateBirSettingsDto): StoredBirSettings {
    return {
      birEnabled: payload.birEnabled,
      autoZRead: payload.autoZRead,
      storeName: payload.storeName.trim(),
      proprietorName: payload.proprietorName.trim(),
      vatTin: payload.vatTin.trim(),
      permitNumber: payload.permitNumber.trim(),
      permitDateIssued: payload.permitDateIssued.trim(),
      authorityToPrintNumber: payload.authorityToPrintNumber.trim(),
      authorityToPrintDateIssued: payload.authorityToPrintDateIssued.trim(),
      approvedSerialRange: payload.approvedSerialRange.trim(),
      machineIdentificationNumber: payload.machineIdentificationNumber.trim(),
      serialNumber: payload.serialNumber.trim(),
      businessAddressLines: this.normalizeLines(payload.businessAddressLines),
      footerLines: this.normalizeLines(payload.footerLines),
      updatedAt: new Date().toISOString(),
    };
  }

  private normalizeStoredSettings(
    settings?: StoredBirSettings,
  ): StoredBirSettings {
    return {
      birEnabled: settings?.birEnabled ?? true,
      autoZRead: settings?.autoZRead ?? false,
      storeName: settings?.storeName?.trim() ?? '',
      proprietorName: settings?.proprietorName?.trim() ?? '',
      vatTin: settings?.vatTin?.trim() ?? '',
      permitNumber: settings?.permitNumber?.trim() ?? '',
      permitDateIssued: settings?.permitDateIssued?.trim() ?? '',
      authorityToPrintNumber: settings?.authorityToPrintNumber?.trim() ?? '',
      authorityToPrintDateIssued:
        settings?.authorityToPrintDateIssued?.trim() ?? '',
      approvedSerialRange: settings?.approvedSerialRange?.trim() ?? '',
      machineIdentificationNumber:
        settings?.machineIdentificationNumber?.trim() ?? '',
      serialNumber: settings?.serialNumber?.trim() ?? '',
      businessAddressLines: this.normalizeLines(settings?.businessAddressLines),
      footerLines: this.normalizeLines(settings?.footerLines),
      updatedAt: settings?.updatedAt ?? new Date().toISOString(),
    };
  }

  private normalizeLines(lines?: string[]) {
    if (!lines?.length) {
      return [];
    }

    return lines.map((line) => line.trim()).filter(Boolean);
  }

  private async mutateStore<T>(
    mutator: (store: BirSettingsStore) => Promise<T> | T,
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
    if (process.env.BIR_SETTINGS_STORAGE_FILE) {
      return process.env.BIR_SETTINGS_STORAGE_FILE;
    }

    const cwd = process.cwd();
    if (cwd.endsWith(join('apps', 'api-nestjs'))) {
      return join(cwd, 'storage', 'bir-settings.json');
    }

    return join(cwd, 'apps', 'api-nestjs', 'storage', 'bir-settings.json');
  }

  private async readStore(): Promise<BirSettingsStore> {
    await this.ensureStoreFile();
    const content = await readFile(this.storageFilePath, 'utf8');
    const parsed = JSON.parse(content) as Partial<BirSettingsStore>;

    return {
      version: 1,
      branches: parsed.branches ?? {},
      lastUpdatedAt: parsed.lastUpdatedAt ?? new Date().toISOString(),
    };
  }

  private async writeStore(store: BirSettingsStore) {
    await mkdir(dirname(this.storageFilePath), { recursive: true });
    const tempPath = `${this.storageFilePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    await rename(tempPath, this.storageFilePath);
  }

  private async ensureStoreFile() {
    try {
      await stat(this.storageFilePath);
    } catch {
      const seedStore: BirSettingsStore = {
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
