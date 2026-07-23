import { UnauthorizedException } from '@nestjs/common';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AuthSessionService } from './auth-session.service';

describe('AuthSessionService refresh rotation', () => {
  let tempDirectory: string;
  let service: AuthSessionService;

  beforeEach(async () => {
    tempDirectory = await mkdtemp(join(tmpdir(), 'bigtime-auth-session-'));
    process.env.AUTH_SESSION_STORAGE_FILE = join(
      tempDirectory,
      'auth-sessions.json',
    );
    service = new AuthSessionService();
  });

  afterEach(async () => {
    delete process.env.AUTH_SESSION_STORAGE_FILE;
    await rm(tempDirectory, { recursive: true, force: true });
  });

  async function createTrackedSession() {
    return service.createSession({
      userId: 'user-1',
      branchId: 'branch-manila',
      employeeCode: 'ADM100',
      name: 'Admin User',
      role: 'ADMIN',
      terminalId: 'dashboard-web',
      refreshTokenId: 'refresh-token-1',
    });
  }

  it('accepts exactly one refresh-token rotation', async () => {
    const session = await createTrackedSession();

    await expect(
      service.rotateRefreshToken(
        session.id,
        { userId: 'user-1', branchId: 'branch-manila' },
        'refresh-token-1',
        'refresh-token-2',
      ),
    ).resolves.toBeUndefined();
  });

  it('revokes the session when an old refresh token is replayed', async () => {
    const session = await createTrackedSession();
    const identity = { userId: 'user-1', branchId: 'branch-manila' };

    await service.rotateRefreshToken(
      session.id,
      identity,
      'refresh-token-1',
      'refresh-token-2',
    );
    await expect(
      service.rotateRefreshToken(
        session.id,
        identity,
        'refresh-token-1',
        'refresh-token-3',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.assertTrackedSessionActive(session.id, identity),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
