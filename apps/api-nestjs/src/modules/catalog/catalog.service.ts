import type { CatalogCategory, CatalogItem } from '@apex-pos/shared-types';
import { Injectable } from '@nestjs/common';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { catalogCategories, catalogItems } from '../../data/mock-data';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { ReplaceCatalogSnapshotDto } from './dto/replace-catalog-snapshot.dto';

type StoredCatalogBranch = {
  categories: CatalogCategory[];
  items: CatalogItem[];
  updatedAt: string;
};

type CatalogStore = {
  version: 1;
  branches: Record<string, StoredCatalogBranch>;
  lastUpdatedAt: string;
};

@Injectable()
export class CatalogService {
  constructor(private readonly realtimeGateway: RealtimeGateway) {}

  private readonly storageFilePath = this.resolveStorageFilePath();
  private writeQueue = Promise.resolve();

  async getSnapshot(branchId?: string, allowedBranchIds?: string[]) {
    const store = await this.readStore();

    return {
      categories: this.collectCategories(store, branchId, allowedBranchIds),
      items: this.collectItems(store, branchId, allowedBranchIds),
      syncCursor: branchId
        ? (store.branches[branchId]?.updatedAt ?? store.lastUpdatedAt)
        : store.lastUpdatedAt,
    };
  }

  async getCategories(branchId?: string, allowedBranchIds?: string[]) {
    const store = await this.readStore();
    return this.collectCategories(store, branchId, allowedBranchIds);
  }

  async getItems(branchId?: string, allowedBranchIds?: string[]) {
    const store = await this.readStore();
    return this.collectItems(store, branchId, allowedBranchIds);
  }

  async replaceSnapshot(branchId: string, payload: ReplaceCatalogSnapshotDto) {
    const snapshot = await this.mutateStore((store) => {
      const categories = payload.categories.map((category) => ({
        ...category,
        branchId,
      }));
      const items = payload.items.map((item) => ({
        ...item,
        branchId,
      }));

      store.branches[branchId] = {
        categories,
        items,
        updatedAt: payload.syncCursor ?? new Date().toISOString(),
      };

      return {
        categories,
        items,
        syncCursor: store.branches[branchId].updatedAt,
      };
    });

    this.realtimeGateway.broadcastCatalogRefresh(branchId);
    return snapshot;
  }

  async resetSnapshot() {
    return this.mutateStore((store) => {
      const nextBranches = this.buildSeedBranches();
      store.branches = nextBranches;

      const branchEntries = Object.values(nextBranches);
      return {
        branchCount: Object.keys(nextBranches).length,
        categoryCount: branchEntries.reduce(
          (count, branch) => count + branch.categories.length,
          0,
        ),
        itemCount: branchEntries.reduce(
          (count, branch) => count + branch.items.length,
          0,
        ),
      };
    });
  }

  private collectCategories(
    store: CatalogStore,
    branchId?: string,
    allowedBranchIds?: string[],
  ) {
    if (branchId && branchId !== 'all') {
      return store.branches[branchId]?.categories ?? [];
    }

    return this.scopedBranchEntries(store, allowedBranchIds).flatMap(
      (branch) => branch.categories,
    );
  }

  private collectItems(
    store: CatalogStore,
    branchId?: string,
    allowedBranchIds?: string[],
  ) {
    if (branchId && branchId !== 'all') {
      return store.branches[branchId]?.items ?? [];
    }

    return this.scopedBranchEntries(store, allowedBranchIds).flatMap(
      (branch) => branch.items,
    );
  }

  private scopedBranchEntries(store: CatalogStore, allowedBranchIds?: string[]) {
    const entries = Object.entries(store.branches);
    if (!allowedBranchIds) {
      return entries.map(([, branch]) => branch);
    }

    const allowed = new Set(allowedBranchIds);
    return entries
      .filter(([branchId]) => allowed.has(branchId))
      .map(([, branch]) => branch);
  }

  private async mutateStore<T>(
    mutator: (store: CatalogStore) => Promise<T> | T,
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
    if (process.env.CATALOG_STORAGE_FILE) {
      return process.env.CATALOG_STORAGE_FILE;
    }

    const cwd = process.cwd();
    if (cwd.endsWith(join('apps', 'api-nestjs'))) {
      return join(cwd, 'storage', 'catalog-snapshot.json');
    }

    return join(cwd, 'apps', 'api-nestjs', 'storage', 'catalog-snapshot.json');
  }

  private async readStore(): Promise<CatalogStore> {
    await this.ensureStoreFile();
    const content = await readFile(this.storageFilePath, 'utf8');
    const parsed = JSON.parse(content) as Partial<CatalogStore>;

    return {
      version: 1,
      branches: parsed.branches ?? this.buildSeedBranches(),
      lastUpdatedAt: parsed.lastUpdatedAt ?? new Date().toISOString(),
    };
  }

  private async writeStore(store: CatalogStore) {
    await mkdir(dirname(this.storageFilePath), { recursive: true });
    const tempPath = `${this.storageFilePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    await rename(tempPath, this.storageFilePath);
  }

  private async ensureStoreFile() {
    try {
      await stat(this.storageFilePath);
    } catch {
      const seedStore: CatalogStore = {
        version: 1,
        branches: this.buildSeedBranches(),
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

  private buildSeedBranches() {
    const branchIds = new Set([
      ...catalogCategories.map((category) => category.branchId),
      ...catalogItems.map((item) => item.branchId),
    ]);

    return Object.fromEntries(
      Array.from(branchIds).map((branchId) => [
        branchId,
        {
          categories: catalogCategories.filter(
            (category) => category.branchId === branchId,
          ),
          items: catalogItems.filter((item) => item.branchId === branchId),
          updatedAt: new Date().toISOString(),
        },
      ]),
    );
  }
}
