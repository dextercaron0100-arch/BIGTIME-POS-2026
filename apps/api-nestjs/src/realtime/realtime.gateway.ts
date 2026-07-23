import {
  MessageBody,
  SubscribeMessage,
  ConnectedSocket,
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { AuthSessionService } from '../modules/auth/auth-session.service';
import { OrganizationsService } from '../modules/organizations/organizations.service';

const isProduction =
  process.env.NODE_ENV?.trim().toLowerCase() === 'production';
const allowedRealtimeOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

const realtimeCorsOrigin =
  allowedRealtimeOrigins.length > 0 ? allowedRealtimeOrigins : !isProduction;

type RealtimeJwtPayload = {
  sub: string;
  branchId: string;
  sessionId: string;
  role: string;
  tokenType: 'access';
};

type AuthenticatedSocketData = {
  userId: string;
  branchIds: string[];
};

@WebSocketGateway({
  cors: {
    origin: realtimeCorsOrigin,
    credentials: true,
  },
  namespace: 'realtime',
})
export class RealtimeGateway implements OnGatewayConnection {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authSessionService: AuthSessionService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  @WebSocketServer()
  server!: Server;

  async handleConnection(client: Socket) {
    try {
      const token = this.readHandshakeToken(client);
      const secret = this.configService.get<string>('JWT_SECRET')?.trim();
      const payload = await this.jwtService.verifyAsync<RealtimeJwtPayload>(
        token,
        {
          secret: secret || 'apex-pos-dev-secret',
          algorithms: ['HS256'],
        },
      );
      if (
        payload.tokenType !== 'access' ||
        !payload.sub ||
        !payload.branchId ||
        !payload.sessionId ||
        !payload.role
      ) {
        throw new Error('Malformed realtime token.');
      }

      await this.authSessionService.assertTrackedSessionActive(
        payload.sessionId,
        { userId: payload.sub, branchId: payload.branchId },
      );
      const organization = await this.organizationsService.findByBranchId(
        payload.branchId,
      );
      if (!organization) {
        throw new Error('Branch has no organization.');
      }

      const elevatedRoles = new Set(['ADMIN', 'SUPERVISOR', 'AUDITOR']);
      const branchIds = elevatedRoles.has(payload.role)
        ? organization.branchIds
        : [payload.branchId];
      (client.data as AuthenticatedSocketData).userId = payload.sub;
      (client.data as AuthenticatedSocketData).branchIds = branchIds;
      for (const branchId of branchIds) {
        await client.join(this.branchRoom(branchId));
      }
    } catch {
      client.disconnect(true);
    }
  }

  broadcastCatalogRefresh(branchId: string) {
    this.server.to(this.branchRoom(branchId)).emit('catalog.refresh', {
      branchId,
      refreshedAt: new Date().toISOString(),
    });
  }

  broadcastTransactionCreated(branchId: string, transactionId: string) {
    this.server.to(this.branchRoom(branchId)).emit('transaction.created', {
      branchId,
      transactionId,
      createdAt: new Date().toISOString(),
    });
  }

  broadcastTransactionVoided(branchId: string, transactionId: string) {
    this.server.to(this.branchRoom(branchId)).emit('transaction.voided', {
      branchId,
      transactionId,
      voidedAt: new Date().toISOString(),
    });
  }

  broadcastTransactionRefunded(branchId: string, transactionId: string) {
    this.server.to(this.branchRoom(branchId)).emit('transaction.refunded', {
      branchId,
      transactionId,
      refundedAt: new Date().toISOString(),
    });
  }

  broadcastSyncBatchProcessed(
    branchId: string,
    terminalId: string,
    acceptedCount: number,
  ) {
    this.server.to(this.branchRoom(branchId)).emit('sync.batch.processed', {
      branchId,
      terminalId,
      acceptedCount,
      processedAt: new Date().toISOString(),
    });
  }

  broadcastInventoryUpdated(branchId: string) {
    this.server.to(this.branchRoom(branchId)).emit('inventory.updated', {
      branchId,
      updatedAt: new Date().toISOString(),
    });
  }

  broadcastShiftOpened(branchId: string, terminalId: string) {
    this.server.to(this.branchRoom(branchId)).emit('shift.opened', {
      branchId,
      terminalId,
      openedAt: new Date().toISOString(),
    });
  }

  broadcastShiftClosed(branchId: string, terminalId: string) {
    this.server.to(this.branchRoom(branchId)).emit('shift.closed', {
      branchId,
      terminalId,
      closedAt: new Date().toISOString(),
    });
  }

  @SubscribeMessage('catalog.refresh')
  handleCatalogRefresh(
    @MessageBody() payload: { branchId: string; source?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const branchIds = (client.data as AuthenticatedSocketData).branchIds ?? [];
    const normalizedBranchId = payload.branchId?.trim().toLowerCase();
    if (!normalizedBranchId || !branchIds.includes(normalizedBranchId)) {
      return { acknowledged: false };
    }
    return {
      acknowledged: true,
      branchId: normalizedBranchId,
      source: payload.source ?? 'unknown',
    };
  }

  private readHandshakeToken(client: Socket) {
    const handshakeAuth = client.handshake.auth as Record<string, unknown>;
    const authToken = handshakeAuth.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }

    const authorization = client.handshake.headers.authorization;
    if (authorization?.startsWith('Bearer ')) {
      return authorization.slice('Bearer '.length).trim();
    }

    throw new Error('Missing realtime token.');
  }

  private branchRoom(branchId: string) {
    return `branch:${branchId.trim().toLowerCase()}`;
  }
}
