import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import type { TenantScopedRequest } from '../../common/guards/branch-access.guard';
import { GenerateEndOfDayReportDto } from './dto/generate-end-of-day-report.dto';
import { ReportsService } from './reports.service';
import { SalesSummaryQueryDto } from './dto/sales-summary-query.dto';

@Controller('reports')
@Roles('ADMIN', 'SUPERVISOR', 'AUDITOR')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales-trend')
  getSalesTrend(@Req() request: TenantScopedRequest) {
    return this.reportsService.getSalesTrend(request.tenantBranchIds);
  }

  @Get('branch-comparison')
  getBranchComparison(@Req() request: TenantScopedRequest) {
    return this.reportsService.getBranchComparison(request.tenantBranchIds);
  }

  @Get('queue-blueprint')
  @Roles('ADMIN')
  getQueueBlueprint() {
    return this.reportsService.getQueueBlueprint();
  }

  @Get('cash-balancing')
  getCashBalancing(
    @Query('branchId') branchId: string | undefined,
    @Req() request: TenantScopedRequest,
  ) {
    return this.reportsService.getCashBalancing(
      branchId,
      request.tenantBranchIds,
    );
  }

  @Get('sales-summary')
  getSalesSummary(
    @Query() query: SalesSummaryQueryDto,
    @Req() request: TenantScopedRequest,
  ) {
    return this.reportsService.getSalesSummary(query, request.tenantBranchIds);
  }

  @Get('end-of-day')
  getEndOfDayReport(
    @Query() query: SalesSummaryQueryDto,
    @Req() request: TenantScopedRequest,
  ) {
    return this.reportsService.getEndOfDayReport(
      query,
      request.tenantBranchIds,
    );
  }

  @Post('end-of-day/generate')
  @Roles('ADMIN', 'SUPERVISOR')
  generateEndOfDayReport(
    @Body() payload: GenerateEndOfDayReportDto,
    @Req() request: TenantScopedRequest,
  ) {
    return this.reportsService.generateEndOfDayReport(
      payload,
      request.tenantBranchIds,
    );
  }
}
