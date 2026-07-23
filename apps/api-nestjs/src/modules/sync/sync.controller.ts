import { Body, Controller, Post, Req } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import type { TenantScopedRequest } from '../../common/guards/branch-access.guard';
import { CreateSyncBatchDto } from './dto/create-sync-batch.dto';
import { SyncService } from './sync.service';

@Controller('sync')
@Roles('ADMIN', 'SUPERVISOR', 'CASHIER')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('batch')
  async processBatch(
    @Body() payload: CreateSyncBatchDto,
    @Req() request: TenantScopedRequest,
  ) {
    return this.syncService.processBatch(payload, request.tenantBranchIds);
  }
}
