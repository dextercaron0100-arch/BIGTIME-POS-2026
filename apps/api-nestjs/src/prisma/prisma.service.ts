import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    super({
      log: ['warn', 'error'],
      datasources: {
        db: {
          url:
            process.env.DATABASE_URL ??
            'postgresql://postgres:postgres@localhost:5432/apex_pos?schema=public',
        },
      },
    });
  }
}
