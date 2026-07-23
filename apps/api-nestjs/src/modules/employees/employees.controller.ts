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
import { CreateBranchDto } from './dto/create-branch.dto';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { UpdateManagedUserStatusDto } from './dto/update-managed-user-status.dto';
import { EmployeesService } from './employees.service';
import { OrganizationsService } from '../organizations/organizations.service';

@Controller('employees')
@Roles('ADMIN', 'SUPERVISOR', 'AUDITOR')
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  @Get()
  listEmployees(
    @Query('branchId') branchId: string | undefined,
    @Req() request: TenantScopedRequest,
  ) {
    return this.employeesService.listEmployees(
      branchId,
      request.tenantBranchIds,
    );
  }

  @Get('work-hours')
  getWorkHours(
    @Query('branchId') branchId: string | undefined,
    @Req() request: TenantScopedRequest,
  ) {
    return this.employeesService.getWorkHours(
      branchId,
      request.tenantBranchIds,
    );
  }

  @Get('branches')
  @Roles('ADMIN')
  listBranches(@Req() request: TenantScopedRequest) {
    return this.employeesService.listBranches(request.tenantBranchIds);
  }

  @Post('branches')
  @Roles('ADMIN')
  async createBranch(
    @Body() payload: CreateBranchDto,
    @Req() request: TenantScopedRequest,
  ) {
    const ownerBranchId = request.user?.branchId;
    if (!ownerBranchId) {
      throw new Error('Authenticated branch context is missing.');
    }

    const branch = await this.employeesService.createBranchWithActor(
      payload,
      request.user?.id,
    );
    try {
      await this.organizationsService.addBranchToOrganization(
        ownerBranchId,
        branch.id,
      );
      return branch;
    } catch (error) {
      await this.employeesService.deleteBranchWithActor(
        branch.id,
        'system-ownership-rollback',
      );
      throw error;
    }
  }

  @Delete('branches/:branchId')
  @Roles('ADMIN')
  async deleteBranch(
    @Param('branchId') branchId: string,
    @Req() request: TenantScopedRequest,
  ) {
    const ownerBranchId = request.user?.branchId;
    if (!ownerBranchId) {
      throw new Error('Authenticated branch context is missing.');
    }
    await this.organizationsService.assertCanRemoveBranch(
      ownerBranchId,
      branchId,
    );
    const deleted = await this.employeesService.deleteBranchWithActor(
      branchId,
      request.user?.id,
    );
    await this.organizationsService.removeBranchFromOrganization(
      ownerBranchId,
      branchId,
    );
    return deleted;
  }

  @Get('managed-users')
  @Roles('ADMIN')
  listManagedUsers(
    @Query('branchId') branchId: string | undefined,
    @Req() request: TenantScopedRequest,
  ) {
    return this.employeesService.listManagedUsers(
      branchId,
      request.tenantBranchIds,
    );
  }

  @Post('managed-users')
  @Roles('ADMIN')
  createManagedUser(
    @Body() payload: CreateManagedUserDto,
    @Req() request: TenantScopedRequest,
  ) {
    return this.employeesService.createManagedUserWithActor(
      payload,
      request.user?.id,
      request.tenantBranchIds,
    );
  }

  @Put('managed-users/:userId/status')
  @Roles('ADMIN')
  updateManagedUserStatus(
    @Param('userId') userId: string,
    @Body() payload: UpdateManagedUserStatusDto,
    @Req() request: TenantScopedRequest,
  ) {
    return this.employeesService.updateManagedUserStatusWithActor(
      userId,
      payload.isActive,
      request.user?.id,
      request.tenantBranchIds,
    );
  }

  @Get('audit-log')
  @Roles('ADMIN')
  listAdminAuditLog(
    @Query('limit') limit: string | undefined,
    @Req() request: TenantScopedRequest,
  ) {
    const parsed = limit ? Number(limit) : undefined;
    const safeLimit =
      parsed !== undefined && Number.isFinite(parsed) && parsed > 0
        ? Math.floor(parsed)
        : 200;
    return this.employeesService.listAdminAuditLog(
      safeLimit,
      request.tenantBranchIds,
    );
  }
}
