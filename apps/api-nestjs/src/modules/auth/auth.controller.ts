import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { Public } from '../../common/decorators/public.decorator';
import { ChangePinDto } from './dto/change-pin.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthSessionService } from './auth-session.service';
import { AuthService } from './auth.service';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  @Post('login')
  @Public()
  @Throttle({
    default: {
      limit: 10,
      ttl: 60_000,
    },
  })
  login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  @Post('refresh')
  @Public()
  @Throttle({
    default: {
      limit: 30,
      ttl: 60_000,
    },
  })
  refresh(@Body() payload: RefreshTokenDto) {
    return this.authService.refresh(payload.refreshToken);
  }

  @Post('change-pin')
  changePin(
    @Req() request: AuthenticatedRequest,
    @Body() payload: ChangePinDto,
  ) {
    return this.authService.changePin(request.user, payload);
  }

  @Get('sessions')
  listSessions(@Req() request: AuthenticatedRequest) {
    return this.authSessionService.listActiveSessions({
      userId: request.user.id,
      branchId: request.user.branchId,
      currentSessionId: request.user.sessionId,
    });
  }

  @Post('sessions/logout-others')
  logoutOtherSessions(@Req() request: AuthenticatedRequest) {
    return this.authSessionService.revokeOtherSessions({
      userId: request.user.id,
      branchId: request.user.branchId,
      currentSessionId: request.user.sessionId,
    });
  }

  @Post('sessions/:sessionId/revoke')
  revokeSession(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
  ) {
    return this.authSessionService.revokeSession(
      {
        userId: request.user.id,
        branchId: request.user.branchId,
        currentSessionId: request.user.sessionId,
      },
      sessionId,
    );
  }
}
