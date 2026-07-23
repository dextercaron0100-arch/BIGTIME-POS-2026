import { Controller, Get, NotFoundException, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { SkipTrialCheck } from '../../common/decorators/skip-trial-check.decorator';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('me')
  @SkipTrialCheck()
  async getMyOrganization(
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    const org = await this.organizationsService.findByBranchId(
      request.user.branchId,
    );

    if (!org) {
      throw new NotFoundException('No organization found for this account.');
    }

    return this.organizationsService.describeOrganization(org);
  }
}
