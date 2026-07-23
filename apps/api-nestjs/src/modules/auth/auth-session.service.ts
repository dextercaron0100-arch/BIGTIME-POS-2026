import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { UserRole } from '@apex-pos/shared-types';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';

type StoredAuthSession = {
  id: string;
  userId: string;
  branchId: string;
  employeeCode: string;
  name: string;
  role: UserRole;
  terminalId: string;
  terminalName: string;
  platform: string;
  appVersion: string;
  createdAt: string;
  lastSeenAt: string;
  revokedAt?: string;
  revokedReason?: string;
  refreshTokenIdHash?: string;
};

type AuthSessionStore = {
  version: 1;
  sessions: Record<string, StoredAuthSession>;
  lastUpdatedAt: string;
};

type CreateAuthSessionInput = {
  userId: string;
  branchId: string;
  employeeCode: string;
  name: string;
  role: UserRole;
  terminalId: string;
  terminalName?: string;
  platform?: string;
  appVersion?: string;
  refreshTokenId: string;
};

type AuthSessionIdentity = {
  userId: string;
  branchId: string;
  currentSessionId?: string;
};

@Injectable()
export class AuthSessionService {
  private readonly storageFilePath = this.resolveStorageFilePath();
  private readonly touchIntervalMs = 60_000;
  private writeQueue = Promise.resolve();

  async createSession(input: CreateAuthSessionInput) {
    const normalizedTerminalId = input.terminalId.trim().toLowerCase();
    const fallbackTerminalName = this.presentTerminalName(normalizedTerminalId);
    const terminalName = input.terminalName?.trim() || fallbackTerminalName;
    const platform = this.normalizePlatform(
      input.platform,
      normalizedTerminalId,
    );
    const appVersion = input.appVersion?.trim() ?? '';

    return this.mutateStore((store) => {
      const now = new Date().toISOString();

      for (const session of Object.values(store.sessions)) {
        if (
          session.userId === input.userId &&
          session.branchId === input.branchId &&
          session.revokedAt == null
        ) {
          session.revokedAt = now;
          session.revokedReason = 'replaced-by-new-login';
        }
      }

      const session: StoredAuthSession = {
        id: `sess-${randomUUID()}`,
        userId: input.userId,
        branchId: input.branchId,
        employeeCode: input.employeeCode.trim().toUpperCase(),
        name: input.name.trim(),
        role: input.role,
        terminalId: normalizedTerminalId,
        terminalName,
        platform,
        appVersion,
        createdAt: now,
        lastSeenAt: now,
        refreshTokenIdHash: this.hashTokenId(input.refreshTokenId),
      };

      store.sessions[session.id] = session;
      return this.presentSession(session);
    });
  }

  async assertTrackedSessionActive(
    sessionId: string,
    identity: Omit<AuthSessionIdentity, 'currentSessionId'>,
  ) {
    const store = await this.readStore();
    const session = store.sessions[sessionId];

    if (!session || session.revokedAt) {
      throw new UnauthorizedException(
        'This session has been signed out. Please login again.',
      );
    }

    if (
      session.userId !== identity.userId ||
      session.branchId !== identity.branchId
    ) {
      throw new UnauthorizedException('Session does not belong to this user.');
    }

    const lastSeenAtMs = Date.parse(session.lastSeenAt);
    const now = Date.now();
    if (
      !Number.isFinite(lastSeenAtMs) ||
      now - lastSeenAtMs >= this.touchIntervalMs
    ) {
      await this.mutateStore((mutableStore) => {
        const mutableSession = mutableStore.sessions[sessionId];
        if (!mutableSession || mutableSession.revokedAt) {
          return;
        }
        mutableSession.lastSeenAt = new Date(now).toISOString();
      });
    }

    return this.presentSession(session);
  }

