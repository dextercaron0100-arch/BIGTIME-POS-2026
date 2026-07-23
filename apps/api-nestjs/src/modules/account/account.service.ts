import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { hash } from 'bcrypt';
import { createHash, randomInt } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import {
  decryptSensitiveValue,
  encryptSensitiveValue,
} from '../../common/security/data-encryption';
import {
  buildTotpUri,
  generateTotpSecret,
  verifyTotpCode,
} from '../../common/security/totp';
import { EmployeesService } from '../employees/employees.service';
import { AuthSessionService } from '../auth/auth-session.service';
import {
  DEFAULT_AUTH_LOCKOUT_MINUTES,
  DEFAULT_AUTH_MAX_FAILED_LOGIN_ATTEMPTS,
  DEFAULT_AUTH_PIN_MAX_AGE_DAYS,
  computePinExpiresAt,
  isPinExpired,
  normalizeIsoDate,
  readPositiveIntEnv,
} from '../auth/auth-policy';
import { UpdateAccountProfileDto } from './dto/update-account-profile.dto';

type StoredBranchProfile = {
  companyName: string;
  companyDescription: string;
  updatedAt: string;
};

type StoredUserOverride = {
  branchId: string;
  employeeCode: string;
  pinHash?: string;
  failedLoginAttempts?: number;
  lockedUntil?: string;
  pinUpdatedAt?: string;
  pinChangeRequired?: boolean;
  mfaSecretEncrypted?: string;
  mfaPendingSecretEncrypted?: string;
  mfaEnabledAt?: string;
  mfaRecoveryCodeHashes?: string[];
  deletedAt?: string;
  updatedAt: string;
};

type AccountStore = {
  version: 1;
  branches: Record<string, StoredBranchProfile>;
  userOverrides: Record<string, StoredUserOverride>;
  lastUpdatedAt: string;
};

type AccountIdentity = Pick<
  AuthenticatedUser,
  'id' | 'branchId' | 'employeeCode' | 'name' | 'role'
>;

@Injectable()
export class AccountService {
  private readonly storageFilePath = this.resolveStorageFilePath();
  private readonly maxFailedLoginAttempts = readPositiveIntEnv(
    'AUTH_MAX_FAILED_LOGIN_ATTEMPTS',
    DEFAULT_AUTH_MAX_FAILED_LOGIN_ATTEMPTS,
  );
  private readonly lockoutDurationMinutes = readPositiveIntEnv(
    'AUTH_LOCKOUT_MINUTES',
    DEFAULT_AUTH_LOCKOUT_MINUTES,
  );
  private readonly pinMaxAgeDays = readPositiveIntEnv(
    'AUTH_PIN_MAX_AGE_DAYS',
    DEFAULT_AUTH_PIN_MAX_AGE_DAYS,
  );
  private writeQueue = Promise.resolve();

