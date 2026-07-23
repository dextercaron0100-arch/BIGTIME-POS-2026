import type { ActiveTerminal } from '@apex-pos/shared-types';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { dashboardOverview } from '../../data/mock-data';
import {
  assertBranchAllowed,
  isBranchAllowed,
} from '../../common/auth/branch-scope';

type StoredTerminalSettings = {
  name: string;
  updatedAt: string;
};

type TerminalSettingsStore = {
  version: 1;
  terminals: Record<string, StoredTerminalSettings>;
  lastUpdatedAt: string;
};

@Injectable()
export class PosTerminalSettingsService {
  private readonly storageFilePath = this.resolveStorageFilePath();
  private writeQueue = Promise.resolve();

  async listTerminals(branchId?: string, allowedBranchIds?: string[]) {
    const store = await this.readStore();
    if (branchId && branchId !== 'all') {
      assertBranchAllowed(branchId, allowedBranchIds);
    }
    return this.presentTerminals(store, branchId, allowedBranchIds);
  }

  async updateTerminalName(
    terminalId: string,
    name: string,
    allowedBranchIds?: string[],
  ) {
    const normalizedTerminalId = terminalId.trim().toLowerCase();
    const defaultTerminal = this.findDefaultTerminal(normalizedTerminalId);

    if (!defaultTerminal) {
      throw new NotFoundException(`Terminal "${terminalId}" was not found.`);
    }
    assertBranchAllowed(defaultTerminal.branchId, allowedBranchIds);

    const nextName = name.trim();
    if (nextName.length < 2) {
      throw new BadRequestException(
        'Terminal name must be at least 2 characters.',
      );
    }

    return this.mutateStore((store) => {
      if (nextName === defaultTerminal.name) {
        delete store.terminals[normalizedTerminalId];
      } else {
        store.terminals[normalizedTerminalId] = {
          name: nextName,
          updatedAt: new Date().toISOString(),
        };
      }

      return this.presentTerminal(
        defaultTerminal,
        store.terminals[normalizedTerminalId],
      );
    });
  }

  async resetTerminalName(terminalId: string, allowedBranchIds?: string[]) {
    const normalizedTerminalId = terminalId.trim().toLowerCase();
    const defaultTerminal = this.findDefaultTerminal(normalizedTerminalId);

    if (!defaultTerminal) {
      throw new NotFoundException(`Terminal "${terminalId}" was not found.`);
    }
    assertBranchAllowed(defaultTerminal.branchId, allowedBranchIds);

    return this.mutateStore((store) => {
      delete store.terminals[normalizedTerminalId];
      return this.presentTerminal(defaultTerminal, undefined);
    });
  }

  async applyConfiguredNames(terminals: ActiveTerminal[]) {
    const store = await this.readStore();
    return terminals.map((terminal) => {
      const normalizedTerminalId = terminal.id.trim().toLowerCase();
      const override = store.terminals[normalizedTerminalId];
      return override?.name?.trim()
        ? { ...terminal, name: override.name.trim() }
        : terminal;
    });
  }

  private presentTerminals(
    store: TerminalSettingsStore,
    branchId?: string,
    allowedBranchIds?: string[],
  ) {
    return dashboardOverview.terminals
      .filter(
        (terminal) =>
          !branchId || branchId === 'all' || terminal.branchId === branchId,
      )
      .filter((terminal) =>
        isBranchAllowed(terminal.branchId, allowedBranchIds),
      )
      .map((terminal) =>
        this.presentTerminal(
          terminal,
          store.terminals[terminal.id.trim().toLowerCase()],
        ),
      );
  }

  private presentTerminal(
    terminal: ActiveTerminal,
    override?: StoredTerminalSettings,
  ) {
    return {
      id: terminal.id,
      branchId: terminal.branchId,
      name: override?.name?.trim() || terminal.name,
      defaultName: terminal.name,
      serialNumber: terminal.serialNumber,
      cashierName: terminal.cashierName,
      status: terminal.status,
      lastSeenAt: terminal.lastSeenAt,
      hasCustomName: Boolean(override?.name?.trim()),
      updatedAt: override?.updatedAt ?? null,
    };
  }

  private findDefaultTerminal(terminalId: string) {
    return dashboardOverview.terminals.find(
      (terminal) => terminal.id.trim().toLowerCase() === terminalId,
    );
  }

  private async mutateStore<T>(
    mutator: (store: TerminalSettingsStore) => Promise<T> | T,
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
    if (process.env.POS_TERMINAL_SETTINGS_STORAGE_FILE) {
      return process.env.POS_TERMINAL_SETTINGS_STORAGE_FILE;
    }

    const cwd = process.cwd();
    if (cwd.endsWith(join('apps', 'api-nestjs'))) {
      return join(cwd, 'storage', 'terminal-settings.json');
    }

    return join(cwd, 'apps', 'api-nestjs', 'storage', 'terminal-settings.json');
  }

  private async readStore(): Promise<TerminalSettingsStore> {
    await this.ensureStoreFile();
    const content = await readFile(this.storageFilePath, 'utf8');
    const parsed = JSON.parse(content) as Partial<TerminalSettingsStore>;

    return {
      version: 1,
      terminals: parsed.terminals ?? {},
      lastUpdatedAt: parsed.lastUpdatedAt ?? new Date().toISOString(),
    };
  }

  private async writeStore(store: TerminalSettingsStore) {
    await mkdir(dirname(this.storageFilePath), { recursive: true });
    const tempPath = `${this.storageFilePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    await rename(tempPath, this.storageFilePath);
  }

  private async ensureStoreFile() {
    try {
      await stat(this.storageFilePath);
    } catch {
      const seedStore: TerminalSettingsStore = {
        version: 1,
        terminals: {},
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
