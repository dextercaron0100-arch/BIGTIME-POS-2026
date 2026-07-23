import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { UpdateCustomerDisplaySettingsDto } from './dto/update-customer-display-settings.dto';

type UploadedMediaFile = {
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
};

export type StoredCustomerDisplayAsset = {
  id: string;
  fileName: string;
  kind: 'image' | 'video';
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
};

export type StoredCustomerDisplaySettings = {
  thankYouMessage: string;
  launchFullscreen: boolean;
  imageDurationSeconds: number;
  assets: StoredCustomerDisplayAsset[];
  updatedAt: string;
};

type CustomerDisplayStore = {
  version: 1;
  branches: Record<string, StoredCustomerDisplaySettings>;
  lastUpdatedAt: string;
};

const defaultThankYouMessage = 'Thank you for your purchase';

@Injectable()
export class CustomerDisplayService {
  private readonly storageFilePath = this.resolveStorageFilePath();
  private readonly mediaRootPath = this.resolveMediaRootPath();
  private writeQueue = Promise.resolve();

  async getSettings(branchId: string) {
    const store = await this.readStore();
    return store.branches[branchId] ?? this.buildDefaultSettings();
  }

  async updateSettings(
    branchId: string,
    payload: UpdateCustomerDisplaySettingsDto,
  ) {
    return this.mutateStore(async (store) => {
      const current = this.ensureBranchSettings(store, branchId);
      const assetIds = Array.from(
        new Set(
          payload.assetIds.map((assetId) => assetId.trim()).filter(Boolean),
        ),
      );
      const keptAssets = assetIds
        .map((assetId) => current.assets.find((asset) => asset.id === assetId))
        .filter((asset): asset is StoredCustomerDisplayAsset => asset != null);
      const removedAssets = current.assets.filter(
        (asset) => !assetIds.includes(asset.id),
      );

      await Promise.all(
        removedAssets.map((asset) => this.deleteMediaFile(asset.relativePath)),
      );

      const nextSettings: StoredCustomerDisplaySettings = {
        thankYouMessage:
          payload.thankYouMessage.trim() || defaultThankYouMessage,
        launchFullscreen: payload.launchFullscreen,
        imageDurationSeconds: payload.imageDurationSeconds,
        assets: keptAssets,
        updatedAt: new Date().toISOString(),
      };

      store.branches[branchId] = nextSettings;
      return nextSettings;
    });
  }

  async uploadAssets(branchId: string, files: UploadedMediaFile[]) {
    if (files.length == 0) {
      throw new BadRequestException('Select at least one image or video.');
    }

    return this.mutateStore((store) => {
      const current = this.ensureBranchSettings(store, branchId);
      const uploadedAt = new Date().toISOString();
      const uploadedAssets = files.map((file) => ({
        id: `cfd-${randomUUID()}`,
        fileName: file.originalname,
        kind: this.kindForUpload(file),
        relativePath: this.toRelativeMediaPath(file.path),
        mimeType: this.canonicalMimeType(file.originalname),
        sizeBytes: file.size,
        uploadedAt,
      }));

      const nextSettings: StoredCustomerDisplaySettings = {
        ...current,
        assets: [...current.assets, ...uploadedAssets],
        updatedAt: uploadedAt,
      };

      store.branches[branchId] = nextSettings;
      return nextSettings;
    });
  }

  async resolveAssetFile(branchId: string, assetId: string) {
    const settings = await this.getSettings(branchId);
    const asset = settings.assets.find((candidate) => candidate.id === assetId);

    if (!asset) {
      throw new NotFoundException('Customer display media was not found.');
    }

    const absolutePath = resolve(this.mediaRootPath, asset.relativePath);
    const mediaRoot = `${resolve(this.mediaRootPath)}${process.platform === 'win32' ? '\\' : '/'}`;
    if (!absolutePath.startsWith(mediaRoot)) {
      throw new NotFoundException('Customer display media was not found.');
    }

    return {
      asset,
      absolutePath,
    };
  }