  constructor(
    private readonly employeesService: EmployeesService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  async getProfile(user: AccountIdentity) {
    const store = await this.readStore();
    return this.presentProfile(user, store);
  }

  async updateProfile(user: AccountIdentity, payload: UpdateAccountProfileDto) {
    return this.mutateStore((store) => {
      store.branches[user.branchId] = {
        companyName: payload.companyName.trim(),
        companyDescription: payload.companyDescription.trim(),
        updatedAt: new Date().toISOString(),
      };

      return this.presentProfile(user, store);
    });
  }

  async getUserAuthState(identity: AccountIdentity) {
    const store = await this.readStore();
    return this.presentUserAuthState(
      identity,
      store.userOverrides[identity.id],
    );
  }

  async assertAccountActive(identity: AccountIdentity) {
    const authState = await this.getUserAuthState(identity);
    if (authState.deleted) {
      throw new UnauthorizedException('This account is no longer active.');
    }
  }

  async resetPassword(user: AccountIdentity) {
    const temporaryPin = this.generateTemporaryPin();
    const pinHash = await hash(temporaryPin, 10);

    const result = await this.mutateStore((store) => {
      const now = new Date().toISOString();
      const override = this.ensureUserOverride(store, user);
      override.pinHash = pinHash;
      override.failedLoginAttempts = 0;
      override.lockedUntil = undefined;
      override.pinUpdatedAt = now;
      override.pinChangeRequired = true;
      override.updatedAt = now;

      return {
        action: 'RESET_PASSWORD',
        temporaryPin,
        signedOut: true,
        message: `Password reset complete. Use ${temporaryPin} on your next login, then change the PIN immediately.`,
      };
    });
    await this.authSessionService.revokeAllSessions(
      { userId: user.id, branchId: user.branchId },
      'password-reset',
    );
    return result;
  }

  async recordFailedLogin(identity: AccountIdentity) {
    return this.mutateStore((store) => {
      const override = this.ensureUserOverride(store, identity);
      const now = Date.now();
      const lockedUntilMs = Date.parse(override.lockedUntil ?? '');

      if (Number.isFinite(lockedUntilMs) && lockedUntilMs > now) {
        return this.presentUserAuthState(identity, override);
      }

      const nextAttempts = (override.failedLoginAttempts ?? 0) + 1;
      override.failedLoginAttempts = nextAttempts;
      override.updatedAt = new Date(now).toISOString();

      if (nextAttempts >= this.maxFailedLoginAttempts) {
        override.failedLoginAttempts = 0;
        override.lockedUntil = new Date(
          now + this.lockoutDurationMinutes * 60_000,
        ).toISOString();
      } else {
        override.lockedUntil = undefined;
      }

      return this.presentUserAuthState(identity, override);
    });
  }

  async registerSuccessfulLogin(identity: AccountIdentity) {
    return this.mutateStore((store) => {
      const override = this.ensureUserOverride(store, identity);
      const now = new Date().toISOString();

      override.failedLoginAttempts = 0;
      override.lockedUntil = undefined;
      override.pinUpdatedAt = normalizeIsoDate(override.pinUpdatedAt) ?? now;
      override.updatedAt = now;

      return this.presentUserAuthState(identity, override);
    });
  }

  async updateOwnPin(identity: AccountIdentity, pinHash: string) {
    return this.mutateStore((store) => {
      const override = this.ensureUserOverride(store, identity);
      const now = new Date().toISOString();

      override.pinHash = pinHash;
      override.failedLoginAttempts = 0;
      override.lockedUntil = undefined;
      override.pinUpdatedAt = now;
      override.pinChangeRequired = false;
      override.updatedAt = now;

      return this.presentUserAuthState(identity, override);
    });
  }

  async getMfaStatus(identity: AccountIdentity) {
    const authState = await this.getUserAuthState(identity);
    return {
      enabled: authState.mfaEnabled,
      enabledAt: authState.mfaEnabledAt,
      recoveryCodesRemaining: authState.mfaRecoveryCodesRemaining,
    };
  }

  async beginMfaSetup(identity: AccountIdentity) {
    const secret = generateTotpSecret();
    await this.mutateStore((store) => {
      const override = this.ensureUserOverride(store, identity);
      override.mfaPendingSecretEncrypted = encryptSensitiveValue(secret);
      override.updatedAt = new Date().toISOString();
    });

    const accountName = `${identity.employeeCode ?? identity.id}@${identity.branchId}`;
    return {
      secret,
      manualEntryKey: secret.match(/.{1,4}/g)?.join(' ') ?? secret,
      otpauthUri: buildTotpUri({ secret, accountName }),
      issuer: 'BIGTIME POS',
      accountName,
    };
  }

  async confirmMfaSetup(identity: AccountIdentity, code: string) {
    const recoveryCodes = this.generateRecoveryCodes();
    const result = await this.mutateStore((store) => {
      const override = this.resolveMatchingOverride(store, identity);
      if (!override?.mfaPendingSecretEncrypted) {
        throw new BadRequestException(
          'Start MFA setup before confirming an authenticator code.',
        );
      }

      const secret = decryptSensitiveValue(override.mfaPendingSecretEncrypted);
      if (!verifyTotpCode(secret, code)) {
        throw new BadRequestException(
          'Authenticator code is invalid or expired.',
        );
      }

      const now = new Date().toISOString();
      override.mfaSecretEncrypted = override.mfaPendingSecretEncrypted;
      override.mfaPendingSecretEncrypted = undefined;
      override.mfaEnabledAt = now;
      override.mfaRecoveryCodeHashes = recoveryCodes.map((recoveryCode) =>
        this.hashRecoveryCode(identity.id, recoveryCode),
      );
      override.updatedAt = now;

      return {
        enabled: true,
        enabledAt: now,
        recoveryCodes,
        recoveryCodesRemaining: recoveryCodes.length,
        signedOut: true,
        message:
          'Multi-factor authentication is enabled. Save the recovery codes and sign in again.',
      };
    });

    await this.authSessionService.revokeAllSessions(
      { userId: identity.id, branchId: identity.branchId },
      'mfa-enabled',
    );
    return result;
  }

  async disableMfa(identity: AccountIdentity, code: string) {
    const verified = await this.verifyMfaCode(identity, code, true);
    if (!verified) {
      throw new BadRequestException(
        'Authenticator or recovery code is invalid.',
      );
    }

    const result = await this.mutateStore((store) => {
      const override = this.ensureUserOverride(store, identity);
      override.mfaSecretEncrypted = undefined;
      override.mfaPendingSecretEncrypted = undefined;
      override.mfaEnabledAt = undefined;
      override.mfaRecoveryCodeHashes = undefined;
      override.updatedAt = new Date().toISOString();
      return {
        enabled: false,
        enabledAt: null,
        recoveryCodesRemaining: 0,
        signedOut: true,
        message:
          'Multi-factor authentication is disabled. Sign in again to continue.',
      };
    });

    await this.authSessionService.revokeAllSessions(
      { userId: identity.id, branchId: identity.branchId },
      'mfa-disabled',
    );
    return result;
  }

  async verifyMfaCode(
    identity: AccountIdentity,
    candidate: string | undefined,
    consumeRecoveryCode = true,
  ) {
    if (!candidate?.trim()) {
      return false;
    }

    return this.mutateStore((store) => {
      const override = this.resolveMatchingOverride(store, identity);
      if (!override?.mfaSecretEncrypted || !override.mfaEnabledAt) {
        return false;
      }

      const secret = decryptSensitiveValue(override.mfaSecretEncrypted);
      const normalizedCandidate = candidate.trim();
      if (verifyTotpCode(secret, normalizedCandidate)) {
        return true;
      }

      const recoveryHash = this.hashRecoveryCode(
        identity.id,
        normalizedCandidate,
      );
      const recoveryIndex =
        override.mfaRecoveryCodeHashes?.indexOf(recoveryHash) ?? -1;
      if (recoveryIndex < 0) {
        return false;
      }

      if (consumeRecoveryCode) {
        override.mfaRecoveryCodeHashes?.splice(recoveryIndex, 1);
        override.updatedAt = new Date().toISOString();
      }
      return true;
    });
  }

  resetTransactions() {
    throw new ForbiddenException(
      'Reset transactions is disabled in compliance mode. Posted sales, audit logs, and official receipt numbering must remain intact.',
    );
  }

  resetShiftManagement() {
    throw new ForbiddenException(
      'Reset shift management is disabled in compliance mode. Historical Z-readings and end-of-day reports must remain intact.',
    );
  }

  resetInventoryManagement() {
    throw new ForbiddenException(
      'Reset inventory management is disabled because it could destroy shared business data.',
    );
  }

  resetEmployeeManagement() {
    throw new ForbiddenException(
      'Reset employee management is disabled because it could remove organization accounts and audit history.',
    );
  }

  async deleteAccount(user: AccountIdentity) {
    const employeeCode = user.employeeCode ?? '';
    if (employeeCode.length > 0) {
      const managedUser = await this.employeesService.findManagedUser(
        user.branchId,
        employeeCode,
      );

      if (managedUser) {
        const removedCount =
          await this.employeesService.removeManagedUserByIdentity(
            user.branchId,
            employeeCode,
          );
        await this.mutateStore((store) => {
          delete store.userOverrides[user.id];
          return undefined;
        });

        return {
          action: 'DELETE_ACCOUNT',
          signedOut: true,
          deleted: true,
          removedCount,
          message:
            'Managed account deleted. You will be signed out and this login can no longer access the back office.',
        };
      }
    }

    return this.mutateStore((store) => {
      const hadBranchProfile = store.branches[user.branchId] != null;
      delete store.branches[user.branchId];
      delete store.userOverrides[user.id];

      return {
        action: 'DELETE_ACCOUNT',
        signedOut: false,
        deleted: false,
        message: hadBranchProfile
          ? 'Built-in admin accounts stay available for safety. We cleared the saved account profile instead.'
          : 'Built-in admin accounts cannot be deleted from the dashboard.',
      };
    });
  }

  private presentProfile(user: AccountIdentity, store: AccountStore) {
    const profile =
      store.branches[user.branchId] ?? this.buildDefaultBranchProfile();
    const authState = this.presentUserAuthState(
      user,
      store.userOverrides[user.id],
    );

    return {
      userId: user.id,
      branchId: user.branchId,
      employeeCode: user.employeeCode ?? '',
      name: user.name ?? user.employeeCode ?? 'ADMIN',
      role: user.role,
      email:
        user.employeeCode && user.employeeCode.length > 0
          ? `${user.employeeCode.toLowerCase()}@bigtime.pos`
          : 'admin@bigtime.pos',
      companyName: profile.companyName,
      companyDescription: profile.companyDescription,
      pinUpdatedAt: authState.pinUpdatedAt,
      pinExpiresAt: authState.pinExpiresAt,
      pinChangeRequired: authState.pinChangeRequired,
      pinChangeReason: authState.pinChangeReason,
      failedLoginAttempts: authState.failedLoginAttempts,
      remainingLoginAttempts: authState.remainingLoginAttempts,
      maxFailedLoginAttempts: authState.maxFailedLoginAttempts,
      lockoutDurationMinutes: authState.lockoutDurationMinutes,
      lockedUntil: authState.lockedUntil,
      mfaEnabled: authState.mfaEnabled,
      mfaEnabledAt: authState.mfaEnabledAt,
      mfaRecoveryCodesRemaining: authState.mfaRecoveryCodesRemaining,
      updatedAt: profile.updatedAt,
    };
  }

  private generateTemporaryPin() {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const alphabet = `${letters}${digits}`;
    const characters = [
      letters[randomInt(letters.length)],
      digits[randomInt(digits.length)],
    ];

    while (characters.length < 10) {
      characters.push(alphabet[randomInt(alphabet.length)]);
    }

    for (let index = characters.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(index + 1);
      [characters[index], characters[swapIndex]] = [
        characters[swapIndex],
        characters[index],
      ];
    }

    return characters.join('');
  }

  private buildDefaultBranchProfile(): StoredBranchProfile {
    return {
      companyName: '',
      companyDescription: '',
      updatedAt: new Date().toISOString(),
    };
  }

  private presentUserAuthState(
    identity: AccountIdentity,
    override?: StoredUserOverride,
  ) {
    const matchesIdentity =
      override?.branchId === identity.branchId &&
      override?.employeeCode === (identity.employeeCode ?? '');
    const matchedOverride = matchesIdentity ? override : undefined;
    const normalizedLockedUntil = normalizeIsoDate(
      matchedOverride?.lockedUntil,
    );
    const lockedUntil =
      normalizedLockedUntil && Date.parse(normalizedLockedUntil) > Date.now()
        ? normalizedLockedUntil
        : null;
    const failedLoginAttempts = lockedUntil
      ? 0
      : Math.max(0, matchedOverride?.failedLoginAttempts ?? 0);
    const pinUpdatedAt = normalizeIsoDate(matchedOverride?.pinUpdatedAt);
    const explicitPinChangeRequired =
      matchedOverride?.pinChangeRequired === true;
    const expiredPin = isPinExpired(pinUpdatedAt, this.pinMaxAgeDays);

    return {
      deleted: matchedOverride?.deletedAt != null,
      pinHash: matchedOverride?.pinHash ?? null,
      failedLoginAttempts,
      remainingLoginAttempts: Math.max(
        0,
        this.maxFailedLoginAttempts - failedLoginAttempts,
      ),
      maxFailedLoginAttempts: this.maxFailedLoginAttempts,
      lockoutDurationMinutes: this.lockoutDurationMinutes,
      lockedUntil,
      pinUpdatedAt,
      pinExpiresAt: computePinExpiresAt(pinUpdatedAt, this.pinMaxAgeDays),
      pinChangeRequired: explicitPinChangeRequired || expiredPin,
      pinChangeReason: explicitPinChangeRequired
        ? 'RESET'
        : expiredPin
          ? 'EXPIRED'
          : null,
      mfaEnabled:
        Boolean(matchedOverride?.mfaSecretEncrypted) &&
        Boolean(normalizeIsoDate(matchedOverride?.mfaEnabledAt)),
      mfaEnabledAt: normalizeIsoDate(matchedOverride?.mfaEnabledAt) ?? null,
      mfaRecoveryCodesRemaining:
        matchedOverride?.mfaRecoveryCodeHashes?.length ?? 0,
    };
  }

  private generateRecoveryCodes() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 10 }, () => {
      const value = Array.from(
        { length: 12 },
        () => alphabet[randomInt(alphabet.length)],
      ).join('');
      return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8)}`;
    });
  }

  private hashRecoveryCode(userId: string, recoveryCode: string) {
    const normalized = recoveryCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return createHash('sha256').update(`${userId}:${normalized}`).digest('hex');
  }

  private ensureUserOverride(store: AccountStore, identity: AccountIdentity) {
    const existing = this.resolveMatchingOverride(store, identity);
    if (existing) {
      return existing;
    }

    const created: StoredUserOverride = {
      branchId: identity.branchId,
      employeeCode: identity.employeeCode ?? '',
      updatedAt: new Date().toISOString(),
    };
    store.userOverrides[identity.id] = created;
    return created;
  }

  private resolveMatchingOverride(
    store: AccountStore,
    identity: AccountIdentity,
  ) {
    const override = store.userOverrides[identity.id];
    if (
      !override ||
      override.branchId !== identity.branchId ||
      override.employeeCode !== (identity.employeeCode ?? '')
    ) {
      return undefined;
    }

    return override;
  }

  private async mutateStore<T>(
    mutator: (store: AccountStore) => Promise<T> | T,
  ): Promise<T> {
    let result!: T;

    const runMutation = async () => {
      const store = await this.readStore();
      result = await mutator(store);
      store.lastUpdatedAt = new Date().toISOString();
      await this.writeStore(store);
    };

    const next = this.writeQueue.then(runMutation, runMutation);
    this.writeQueue = next.then(
      () => undefined,
      () => undefined,
    );

    await next;
    return result;
  }

  private resolveStorageFilePath() {
    if (process.env.ACCOUNT_STORAGE_FILE) {
      return process.env.ACCOUNT_STORAGE_FILE;
    }

    const cwd = process.cwd();
    if (cwd.endsWith(join('apps', 'api-nestjs'))) {
      return join(cwd, 'storage', 'account-settings.json');
    }

    return join(cwd, 'apps', 'api-nestjs', 'storage', 'account-settings.json');
  }

  private async readStore(): Promise<AccountStore> {
    await this.ensureStoreFile();
    const content = await readFile(this.storageFilePath, 'utf8');
    const parsed = JSON.parse(content) as Partial<AccountStore>;

    return {
      version: 1,
      branches: parsed.branches ?? {},
      userOverrides: parsed.userOverrides ?? {},
      lastUpdatedAt: parsed.lastUpdatedAt ?? new Date().toISOString(),
    };
  }

  private async writeStore(store: AccountStore) {
    await mkdir(dirname(this.storageFilePath), { recursive: true });
    const tempPath = `${this.storageFilePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    await rename(tempPath, this.storageFilePath);
  }

  private async ensureStoreFile() {
    try {
      await stat(this.storageFilePath);
    } catch {
      const seedStore: AccountStore = {
        version: 1,
        branches: {},
        userOverrides: {},
        lastUpdatedAt: new Date().toISOString(),
      };
      await mkdir(dirname(this.storageFilePath), { recursive: true });
      await writeFile(
        this.storageFilePath,
        `${JSON.stringify(seedStore, null, 2)}\n`,
        'utf8',
      );
    }
  }
}