  async listActiveSessions(identity: AuthSessionIdentity) {
    const store = await this.readStore();
    const sessions = Object.values(store.sessions)
      .filter(
        (session) =>
          session.userId === identity.userId &&
          session.branchId === identity.branchId &&
          session.revokedAt == null,
      )
      .sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt))
      .map((session) => ({
        ...this.presentSession(session),
        isCurrent:
          identity.currentSessionId != null &&
          session.id === identity.currentSessionId,
      }));

    return {
      currentSessionId: identity.currentSessionId ?? null,
      sessions,
    };
  }

  async revokeOtherSessions(identity: AuthSessionIdentity) {
    if (!identity.currentSessionId) {
      throw new BadRequestException(
        'Current session is not tracked yet. Please login again first.',
      );
    }

    return this.mutateStore((store) => {
      const now = new Date().toISOString();
      let revokedCount = 0;

      for (const session of Object.values(store.sessions)) {
        if (
          session.userId !== identity.userId ||
          session.branchId !== identity.branchId ||
          session.revokedAt != null ||
          session.id === identity.currentSessionId
        ) {
          continue;
        }

        session.revokedAt = now;
        session.revokedReason = 'signed-out-from-pos';
        revokedCount += 1;
      }

      return {
        revokedCount,
        message:
          revokedCount == 0
            ? 'No other active devices were using this account.'
            : 'Signed out other devices using this account.',
      };
    });
  }

  async revokeSession(identity: AuthSessionIdentity, sessionId: string) {
    if (identity.currentSessionId && sessionId === identity.currentSessionId) {
      throw new BadRequestException(
        'Use the normal sign-out flow for this device.',
      );
    }

    return this.mutateStore((store) => {
      const session = store.sessions[sessionId];
      if (
        !session ||
        session.userId !== identity.userId ||
        session.branchId !== identity.branchId
      ) {
        throw new BadRequestException('That login session was not found.');
      }

      if (session.revokedAt != null) {
        return {
          revoked: false,
          sessionId,
          message: 'That device is already signed out.',
        };
      }

      session.revokedAt = new Date().toISOString();
      session.revokedReason = 'signed-out-from-pos';

      return {
        revoked: true,
        sessionId,
        message: 'Device signed out successfully.',
      };
    });
  }

  async revokeAllSessions(
    identity: Omit<AuthSessionIdentity, 'currentSessionId'>,
    reason: string,
  ) {
    return this.mutateStore((store) => {
      const now = new Date().toISOString();
      let revokedCount = 0;

      for (const session of Object.values(store.sessions)) {
        if (
          session.userId !== identity.userId ||
          session.branchId !== identity.branchId ||
          session.revokedAt != null
        ) {
          continue;
        }

        session.revokedAt = now;
        session.revokedReason = reason;
        revokedCount += 1;
      }

      return { revokedCount };
    });
  }

  async rotateRefreshToken(
    sessionId: string,
    identity: Omit<AuthSessionIdentity, 'currentSessionId'>,
    currentTokenId: string,
    nextTokenId: string,
  ) {
    const result = await this.mutateStore((store) => {
      const session = store.sessions[sessionId];
      if (
        !session ||
        session.revokedAt != null ||
        session.userId !== identity.userId ||
        session.branchId !== identity.branchId
      ) {
        return { valid: false };
      }

      const presentedHash = this.hashTokenId(currentTokenId);
      const storedHash = session.refreshTokenIdHash ?? '';
      const presented = Buffer.from(presentedHash, 'hex');
      const stored = Buffer.from(storedHash, 'hex');
      const matches =
        presented.length === stored.length &&
        presented.length > 0 &&
        timingSafeEqual(presented, stored);

      if (!matches) {
        session.revokedAt = new Date().toISOString();
        session.revokedReason = 'refresh-token-reuse-detected';
        return { valid: false };
      }

      session.refreshTokenIdHash = this.hashTokenId(nextTokenId);
      session.lastSeenAt = new Date().toISOString();
      return { valid: true };
    });

    if (!result.valid) {
      throw new UnauthorizedException(
        'Refresh token was already used or the session is no longer active.',
      );
    }
  }

  private hashTokenId(tokenId: string) {
    return createHash('sha256').update(tokenId).digest('hex');
  }

  private normalizePlatform(value: string | undefined, terminalId: string) {
    const normalized = value?.trim().toLowerCase();
    if (normalized && normalized.length > 0) {
      return normalized;
    }

    if (terminalId.includes('android')) {
      return 'android';
    }
    if (terminalId.includes('windows')) {
      return 'windows';
    }
    if (terminalId.includes('dashboard') || terminalId.includes('web')) {
      return 'web';
    }
    return 'device';
  }

  private presentSession(session: StoredAuthSession) {
    return {
      id: session.id,
      terminalId: session.terminalId,
      terminalName: session.terminalName,
      platform: session.platform,
      appVersion: session.appVersion,
      employeeCode: session.employeeCode,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
    };
  }

  private presentTerminalName(terminalId: string) {
    if (terminalId.includes('android')) {
      return 'Android POS';
    }
    if (terminalId.includes('windows')) {
      return 'Windows POS';
    }
    if (terminalId.includes('dashboard') || terminalId.includes('web')) {
      return 'Back Office Web';
    }
    return terminalId;
  }

  private async mutateStore<T>(
    mutator: (store: AuthSessionStore) => Promise<T> | T,
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
    if (process.env.AUTH_SESSION_STORAGE_FILE) {
      return process.env.AUTH_SESSION_STORAGE_FILE;
    }

    const cwd = process.cwd();
    if (cwd.endsWith(join('apps', 'api-nestjs'))) {
      return join(cwd, 'storage', 'auth-sessions.json');
    }

    return join(cwd, 'apps', 'api-nestjs', 'storage', 'auth-sessions.json');
  }

  private async readStore(): Promise<AuthSessionStore> {
    await this.ensureStoreFile();
    const content = await readFile(this.storageFilePath, 'utf8');
    const parsed = JSON.parse(content) as Partial<AuthSessionStore>;

    return {
      version: 1,
      sessions: parsed.sessions ?? {},
      lastUpdatedAt: parsed.lastUpdatedAt ?? new Date().toISOString(),
    };
  }

  private async writeStore(store: AuthSessionStore) {
    await mkdir(dirname(this.storageFilePath), { recursive: true });
    const tempPath = `${this.storageFilePath}.tmp`;
    const payload = `${JSON.stringify(store, null, 2)}\n`;

    await writeFile(tempPath, payload, 'utf8');
    try {
      await rename(tempPath, this.storageFilePath);
    } catch (error) {
      if (!this.isAtomicWriteRetryable(error)) {
        throw error;
      }

      // OneDrive and other sync tools can briefly block atomic renames on Windows.
      // Fall back to a direct write so tracked sessions keep updating instead of failing.
      await writeFile(this.storageFilePath, payload, 'utf8');
      await this.removeTempFile(tempPath);
    }
  }

  private async ensureStoreFile() {
    try {
      await stat(this.storageFilePath);
    } catch {
      const seedStore: AuthSessionStore = {
        version: 1,
        sessions: {},
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

  private isAtomicWriteRetryable(error: unknown) {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const code =
      'code' in error ? String((error as { code?: unknown }).code) : '';
    return code === 'EPERM' || code === 'EACCES' || code === 'EBUSY';
  }

  private async removeTempFile(tempPath: string) {
    try {
      await unlink(tempPath);
    } catch {
      // Best effort cleanup only.
    }
  }
}
