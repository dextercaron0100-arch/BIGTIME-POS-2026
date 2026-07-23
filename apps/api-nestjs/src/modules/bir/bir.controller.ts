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
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import type { TenantScopedRequest } from '../../common/guards/branch-access.guard';
import { BirService } from './bir.service';
import { GenerateZReadingDto } from './dto/generate-z-reading.dto';
import { ReadingSummaryQueryDto } from './dto/reading-summary-query.dto';
import { UpdateBirSettingsDto } from './dto/update-bir-settings.dto';

@Controller('bir')
@Roles('ADMIN', 'AUDITOR')
export class BirController {
  constructor(private readonly birService: BirService) {}

  @Get('settings')
  @Roles('ADMIN', 'SUPERVISOR', 'CASHIER', 'AUDITOR')
  getSettings(
    @Query('branchId') branchId: string | undefined,
    @Req() request: TenantScopedRequest,
  ) {
    return this.birService.getSettings(
      branchId ?? request.user!.branchId,
      request.tenantBranchIds,
    );
  }

  @Put('settings/:branchId')
  @Roles('ADMIN', 'SUPERVISOR')
  updateSettings(
    @Param('branchId') branchId: string,
    @Body() payload: UpdateBirSettingsDto,
    @Req() request: TenantScopedRequest,
  ) {
    return this.birService.updateSettings(
      branchId,
      payload,
      request.tenantBranchIds,
    );
  }

  @Get('z-readings')
  getReadings(
    @Query('terminalId') terminalId?: string,
    @Query('date') date?: string,
    @Req() request?: TenantScopedRequest,
  ) {
    return this.birService.listReadings(
      terminalId,
      date,
      request?.tenantBranchIds,
    );
  }

  @Get('x-reading')
  getXReading(
    @Query() query: ReadingSummaryQueryDto,
    @Req() request: TenantScopedRequest,
  ) {
    return this.birService.getXReading(query, request.tenantBranchIds);
  }

  @Get('z-summary')
  getZSummary(
    @Query() query: ReadingSummaryQueryDto,
    @Req() request: TenantScopedRequest,
  ) {
    return this.birService.getZReadingSummary(query, request.tenantBranchIds);
  }

  @Post('z-readings/generate')
  @Roles('ADMIN')
  generateReading(
    @Body() payload: GenerateZReadingDto,
    @Req() request: TenantScopedRequest,
  ) {
    return this.birService.generateZReading(payload, request.tenantBranchIds);
  }

  @Get('eis/submissions')
  listEisSubmissions(
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() request?: TenantScopedRequest,
  ) {
    return this.birService.listEisSubmissions(
      {
        branchId,
        status,
        page,
        pageSize,
      },
      request?.tenantBranchIds,
    );
  }

  @Get('eis/summary')
  getEisSummary(
    @Query('branchId') branchId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Req() request?: TenantScopedRequest,
  ) {
    return this.birService.getEisSummary(
      {
        branchId,
        fromDate,
        toDate,
      },
      request?.tenantBranchIds,
    );
  }

  @Post('eis/flush')
  @Roles('ADMIN')
  flushEisQueue(
    @Body()
    payload?: {
      branchId?: string;
      maxItems?: number;
    },
    @Req() request?: TenantScopedRequest,
  ) {
    return this.birService.flushEisQueue(payload, request?.tenantBranchIds);
  }

  @Post('eis/retry')
  @Roles('ADMIN')
  retryEisSubmission(
    @Body()
    payload?: {
      submissionId?: string;
    },
    @Req() request?: TenantScopedRequest,
  ) {
    const submissionId = payload?.submissionId?.trim();
    if (!submissionId) {
      throw new BadRequestException('submissionId is required.');
    }
    return this.birService.retryEisSubmission(
      submissionId,
      request?.tenantBranchIds,
    );
  }
}
