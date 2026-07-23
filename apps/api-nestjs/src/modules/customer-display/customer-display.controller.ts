import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdir, open, unlink } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { TenantScopedRequest } from '../../common/guards/branch-access.guard';
import { CustomerDisplayService } from './customer-display.service';
import { UpdateCustomerDisplaySettingsDto } from './dto/update-customer-display-settings.dto';

type UploadedMediaFile = {
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
};

const customerDisplayMediaRootPath = resolveCustomerDisplayMediaRootPath();

function resolveCustomerDisplayMediaRootPath() {
  if (process.env.CUSTOMER_DISPLAY_MEDIA_ROOT) {
    return process.env.CUSTOMER_DISPLAY_MEDIA_ROOT;
  }

  const cwd = process.cwd();
  if (cwd.endsWith(join('apps', 'api-nestjs'))) {
    return join(cwd, 'storage', 'customer-display-media');
  }

  return join(cwd, 'apps', 'api-nestjs', 'storage', 'customer-display-media');
}

function sanitizeSegment(value: string) {
  return value.replace(/[^a-z0-9-_]/gi, '-');
}

async function ensureBranchMediaDirectory(branchId: string) {
  const directory = join(
    customerDisplayMediaRootPath,
    sanitizeSegment(branchId),
  );
  await mkdir(directory, { recursive: true });
  return directory;
}

function createUploadFileName(originalName: string) {
  return `${Date.now()}-${randomUUID()}${extname(originalName).toLowerCase()}`;
}

function validateCustomerDisplayUpload(file: UploadedMediaFile) {
  const mimeType = file.mimetype.toLowerCase();
  const extension = extname(file.originalname).toLowerCase();
  const allowedTypes = new Map<string, Set<string>>([
    ['.jpg', new Set(['image/jpeg'])],
    ['.jpeg', new Set(['image/jpeg'])],
    ['.png', new Set(['image/png'])],
    ['.gif', new Set(['image/gif'])],
    ['.webp', new Set(['image/webp'])],
    ['.mp4', new Set(['video/mp4'])],
    ['.webm', new Set(['video/webm'])],
  ]);
  if (allowedTypes.get(extension)?.has(mimeType)) {
    return;
  }

  throw new BadRequestException(`Unsupported media file: ${file.originalname}`);
}

async function validateUploadedFileContents(file: UploadedMediaFile) {
  const extension = extname(file.originalname).toLowerCase();
  const handle = await open(file.path, 'r');
  try {
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const bytes = header.subarray(0, bytesRead);
    const ascii = bytes.toString('ascii');
    const valid =
      ((extension === '.jpg' || extension === '.jpeg') &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff) ||
      (extension === '.png' &&
        bytes
          .subarray(0, 8)
          .equals(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          )) ||
      (extension === '.gif' &&
        ['GIF87a', 'GIF89a'].includes(ascii.slice(0, 6))) ||
      (extension === '.webp' &&
        ascii.slice(0, 4) === 'RIFF' &&
        ascii.slice(8, 12) === 'WEBP') ||
      (extension === '.mp4' && ascii.slice(4, 8) === 'ftyp') ||
      (extension === '.webm' &&
        bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])));

    if (!valid) {
      throw new BadRequestException(
        `File contents do not match the declared media type: ${file.originalname}`,
      );
    }
  } finally {
    await handle.close();
  }
}

async function removeUploadedFiles(files: UploadedMediaFile[]) {
  await Promise.all(
    files.map((file) => unlink(file.path).catch(() => undefined)),
  );
}

@Controller('customer-display')
@Roles('ADMIN', 'SUPERVISOR', 'CASHIER')
export class CustomerDisplayController {
  constructor(
    private readonly customerDisplayService: CustomerDisplayService,
  ) {}

  @Get('settings')
  async getSettings(
    @Query('branchId') branchId: string | undefined,
    @Req() request: Request & TenantScopedRequest,
  ) {
    const resolvedBranchId = branchId ?? request.user!.branchId;
    const settings =
      await this.customerDisplayService.getSettings(resolvedBranchId);
    return this.presentSettings(resolvedBranchId, settings, request);
  }

  @Put('settings/:branchId')
  @Roles('ADMIN', 'SUPERVISOR')
  async updateSettings(
    @Param('branchId') branchId: string,
    @Body() payload: UpdateCustomerDisplaySettingsDto,
    @Req() request: Request,
  ) {
    const settings = await this.customerDisplayService.updateSettings(
      branchId,
      payload,
    );
    return this.presentSettings(branchId, settings, request);
  }

  @Post('assets/:branchId')
  @Roles('ADMIN', 'SUPERVISOR')
  @UseInterceptors(
    FilesInterceptor('files', 6, {
      storage: multer.diskStorage({
        destination: (
          request: Request,
          _file: UploadedMediaFile,
          callback: (error: Error | null, destination: string) => void,
        ) => {
          const branchId =
            typeof request.params.branchId === 'string'
              ? request.params.branchId
              : 'branch-manila';
          void ensureBranchMediaDirectory(branchId)
            .then((directory) => callback(null, directory))
            .catch((error: Error) => callback(error, ''));
        },
        filename: (
          _request: Request,
          file: UploadedMediaFile,
          callback: (error: Error | null, filename: string) => void,
        ) => {
          callback(null, createUploadFileName(file.originalname));
        },
      }),
      fileFilter: (
        _request: Request,
        file: UploadedMediaFile,
        callback: (error: Error | null, acceptFile: boolean) => void,
      ) => {
        try {
          validateCustomerDisplayUpload(file);
          callback(null, true);
        } catch (error) {
          callback(error as Error, false);
        }
      },
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
    }),
  )
  async uploadAssets(
    @Param('branchId') branchId: string,
    @UploadedFiles() files: UploadedMediaFile[],
    @Req() request: Request,
  ) {
    if (!files?.length) {
      throw new BadRequestException('Select at least one image or video.');
    }

    try {
      await Promise.all(files.map(validateUploadedFileContents));
    } catch (error) {
      await removeUploadedFiles(files);
      throw error;
    }

    const settings = await this.customerDisplayService.uploadAssets(
      branchId,
      files,
    );
    return this.presentSettings(branchId, settings, request);
  }

  @Get('media/:branchId/:assetId')
  @Public()
  async getMedia(
    @Param('branchId') branchId: string,
    @Param('assetId') assetId: string,
    @Res() response: Response,
  ) {
    const resolved = await this.customerDisplayService.resolveAssetFile(
      branchId,
      assetId,
    );

    response.type(resolved.asset.mimeType || extname(resolved.asset.fileName));
    response.set({
      'Cache-Control': 'public, max-age=3600, immutable',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    });
    return response.sendFile(resolved.absolutePath);
  }

  private presentSettings(
    branchId: string,
    settings: Awaited<ReturnType<CustomerDisplayService['getSettings']>>,
    request: Request,
  ) {
    return {
      branchId,
      thankYouMessage: settings.thankYouMessage,
      launchFullscreen: settings.launchFullscreen,
      imageDurationSeconds: settings.imageDurationSeconds,
      assets: settings.assets.map((asset) => ({
        ...asset,
        url: this.buildMediaUrl(request, branchId, asset.id),
      })),
      updatedAt: settings.updatedAt,
    };
  }

  private buildMediaUrl(request: Request, branchId: string, assetId: string) {
    return `${request.protocol}://${request.get('host')}/api/customer-display/media/${encodeURIComponent(branchId)}/${encodeURIComponent(assetId)}`;
  }
}
