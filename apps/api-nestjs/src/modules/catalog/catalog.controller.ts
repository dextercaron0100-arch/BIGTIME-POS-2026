import { Body, Controller, Get, Param, Put, Query, Req } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import type { TenantScopedRequest } from '../../common/guards/branch-access.guard';
import { CatalogService } from './catalog.service';
import { ReplaceCatalogSnapshotDto } from './dto/replace-catalog-snapshot.dto';

@Controller('catalog')
@Roles('ADMIN', 'SUPERVISOR', 'CASHIER', 'INVENTORY', 'AUDITOR')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('snapshot')
  async getSnapshot(
    @Query('branchId') branchId: string | undefined,
    @Req() request: TenantScopedRequest,
  ) {
    return this.catalogService.getSnapshot(branchId, request.tenantBranchIds);
  }

  @Put('snapshot/:branchId')
  @Roles('ADMIN', 'SUPERVISOR', 'INVENTORY', 'CASHIER')
  async replaceSnapshot(
    @Param('branchId') branchId: string,
    @Body() payload: ReplaceCatalogSnapshotDto,
  ) {
    return this.catalogService.replaceSnapshot(branchId, payload);
  }

  @Get('items')
  async getItems(
    @Query('branchId') branchId: string | undefined,
    @Req() request: TenantScopedRequest,
  ) {
    return this.catalogService.getItems(branchId, request.tenantBranchIds);
  }
}