  async ensureBranchMediaDirectory(branchId: string) {
    const directory = join(this.mediaRootPath, this.sanitizeSegment(branchId));
    await mkdir(directory, { recursive: true });
    return directory;
  }

  createUploadFileName(originalName: string) {
    const extension = extname(originalName).toLowerCase();
    return `${Date.now()}-${randomUUID()}${extension}`;
  }

  validateUpload(file: UploadedMediaFile) {
    return this.kindForUpload(file);
  }

  private kindForUpload(file: UploadedMediaFile): 'image' | 'video' {
    const mimeType = file.mimetype.toLowerCase();
    const extension = extname(file.originalname).toLowerCase();

    if (
      ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(
        mimeType,
      ) &&
      ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extension)
    ) {
      return 'image';
    }

    if (
      ['video/mp4', 'video/webm'].includes(mimeType) &&
      ['.mp4', '.webm'].includes(extension)
    ) {
      return 'video';
    }

    throw new BadRequestException(
      `Unsupported media file: ${file.originalname}`,
    );
  }

  private canonicalMimeType(fileName: string) {
    switch (extname(fileName).toLowerCase()) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      case '.mp4':
        return 'video/mp4';
      case '.webm':
        return 'video/webm';
      default:
        return 'application/octet-stream';
    }
  }

  private ensureBranchSettings(store: CustomerDisplayStore, branchId: string) {
    return store.branches[branchId] ?? this.buildDefaultSettings();
  }

  private buildDefaultSettings(): StoredCustomerDisplaySettings {
    return {
      thankYouMessage: defaultThankYouMessage,
      launchFullscreen: true,
      imageDurationSeconds: 7,
      assets: [],
      updatedAt: new Date().toISOString(),
    };
  }

  private toRelativeMediaPath(absolutePath: string) {
    return relative(this.mediaRootPath, absolutePath).replaceAll('\\', '/');
  }

  private async deleteMediaFile(relativePath: string) {
    try {
      await unlink(join(this.mediaRootPath, relativePath));
    } catch {
      return;
    }
  }

  private async mutateStore<T>(
    mutator: (store: CustomerDisplayStore) => Promise<T> | T,
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
    if (process.env.CUSTOMER_DISPLAY_STORAGE_FILE) {
      return process.env.CUSTOMER_DISPLAY_STORAGE_FILE;
    }

    const cwd = process.cwd();
    if (cwd.endsWith(join('apps', 'api-nestjs'))) {
      return join(cwd, 'storage', 'customer-display-settings.json');
    }

    return join(
      cwd,
      'apps',
      'api-nestjs',
      'storage',
      'customer-display-settings.json',
    );
  }

  private resolveMediaRootPath() {
    if (process.env.CUSTOMER_DISPLAY_MEDIA_ROOT) {
      return process.env.CUSTOMER_DISPLAY_MEDIA_ROOT;
    }

    const cwd = process.cwd();
    if (cwd.endsWith(join('apps', 'api-nestjs'))) {
      return join(cwd, 'storage', 'customer-display-media');
    }

    return join(cwd, 'apps', 'api-nestjs', 'storage', 'customer-display-media');
  }

  private async readStore(): Promise<CustomerDisplayStore> {
    await this.ensureStoreFile();
    const content = await readFile(this.storageFilePath, 'utf8');
    const parsed = JSON.parse(content) as Partial<CustomerDisplayStore>;

    return {
      version: 1,
      branches: parsed.branches ?? {},
      lastUpdatedAt: parsed.lastUpdatedAt ?? new Date().toISOString(),
    };
  }

  private async writeStore(store: CustomerDisplayStore) {
    await mkdir(dirname(this.storageFilePath), { recursive: true });
    const tempPath = `${this.storageFilePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    await rename(tempPath, this.storageFilePath);
  }

  private async ensureStoreFile() {
    try {
      await stat(this.storageFilePath);
    } catch {
      const seedStore: CustomerDisplayStore = {
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

  private sanitizeSegment(value: string) {
    return value.replace(/[^a-z0-9-_]/gi, '-');
  }
}
