import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import type { TenantScopedRequest } from '../../common/guards/branch-access.guard';
import { AuditQueryDto } from './dto/audit-query.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { RefundTransactionDto } from './dto/refund-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { UpdateTerminalSettingsDto } from './dto/update-terminal-settings.dto';
import { VoidTransactionDto } from './dto/void-transaction.dto';
import { PosService } from './pos.service';

@Controller('pos')
@Roles('ADMIN', 'SUPERVISOR', 'CASHIER', 'AUDITOR')
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Get('overview')
  getOverview(
    @Query('branchId') branchId: string | undefined,
    @Req() request: TenantScopedRequest,
  ) {
    return this.posService.getOverview(branchId, request.tenantBranchIds);
  }

  @Get('terminals')
  @Roles('ADMIN')
  listTerminals(
    @Query('branchId') branchId: string | undefined,
    @Req() request: TenantScopedRequest,
  ) {
    return this.posService.listTerminals(branchId, request.tenantBranchIds);
  }

  @Put('terminals/:terminalId')
  @Roles('ADMIN')
  updateTerminalName(
    @Param('terminalId') terminalId: string,
    @Body() payload: UpdateTerminalSettingsDto,
    @Req() request: TenantScopedRequest,
  ) {
    return this.posService.updateTerminalName(
      terminalId,
      payload.name,
      request.tenantBranchIds,
    );
  }

  @Delete('terminals/:terminalId')
  @Roles('ADMIN')
  resetTerminalName(
    @Param('terminalId') terminalId: string,
    @Req() request: TenantScopedRequest,
  ) {
    return this.posService.resetTerminalName(
      terminalId,
      request.tenantBranchIds,
    );
  }

  @Post('transactions')
  @Roles('ADMIN', 'SUPERVISOR', 'CASHIER')
  createTransaction(
    @Body() payload: CreateTransactionDto,
    @Req() request: TenantScopedRequest,
  ) {
    return this.posService.createTransaction(payload, request.tenantBranchIds);
  }

  @Get('transactions')
  listTransactions(
    @Query() query: TransactionQueryDto,
    @Req() request: TenantScopedRequest,
  ) {
    return this.posService.listTransactions(query, request.tenantBranchIds);
  }

  @Post('transactions/:transactionId/void')
  @Roles('ADMIN', 'SUPERVISOR')
  voidTransaction(
    @Param('transactionId') transactionId: string,
    @Body() payload: VoidTransactionDto,
    @Req() request: TenantScopedRequest,
  ) {
    return this.posService.voidTransaction(
      transactionId,
      payload,
      request.tenantBranchIds,
    );
  }

  @Post('transactions/:transactionId/refund')
  @Roles('ADMIN', 'SUPERVISOR')
  refundTransaction(
    @Param('transactionId') transactionId: string,
    @Body() payload: RefundTransactionDto,
    @Req() request: TenantScopedRequest,
  ) {
    return this.posService.refundTransaction(
      transactionId,
      payload,
      request.tenantBranchIds,
    );
  }

  @Get('audit-trail')
  listAuditTrail(
    @Query() query: AuditQueryDto,
    @Req() request: TenantScopedRequest,
  ) {
    return this.posService.listAuditTrail(query, request.tenantBranchIds);
  }

  @Get('storage-status')
  @Roles('ADMIN')
  getStorageStatus() {
    return this.posService.getStorageStatus();
  }
}
