import { Body, Controller, Get, Post, Req, Put } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountService } from './account.service';
import { UpdateAccountProfileDto } from './dto/update-account-profile.dto';
import { MfaCodeDto } from './dto/mfa-code.dto';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('account')
@Roles('ADMIN')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get('profile')
  getProfile(@Req() request: AuthenticatedRequest) {
    return this.accountService.getProfile(request.user);
  }

  @Put('profile')
  updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() payload: UpdateAccountProfileDto,
  ) {
    return this.accountService.updateProfile(request.user, payload);
  }

  @Get('mfa')
  getMfaStatus(@Req() request: AuthenticatedRequest) {
    return this.accountService.getMfaStatus(request.user);
  }

  @Post('mfa/setup')
  beginMfaSetup(@Req() request: AuthenticatedRequest) {
    return this.accountService.beginMfaSetup(request.user);
  }

  @Post('mfa/confirm')
  confirmMfaSetup(
    @Req() request: AuthenticatedRequest,
    @Body() payload: MfaCodeDto,
  ) {
    return this.accountService.confirmMfaSetup(request.user, payload.code);
  }

  @Post('mfa/disable')
  disableMfa(
    @Req() request: AuthenticatedRequest,
    @Body() payload: MfaCodeDto,
  ) {
    return this.accountService.disableMfa(request.user, payload.code);
  }

  @Post('reset-password')
  resetPassword(@Req() request: AuthenticatedRequest) {
    return this.accountService.resetPassword(request.user);
  }

  @Post('reset-transactions')
  resetTransactions() {
    return this.accountService.resetTransactions();
  }

  @Post('reset-shift-management')
  resetShiftManagement() {
    return this.accountService.resetShiftManagement();
  }

  @Post('reset-inventory-management')
  resetInventoryManagement() {
    return this.accountService.resetInventoryManagement();
  }

  @Post('reset-employee-management')
  resetEmployeeManagement() {
    return this.accountService.resetEmployeeManagement();
  }

  @Post('delete-account')
  deleteAccount(@Req() request: AuthenticatedRequest) {
    return this.accountService.deleteAccount(request.user);
  }
}
