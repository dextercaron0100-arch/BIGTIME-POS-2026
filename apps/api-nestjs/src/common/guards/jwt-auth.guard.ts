import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/authenticated-user.type';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthSessionService } from '../../modules/auth/auth-session.service';

type JwtPayload = {
  sub: string;
  branchId: string;
  sessionId?: string;
  terminalId?: string;
  employeeCode?: string;
  name?: string;
  role?: string;
  iat?: number;
  exp?: number;
  tokenType?: 'access' | 'refresh';
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const authorization = request.headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const token = authorization.slice('Bearer '.length).trim();
    if (token.length === 0) {
      throw new UnauthorizedException('Bearer token is empty.');
    }

    const configuredSecret = this.configService
      .get<string>('JWT_SECRET')
      ?.trim();
    const jwtSecret = configuredSecret || 'apex-pos-dev-secret';

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, {
        secret: jwtSecret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.branchId !== 'string' ||
      typeof payload.role !== 'string' ||
      payload.tokenType !== 'access'
    ) {
      throw new UnauthorizedException('Malformed token payload.');
    }

    const sessionId = payload.sessionId?.trim();
    if (sessionId) {
      await this.authSessionService.assertTrackedSessionActive(sessionId, {
        userId: payload.sub,
        branchId: payload.branchId,
      });
    }

    request.user = {
      id: payload.sub,
      branchId: payload.branchId,
      sessionId: sessionId && sessionId.length > 0 ? sessionId : undefined,
      terminalId: payload.terminalId,
      employeeCode: payload.employeeCode,
      name: payload.name,
      role: payload.role as AuthenticatedUser['role'],
      iat: payload.iat,
      exp: payload.exp,
    };

    return true;
  }
}
