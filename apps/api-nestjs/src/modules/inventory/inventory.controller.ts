import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import type { TenantScopedRequest } from '../../common/guards/branch-access.guard';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { ImportStockSheetDto } from './dto/import-stock-sheet.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@Roles('ADMIN', 'SUPERVISOR', 'INVENTORY', 'AUDITOR')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('stocks')
  getStocks(
    @Query('branchId') branchId: string | undefined,
    @Req() request: TenantScopedRequest,
  ) {
    return this.inventoryService.getStockLevels(
      branchId,
      request.tenantBranchIds,
    );
  }

  @Get('adjustments')
  getAdjustments(
    @Query('branchId') branchId: string | undefined,
    @Req() request: TenantScopedRequest,
  ) {
    return this.inventoryService.getAdjustments(
      branchId,
      request.tenantBranchIds,
    );
  }

  @Get('movement-rules')
  getMovementRules() {
    return this.inventoryService.getMovementRules();
  }

  @Post('adjustments')
  @Roles('ADMIN', 'SUPERVISOR', 'INVENTORY')
  createAdjustment(
    @Body() payload: CreateStockAdjustmentDto,
    @Req() request: TenantScopedRequest,
  ) {
    return this.inventoryService.createAdjustment(
      payload,
      request.tenantBranchIds,
    );
  }

  @Post('stocks/import')
  @Roles('ADMIN', 'SUPERVISOR', 'INVENTORY')
  importStockSheet(
    @Body() payload: ImportStockSheetDto,
    @Req() request: TenantScopedRequest,
  ) {
    return this.inventoryService.importStockSheet(
      payload,
      request.tenantBranchIds,
    );
  }
}
