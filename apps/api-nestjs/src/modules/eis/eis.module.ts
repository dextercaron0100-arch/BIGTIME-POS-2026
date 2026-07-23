import { Global, Module } from '@nestjs/common';
import { EisSubmissionService } from './eis-submission.service';

@Global()
@Module({
  providers: [EisSubmissionService],
  exports: [EisSubmissionService],
})
export class EisModule {}
