import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { PosModule } from '../pos/pos.module';
import { RealtimeModule } from '../../realtime/realtime.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [CatalogModule, PosModule, RealtimeModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
