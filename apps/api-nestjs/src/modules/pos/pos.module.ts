import { Module } from '@nestjs/common';
import { RealtimeModule } from '../../realtime/realtime.module';
import { PosController } from './pos.controller';
import { PosLedgerService } from './pos-ledger.service';
import { PosService } from './pos.service';
import { PosTerminalSettingsService } from './pos-terminal-settings.service';

@Module({
  imports: [RealtimeModule],
  controllers: [PosController],
  providers: [PosLedgerService, PosService, PosTerminalSettingsService],
  exports: [PosLedgerService],
})
export class PosModule {}
