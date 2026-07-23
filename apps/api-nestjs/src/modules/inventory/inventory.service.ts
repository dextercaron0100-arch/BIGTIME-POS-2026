import type { InventorySummary } from '@apex-pos/shared-types';
import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { inventorySummaries } from '../../data/mock-data';
import {
  assertBranchAllowed,
  isBranchAllowed,
} from '../../common/auth/branch-scope';
import {
  type CreateStockAdjustmentDto,
  type InventoryAdjustmentAction,
} from './dto/create-stock-adjustment.dto';
import {
  type ImportStockSheetDto,
  type ImportStockSheetRowDto,
} from './dto/import-stock-sheet.dto';

type StoredInventoryRow = InventorySummary & {
  itemId?: string;
  updatedAt: string;
};

type InventoryAdjustmentRecord = {
  id: string;
  branchId: string;
  stockRowId: string;
  itemId?: string;
  itemName: string;
  warehouseName: string;
  action: InventoryAdjustmentAction;
  quantity: number;
  previousQuantity: number;
  nextQuantity: number;
  reorderPoint: number;
  reason?: string;
  createdAt: string;
};

export type { InventoryAdjustmentRecord };

type InventoryStore = {
  version: 1;
  rows: StoredInventoryRow[];
  adjustments: InventoryAdjustmentRecord[];
  lastUpdatedAt: string;
};

@Injectable()
export class InventoryService {
  private readonly storageFilePath = this.resolveStorageFilePath();
  private writeQueue = Promise.resolve();

  getStockLevels(branchId?: string, allowedBranchIds?: string[]) {
    return this.listStockLevels(branchId, allowedBranchIds);
  }

  getMovementRules() {
    return {
      appendOnly: true,
      derivedStockPolicy:
        'Current stock is derived from movements. Manual stock balance updates should create adjustment movements.',
      pullOutRequiresSupervisorPin: true,
    };
  }

