import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { UserRole } from '@apex-pos/shared-types';
import { compare, hash } from 'bcrypt';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { AccountService } from '../account/account.service';
import { EmployeesService } from '../employees/employees.service';
import {
  DEFAULT_AUTH_LOCKOUT_MINUTES,
  DEFAULT_AUTH_PIN_MAX_AGE_DAYS,
  readPositiveIntEnv,
} from './auth-policy';
import { AuthSessionService } from './auth-session.service';
import { ChangePinDto } from './dto/change-pin.dto';
import { LoginDto } from './dto/login.dto';

type DemoUser = {
  id: string;
  branchId: string;
  employeeCode: string;
  name: string;
  role: UserRole;
  pinHash: string;
};

type AuthUser = {
  id: string;
  branchId: string;
  employeeCode: string;
  name: string;
  role: UserRole;
  pinHash: string;
};

type AuthTokenPayload = {
  sub: string;
  branchId: string;
  sessionId?: string;
  terminalId: string;
  employeeCode: string;
  name: string;
  role: UserRole;
  tokenType?: 'access' | 'refresh';
  jti?: string;
};

const demoUsers: DemoUser[] = [
  {
    id: 'user-admin-001',
    branchId: 'branch-manila',
    employeeCode: 'ADM001',
    name: 'Andrea Cruz',
    role: 'ADMIN',
    pinHash: '$2b$10$AOcrvxHijPNnpPhXKQLRWe6eVIzohhwEd1SwNGO.eXjTGXQKlaUpO',
  },
  {
    id: 'user-sup-001',
    branchId: 'branch-manila',
    employeeCode: 'SUP001',
    name: 'Jose Santos',
    role: 'SUPERVISOR',
    pinHash: '$2b$10$ow2Jj69q.yvtX5hkUOrR7.BPU8oZwc5nyrmdQm.SSrEmhWCyoDSXe',
  },
  {
    id: 'user-cash-001',
    branchId: 'branch-cebu',
    employeeCode: 'CSH101',
    name: 'Maria Uy',
    role: 'CASHIER',
    pinHash: '$2b$10$9oMvt8yNRo0VIT8ntIe9te0oUpE3UT5pxdbQeu248/1GrrC625BZG',
  },
  {
    id: 'user-mnl-cash-001',
    branchId: 'branch-manila',
    employeeCode: 'MNL101',
    name: 'Mark Reyes',
    role: 'CASHIER',
    pinHash: '$2b$10$/5xJQUZXsSQ4KcmF7w9ni.T2DG4.jWDltfggd1IPlyD1GnnpbrEum',
  },
  {
    id: 'user-ceb-sup-001',
    branchId: 'branch-cebu',
    employeeCode: 'CEB201',
    name: 'Lisa Tan',
    role: 'SUPERVISOR',
    pinHash: '$2b$10$OLQidA.TdZjcCOkyYsWjSeQV0yXQAqiXUtrjhfzpa9CAlOTBqsLB2',
  },
  {
    id: 'user-dvo-admin-001',
    branchId: 'branch-davao',
    employeeCode: 'DVO301',
    name: 'Paolo Ramos',
    role: 'ADMIN',
    pinHash: '$2b$10$YW9xQkGJAD.HRHwVXk.ZZORsw2q.M2OzCKoKP.h0M7AiZol6iB5Q6',
  },
  {
    id: 'user-dvo-cash-001',
    branchId: 'branch-davao',
    employeeCode: 'DVO302',
    name: 'Nina Cruz',
    role: 'CASHIER',
    pinHash: '$2b$10$JFbfHzGO6CtWmbXvWdneROBSqBRQraaXWNxplDWgHWYrucSmSXuwC',
  },
];

const permissionsByRole: Record<UserRole, string[]> = {
  ADMIN: ['catalog.manage', 'reports.view', 'employees.manage', 'bir.manage'],
  SUPERVISOR: ['pos.void', 'inventory.transfer', 'reports.view'],
  CASHIER: ['pos.sell', 'pos.hold', 'pos.shift'],
  INVENTORY: ['inventory.transfer', 'inventory.receive', 'catalog.view'],
  AUDITOR: ['reports.view', 'bir.view', 'audit.view'],
};

