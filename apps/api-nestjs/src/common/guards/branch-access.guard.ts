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

export type TenantScopedRequest = Request & {
  user?: AuthenticatedUser;
  organizationId?: string;
  tenantBranchIds?: string[];
};

@Injectable()
export class BranchAccessGuard implements CanActivate {
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

    const request = context.switchToHttp().getRequest<TenantScopedRequest>();
    const user = request.user;
    if (!user?.branchId) {
      throw new ForbiddenException(
        'The authenticated account is not assigned to a branch.',
      );
    }

    const org = await this.organizationsService.findByBranchId(user.branchId);
    if (!org) {
      throw new ForbiddenException(
        'The authenticated branch is not assigned to an organization.',
      );
    }

    request.organizationId = org.id;
    request.tenantBranchIds = [...org.branchIds];

    const target = this.resolveTargetBranchId(request);
    if (!target || target === 'all') {
      return true;
    }

    if (!org.branchIds.includes(target)) {
      throw new ForbiddenException('You do not have access to this branch.');
    }

    return true;
  }

  private resolveTargetBranchId(
    request: TenantScopedRequest,
  ): string | undefined {
    const fromParams = request.params?.branchId;
    if (typeof fromParams === 'string' && fromParams.length > 0) {
      return fromParams.trim().toLowerCase();
    }

    const fromQuery = request.query?.branchId;
    if (typeof fromQuery === 'string' && fromQuery.length > 0) {
      return fromQuery.trim().toLowerCase();
    }

    const body = request.body as { branchId?: unknown } | undefined;
    if (typeof body?.branchId === 'string' && body.branchId.length > 0) {
      return body.branchId.trim().toLowerCase();
    }

    return undefined;
  }
}
