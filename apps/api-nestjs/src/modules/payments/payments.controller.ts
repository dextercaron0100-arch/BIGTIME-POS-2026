import { Body, Controller, Get, Param, Put, Query, Req } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import type { TenantScopedRequest } from '../../common/guards/branch-access.guard';
import { PaymentsService } from './payments.service';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto';

@Controller('payments')
@Roles('ADMIN', 'SUPERVISOR', 'CASHIER', 'AUDITOR')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('methods')
  getMethods(
    @Query('branchId') branchId: string | undefined,
    @Req() request: TenantScopedRequest,
  ) {
    return this.paymentsService.getMethods(
      branchId ?? request.user!.branchId,
      request.tenantBranchIds,
    );
  }

  @Get('settings')
  getSettings(
    @Query('branchId') branchId: string | undefined,
    @Req() request: TenantScopedRequest,
  ) {
    return this.paymentsService.getSettings(
      branchId ?? request.user!.branchId,
      request.tenantBranchIds,
    );
  }

  @Put('settings/:branchId')
  @Roles('ADMIN', 'SUPERVISOR')
  updateSettings(
    @Param('branchId') branchId: string,
    @Body() payload: UpdatePaymentSettingsDto,
    @Req() request: TenantScopedRequest,
  ) {
    return this.paymentsService.updateSettings(
      branchId,
      payload,
      request.tenantBranchIds,
    );
  }
}