@Injectable()
export class AuthService {
  private readonly allowDemoUsers = this.resolveAllowDemoUsers();
  private readonly jwtSecret = this.resolveJwtSecret();
  private readonly refreshJwtSecret = this.resolveRefreshJwtSecret();
  private readonly lockoutDurationMinutes = readPositiveIntEnv(
    'AUTH_LOCKOUT_MINUTES',
    DEFAULT_AUTH_LOCKOUT_MINUTES,
  );
  private readonly pinMaxAgeDays = readPositiveIntEnv(
    'AUTH_PIN_MAX_AGE_DAYS',
    DEFAULT_AUTH_PIN_MAX_AGE_DAYS,
  );
  private readonly accessTokenTtlSeconds = this.readTokenTtlSeconds(
    'JWT_ACCESS_TOKEN_TTL_SECONDS',
    15 * 60,
  );
  private readonly refreshTokenTtlSeconds = this.readTokenTtlSeconds(
    'JWT_REFRESH_TOKEN_TTL_SECONDS',
    30 * 24 * 60 * 60,
  );

  constructor(
    private readonly jwtService: JwtService,
    private readonly accountService: AccountService,
    private readonly employeesService: EmployeesService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  async login(payload: LoginDto) {
    const normalizedEmployeeCode = payload.employeeCode.trim().toUpperCase();
    const normalizedBranchId = payload.branchId.trim().toLowerCase();

    const { managedUser, user } = await this.resolveAuthUser({
      branchId: normalizedBranchId,
      employeeCode: normalizedEmployeeCode,
    });

    if (!user) {
      throw new UnauthorizedException('Employee code or branch is invalid.');
    }
    if (managedUser && !managedUser.isActive) {
      throw new UnauthorizedException('This POS user is inactive.');
    }
    const accountState = await this.accountService.getUserAuthState(user);
    if (accountState.deleted) {
      throw new UnauthorizedException('This account is no longer active.');
    }
    if (accountState.lockedUntil) {
      throw new ForbiddenException(
        `This user identification code is temporarily deactivated after repeated failed sign-in attempts. Try again after ${accountState.lockedUntil}.`,
      );
    }

    const pinMatches = await compare(
      payload.pin,
      accountState.pinHash ?? user.pinHash,
    );

    if (!pinMatches) {
      const failedState = await this.accountService.recordFailedLogin(user);
      if (failedState.lockedUntil) {
        throw new ForbiddenException(
          `PIN verification failed. This user identification code is temporarily deactivated for ${this.lockoutDurationMinutes} minute(s) after repeated failed attempts.`,
        );
      }

      throw new UnauthorizedException(
        `PIN verification failed. ${failedState.remainingLoginAttempts} attempt(s) remaining before temporary deactivation.`,
      );
    }

    const normalizedTerminalId = payload.terminalId.trim().toLowerCase();
    const isDashboardTerminal =
      normalizedTerminalId.startsWith('dashboard-web') ||
      normalizedTerminalId.startsWith('backoffice-web');
    if (isDashboardTerminal && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Back office access is for admin accounts only.',
      );
    }

    if (isDashboardTerminal && accountState.mfaEnabled) {
      if (!payload.mfaCode?.trim()) {
        throw new UnauthorizedException({
          code: 'MFA_REQUIRED',
          message: 'Enter your authenticator or recovery code to continue.',
        });
      }

      const mfaVerified = await this.accountService.verifyMfaCode(
        user,
        payload.mfaCode,
      );
      if (!mfaVerified) {
        const failedState = await this.accountService.recordFailedLogin(user);
        if (failedState.lockedUntil) {
          throw new ForbiddenException({
            code: 'MFA_LOCKED',
            message: `Verification failed. This account is temporarily deactivated for ${this.lockoutDurationMinutes} minute(s).`,
          });
        }
        throw new UnauthorizedException({
          code: 'MFA_INVALID',
          message: `That code could not be verified. ${failedState.remainingLoginAttempts} attempt(s) remaining.`,
        });
      }
    }

    const policyState = await this.accountService.registerSuccessfulLogin(user);

    const refreshTokenId = randomUUID();
    const session = await this.authSessionService.createSession({
      userId: user.id,
      branchId: user.branchId,
      employeeCode: user.employeeCode,
      name: user.name,
      role: user.role,
      terminalId: payload.terminalId,
      terminalName: payload.terminalName,
      platform: payload.platform,
      appVersion: payload.appVersion,
      refreshTokenId,
    });
    const tokenPayload = this.buildTokenPayload(
      user,
      payload.terminalId,
      session.id,
    );
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(tokenPayload),
      this.signRefreshToken(tokenPayload, refreshTokenId),
    ]);

    return {
      accessToken,
      refreshToken,
      sessionId: session.id,
      terminalId: payload.terminalId,
      user: {
        id: user.id,
        branchId: user.branchId,
        employeeCode: user.employeeCode,
        name: user.name,
        role: user.role,
      },
      permissions: permissionsByRole[user.role],
      pinChangeRequired: policyState.pinChangeRequired,
      pinChangeReason: policyState.pinChangeReason,
      pinUpdatedAt: policyState.pinUpdatedAt,
      pinExpiresAt: policyState.pinExpiresAt,
    };
  }

  async changePin(user: AuthenticatedUser, payload: ChangePinDto) {
    if (payload.currentPin === payload.newPin) {
      throw new BadRequestException(
        'New PIN must be different from the current PIN.',
      );
    }
    const employeeCode = user.employeeCode?.trim().toUpperCase();
    if (!employeeCode) {
      throw new UnauthorizedException(
        'This account is missing employee credentials.',
      );
    }

    const resolvedUser = await this.resolveAuthUser({
      branchId: user.branchId,
      employeeCode,
    });
    const authUser = resolvedUser.user;

    if (!authUser) {
      throw new UnauthorizedException('This account is no longer active.');
    }
    if (resolvedUser.managedUser && !resolvedUser.managedUser.isActive) {
      throw new UnauthorizedException('This POS user is inactive.');
    }

    const accountState = await this.accountService.getUserAuthState(authUser);
    if (accountState.deleted) {
      throw new UnauthorizedException('This account is no longer active.');
    }

    const currentPinMatches = await compare(
      payload.currentPin,
      accountState.pinHash ?? authUser.pinHash,
    );
    if (!currentPinMatches) {
      throw new UnauthorizedException('Current PIN is incorrect.');
    }

    const nextPinHash = await hash(payload.newPin, 10);
    const nextPolicy = await this.accountService.updateOwnPin(
      authUser,
      nextPinHash,
    );
    await this.authSessionService.revokeAllSessions(
      { userId: authUser.id, branchId: authUser.branchId },
      'pin-changed',
    );

    return {
      message: `PIN updated successfully. Change it again within ${this.pinMaxAgeDays} day(s).`,
      signedOut: true,
      pinUpdatedAt: nextPolicy.pinUpdatedAt,
      pinExpiresAt: nextPolicy.pinExpiresAt,
      pinChangeRequired: nextPolicy.pinChangeRequired,
    };
  }

  async refresh(refreshToken: string) {
    let payload: AuthTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AuthTokenPayload>(
        refreshToken,
        {
          secret: this.refreshJwtSecret,
          algorithms: ['HS256'],
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.branchId !== 'string' ||
      typeof payload.terminalId !== 'string' ||
      typeof payload.employeeCode !== 'string' ||
      typeof payload.name !== 'string' ||
      typeof payload.role !== 'string' ||
      payload.tokenType !== 'refresh' ||
      typeof payload.jti !== 'string'
    ) {
      throw new UnauthorizedException('Malformed refresh token payload.');
    }

    const normalizedRole = payload.role.toUpperCase() as UserRole;
    if (!(normalizedRole in permissionsByRole)) {
      throw new UnauthorizedException('Refresh token role is not recognized.');
    }

    const refreshSessionId = payload.sessionId?.trim();
    if (!refreshSessionId) {
      throw new UnauthorizedException(
        'Legacy refresh tokens are no longer accepted. Please login again.',
      );
    }
    const normalizedPayload: AuthTokenPayload = {
      ...payload,
      sessionId: refreshSessionId,
      role: normalizedRole,
    };
    const trackedSessionId = normalizedPayload.sessionId;
    if (!trackedSessionId) {
      throw new UnauthorizedException('Refresh token session is missing.');
    }
    await this.authSessionService.assertTrackedSessionActive(trackedSessionId, {
      userId: normalizedPayload.sub,
      branchId: normalizedPayload.branchId,
    });
    const managedUser = await this.employeesService.findManagedUser(
      normalizedPayload.branchId,
      normalizedPayload.employeeCode,
    );
    if (managedUser && !managedUser.isActive) {
      throw new UnauthorizedException('This POS user is inactive.');
    }
    const refreshIdentity = {
      id: normalizedPayload.sub,
      branchId: normalizedPayload.branchId,
      employeeCode: normalizedPayload.employeeCode,
      name: normalizedPayload.name,
      role: normalizedPayload.role,
    };
    await this.accountService.assertAccountActive(refreshIdentity);
    const accountState =
      await this.accountService.getUserAuthState(refreshIdentity);
    if (accountState.pinChangeRequired) {
      throw new UnauthorizedException(
        'PIN change required. Please login again to update your PIN.',
      );
    }

    const nextRefreshTokenId = randomUUID();
    const [nextAccessToken, nextRefreshToken] = await Promise.all([
      this.signAccessToken(normalizedPayload),
      this.signRefreshToken(normalizedPayload, nextRefreshTokenId),
    ]);
    await this.authSessionService.rotateRefreshToken(
      trackedSessionId,
      {
        userId: normalizedPayload.sub,
        branchId: normalizedPayload.branchId,
      },
      payload.jti,
      nextRefreshTokenId,
    );

    return {
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      sessionId: normalizedPayload.sessionId,
      terminalId: normalizedPayload.terminalId,
      user: {
        id: normalizedPayload.sub,
        branchId: normalizedPayload.branchId,
        employeeCode: normalizedPayload.employeeCode,
        name: normalizedPayload.name,
        role: normalizedPayload.role,
      },
      permissions: permissionsByRole[normalizedPayload.role],
    };
  }

  private resolveAllowDemoUsers() {
    const configured = process.env.AUTH_ALLOW_DEMO_USERS?.trim().toLowerCase();
    if (configured) {
      if (['1', 'true', 'yes', 'on'].includes(configured)) {
        return true;
      }
      if (['0', 'false', 'no', 'off'].includes(configured)) {
        return false;
      }
    }

    return false;
  }

  private buildTokenPayload(
    user: AuthUser,
    terminalId: string,
    sessionId: string,
  ): AuthTokenPayload {
    return {
      sub: user.id,
      branchId: user.branchId,
      sessionId,
      terminalId,
      employeeCode: user.employeeCode,
      name: user.name,
      role: user.role,
    };
  }

  private signAccessToken(payload: AuthTokenPayload) {
    return this.jwtService.signAsync(
      { ...payload, tokenType: 'access' },
      {
        secret: this.jwtSecret,
        expiresIn: this.accessTokenTtlSeconds,
        algorithm: 'HS256',
      },
    );
  }

  private signRefreshToken(payload: AuthTokenPayload, tokenId: string) {
    return this.jwtService.signAsync(
      { ...payload, tokenType: 'refresh', jti: tokenId },
      {
        secret: this.refreshJwtSecret,
        expiresIn: this.refreshTokenTtlSeconds,
        algorithm: 'HS256',
      },
    );
  }

  private resolveJwtSecret() {
    return process.env.JWT_SECRET?.trim() || 'apex-pos-dev-secret';
  }

  private resolveRefreshJwtSecret() {
    const configured = process.env.JWT_REFRESH_SECRET?.trim();
    if (configured && configured.length > 0) {
      return configured;
    }

    return `${this.jwtSecret}:refresh`;
  }

  private readTokenTtlSeconds(name: string, fallback: number) {
    const raw = process.env[name]?.trim();
    if (!raw) {
      return fallback;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.floor(parsed);
  }

  private async resolveAuthUser(identity: {
    branchId: string;
    employeeCode: string;
  }) {
    const demoUser = this.allowDemoUsers
      ? demoUsers.find(
          (candidate) =>
            candidate.employeeCode.toUpperCase() === identity.employeeCode &&
            candidate.branchId.toLowerCase() === identity.branchId,
        )
      : undefined;
    const managedUser = await this.employeesService.resolveManagedUserForLogin(
      identity.branchId,
      identity.employeeCode,
    );
    const user: AuthUser | undefined = demoUser ?? managedUser ?? undefined;

    return {
      demoUser,
      managedUser,
      user,
    };
  }
}
