import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { OrganizationsService } from '../../modules/organizations/organizations.service';
import type { AuthenticatedUser } from '../auth/authenticated-user.type';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_TRIAL_CHECK_KEY } from '../decorators/skip-trial-check.decorator';

@Injectable()
export class TrialGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const skipTrialCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_TRIAL_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipTrialCheck) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user?.branchId) {
      return true;
    }

    const org = await this.organizationsService.findByBranchId(user.branchId);
    if (!org) {
      return true;
    }

    const trialState = this.organizationsService.getTrialState(org);
    if (trialState === 'TRIAL_EXPIRED' || trialState === 'SUSPENDED') {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: trialState === 'SUSPENDED' ? 'ACCOUNT_SUSPENDED' : 'TRIAL_EXPIRED',
        message:
          trialState === 'SUSPENDED'
            ? 'This account has been suspended.'
            : 'Your 30-day trial has ended. Please contact support to continue.',
      });
    }

    return true;
  }
}
