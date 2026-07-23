import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { join } from 'node:path';
import { BranchAccessGuard } from './common/guards/branch-access.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TrialGuard } from './common/guards/trial.guard';
import { HealthModule } from './health/health.module';
import { AccountModule } from './modules/account/account.module';
import { AuthModule } from './modules/auth/auth.module';
import { BirModule } from './modules/bir/bir.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CustomerDisplayModule } from './modules/customer-display/customer-display.module';
import { EisModule } from './modules/eis/eis.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { SignupModule } from './modules/organizations/signup.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PosModule } from './modules/pos/pos.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SyncModule } from './modules/sync/sync.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queues/queue.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), '.env.local'),
        join(process.cwd(), '.env'),
        join(process.cwd(), 'apps/api-nestjs/.env.local'),
        join(process.cwd(), 'apps/api-nestjs/.env'),
      ],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    QueueModule,
    RealtimeModule,
    HealthModule,
    AccountModule,
    AuthModule,
    PosModule,
    CatalogModule,
    CustomerDisplayModule,
    EisModule,
    InventoryModule,
    EmployeesModule,
    OrganizationsModule,
    SignupModule,
    PricingModule,
    PaymentsModule,
    ReportsModule,
    BirModule,
    SyncModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: BranchAccessGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TrialGuard,
    },
  ],
})
export class AppModule {}