  async getAdjustments(branchId?: string, allowedBranchIds?: string[]) {
    const store = await this.readStore();
    const normalizedBranchId = branchId?.trim().toLowerCase();
    if (normalizedBranchId) {
      assertBranchAllowed(normalizedBranchId, allowedBranchIds);
    }
    const adjustments = store.adjustments.filter(
      (adjustment) =>
        (!normalizedBranchId || adjustment.branchId === normalizedBranchId) &&
        isBranchAllowed(adjustment.branchId, allowedBranchIds),
    );
    return [...adjustments].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  async createAdjustment(
    payload: CreateStockAdjustmentDto,
    allowedBranchIds?: string[],
  ) {
    const branchId = assertBranchAllowed(payload.branchId, allowedBranchIds);
    const itemId = payload.itemId?.trim() || undefined;
    const itemName = payload.itemName.trim();
    const warehouseName = payload.warehouseName.trim();
    const reason = payload.reason?.trim() || undefined;

    if (itemName.length < 2) {
      throw new BadRequestException('Item name must be at least 2 characters.');
    }

    if (warehouseName.length < 2) {
      throw new BadRequestException(
        'Warehouse name must be at least 2 characters.',
      );
    }

    if (payload.action === 'STOCK_IN' && payload.quantity < 1) {
      throw new BadRequestException(
        'Stock in quantity must be at least 1 unit.',
      );
    }

    return this.mutateStore((store) => {
      return this.applyStockChange(store, {
        branchId,
        itemId,
        itemName,
        warehouseName,
        action: payload.action,
        quantity: payload.quantity,
        reorderPoint: payload.reorderPoint,
        reason,
      }).row;
    });
  }

  async importStockSheet(
    payload: ImportStockSheetDto,
    allowedBranchIds?: string[],
  ) {
    const branchId = assertBranchAllowed(payload.branchId, allowedBranchIds);
    const sourceFileName = payload.sourceFileName?.trim() || undefined;

    return this.mutateStore((store) => {
      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      payload.rows.forEach((row, index) => {
        const normalizedRow = this.normalizeImportRow(
          row,
          branchId,
          store,
          index,
        );
        const result = this.applyStockChange(store, {
          branchId,
          itemId: normalizedRow.itemId,
          itemName: normalizedRow.itemName,
          warehouseName: normalizedRow.warehouseName,
          action: 'SET_BALANCE',
          quantity: normalizedRow.quantityOnHand,
          reorderPoint: normalizedRow.reorderPoint,
          reason: sourceFileName
            ? `Imported from ${sourceFileName}`
            : 'Imported stock sheet',
        });

        if (result.created) {
          createdCount += 1;
          return;
        }

        if (result.changed) {
          updatedCount += 1;
          return;
        }

        skippedCount += 1;
      });

      return {
        branchId,
        importedCount: payload.rows.length,
        createdCount,
        updatedCount,
        skippedCount,
      };
    });
  }

  private normalizeImportRow(
    row: ImportStockSheetRowDto,
    branchId: string,
    store: InventoryStore,
    index: number,
  ) {
    const itemId = row.itemId?.trim() || undefined;
    const itemName = row.itemName.trim();
    const warehouseName = row.warehouseName.trim();

    if (itemName.length < 2) {
      throw new BadRequestException(
        `Row ${index + 2}: Item name must be at least 2 characters.`,
      );
    }

    if (warehouseName.length < 2) {
      throw new BadRequestException(
        `Row ${index + 2}: Warehouse name must be at least 2 characters.`,
      );
    }

    const matchingRow = store.rows.find((candidate) =>
      this.isSameStockRow(candidate, {
        branchId,
        itemId,
        itemName,
        warehouseName,
      }),
    );
    const reorderPoint = row.reorderPoint ?? matchingRow?.reorderPoint ?? 10;

    return {
      itemId,
      itemName,
      warehouseName,
      quantityOnHand: row.quantityOnHand,
      reorderPoint,
    };
  }

  private applyStockChange(
    store: InventoryStore,
    payload: {
      branchId: string;
      itemId?: string;
      itemName: string;
      warehouseName: string;
      action: InventoryAdjustmentAction;
      quantity: number;
      reorderPoint: number;
      reason?: string;
    },
  ) {
    const matchingRow = store.rows.find((row) =>
      this.isSameStockRow(row, {
        branchId: payload.branchId,
        itemId: payload.itemId,
        itemName: payload.itemName,
        warehouseName: payload.warehouseName,
      }),
    );
    const previousQuantity = matchingRow?.quantityOnHand ?? 0;
    const previousReorderPoint =
      matchingRow?.reorderPoint ?? payload.reorderPoint;
    const previousItemId = matchingRow?.itemId;
    const previousItemName = matchingRow?.itemName ?? payload.itemName;
    const previousWarehouseName =
      matchingRow?.warehouseName ?? payload.warehouseName;
    const nextQuantity =
      payload.action === 'SET_BALANCE'
        ? payload.quantity
        : previousQuantity + payload.quantity;
    const updatedAt = new Date().toISOString();

    const row: StoredInventoryRow =
      matchingRow ??
      ({
        id: `stock-${randomUUID()}`,
        branchId: payload.branchId,
        itemName: payload.itemName,
        warehouseName: payload.warehouseName,
        quantityOnHand: 0,
        reorderPoint: payload.reorderPoint,
        status: 'HEALTHY',
        updatedAt,
      } satisfies StoredInventoryRow);

    row.itemId = payload.itemId ?? row.itemId;
    row.itemName = payload.itemName;
    row.warehouseName = payload.warehouseName;
    row.quantityOnHand = nextQuantity;
    row.reorderPoint = payload.reorderPoint;
    row.status = this.computeStatus(nextQuantity, payload.reorderPoint);
    row.updatedAt = updatedAt;

    if (!matchingRow) {
      store.rows.push(row);
    }

    const changed =
      !matchingRow ||
      previousQuantity !== nextQuantity ||
      previousReorderPoint !== payload.reorderPoint ||
      previousItemId !== row.itemId ||
      previousItemName !== row.itemName ||
      previousWarehouseName !== row.warehouseName;

    if (
      !matchingRow ||
      previousQuantity !== nextQuantity ||
      previousReorderPoint !== payload.reorderPoint
    ) {
      store.adjustments.unshift({
        id: `stock-adjustment-${randomUUID()}`,
        branchId: payload.branchId,
        stockRowId: row.id,
        itemId: row.itemId,
        itemName: row.itemName,
        warehouseName: row.warehouseName,
        action: payload.action,
        quantity: payload.quantity,
        previousQuantity,
        nextQuantity,
        reorderPoint: row.reorderPoint,
        reason: payload.reason,
        createdAt: updatedAt,
      });
      store.adjustments = store.adjustments.slice(0, 1000);
    }

    return {
      row: this.toSummary(row),
      created: !matchingRow,
      changed,
    };
  }

  private async listStockLevels(
    branchId?: string,
    allowedBranchIds?: string[],
  ) {
    const store = await this.readStore();
    const normalizedBranchId = branchId?.trim().toLowerCase();
    if (normalizedBranchId) {
      assertBranchAllowed(normalizedBranchId, allowedBranchIds);
    }
    const rows = store.rows.filter(
      (row) =>
        (!normalizedBranchId || row.branchId === normalizedBranchId) &&
        isBranchAllowed(row.branchId, allowedBranchIds),
    );

    return [...rows]
      .sort((left, right) => {
        const branchDelta = left.branchId.localeCompare(right.branchId);
        if (branchDelta !== 0) {
          return branchDelta;
        }

        const warehouseDelta = left.warehouseName.localeCompare(
          right.warehouseName,
        );
        if (warehouseDelta !== 0) {
          return warehouseDelta;
        }

        return left.itemName.localeCompare(right.itemName);
      })
      .map((row) => this.toSummary(row));
  }

  private isSameStockRow(
    row: StoredInventoryRow,
    candidate: {
      branchId: string;
      itemId?: string;
      itemName: string;
      warehouseName: string;
    },
  ) {
    const sameBranch = row.branchId === candidate.branchId;
    const sameWarehouse =
      row.warehouseName.trim().toLowerCase() ===
      candidate.warehouseName.trim().toLowerCase();

    if (!sameBranch || !sameWarehouse) {
      return false;
    }

    if (candidate.itemId && row.itemId) {
      return row.itemId.trim().toLowerCase() === candidate.itemId.toLowerCase();
    }

    return (
      row.itemName.trim().toLowerCase() ===
      candidate.itemName.trim().toLowerCase()
    );
  }

  private computeStatus(quantityOnHand: number, reorderPoint: number) {
    if (quantityOnHand <= 0) {
      return 'OUT' as const;
    }

    if (quantityOnHand <= reorderPoint) {
      return 'LOW' as const;
    }

    return 'HEALTHY' as const;
  }

  private toSummary(row: StoredInventoryRow): InventorySummary {
    return {
      id: row.id,
      branchId: row.branchId,
      itemName: row.itemName,
      warehouseName: row.warehouseName,
      quantityOnHand: row.quantityOnHand,
      reorderPoint: row.reorderPoint,
      status: row.status,
    };
  }

  private async mutateStore<T>(
    mutator: (store: InventoryStore) => Promise<T> | T,
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
    if (process.env.INVENTORY_STORAGE_FILE) {
      return process.env.INVENTORY_STORAGE_FILE;
    }

    const cwd = process.cwd();
    if (cwd.endsWith(join('apps', 'api-nestjs'))) {
      return join(cwd, 'storage', 'inventory-stocks.json');
    }

    return join(cwd, 'apps', 'api-nestjs', 'storage', 'inventory-stocks.json');
  }

  private async readStore(): Promise<InventoryStore> {
    await this.ensureStoreFile();
    const content = await readFile(this.storageFilePath, 'utf8');
    const parsed = JSON.parse(content) as Partial<InventoryStore>;

    return {
      version: 1,
      rows: Array.isArray(parsed.rows) ? parsed.rows : this.buildSeedRows(),
      adjustments: Array.isArray(parsed.adjustments) ? parsed.adjustments : [],
      lastUpdatedAt: parsed.lastUpdatedAt ?? new Date().toISOString(),
    };
  }

  private async writeStore(store: InventoryStore) {
    await mkdir(dirname(this.storageFilePath), { recursive: true });
    const tempPath = `${this.storageFilePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    await rename(tempPath, this.storageFilePath);
  }

  private async ensureStoreFile() {
    try {
      await stat(this.storageFilePath);
    } catch {
      const seedStore: InventoryStore = {
        version: 1,
        rows: this.buildSeedRows(),
        adjustments: [],
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

  private buildSeedRows(): StoredInventoryRow[] {
    const updatedAt = new Date().toISOString();
    return inventorySummaries.map((row) => ({
      ...row,
      updatedAt,
    }));
  }
}
