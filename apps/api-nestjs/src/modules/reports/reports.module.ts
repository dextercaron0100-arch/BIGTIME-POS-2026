import { Module } from '@nestjs/common';
import { PosModule } from '../pos/pos.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [PosModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
