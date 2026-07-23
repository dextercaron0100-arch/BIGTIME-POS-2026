import { Module } from '@nestjs/common';
import { PosModule } from '../pos/pos.module';
import { BirSettingsService } from './bir-settings.service';
import { BirController } from './bir.controller';
import { BirService } from './bir.service';

@Module({
  imports: [PosModule],
  controllers: [BirController],
  providers: [BirService, BirSettingsService],
})
export class BirModule {}
