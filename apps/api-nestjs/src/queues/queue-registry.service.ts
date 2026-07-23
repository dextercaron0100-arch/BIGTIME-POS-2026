import { Injectable } from '@nestjs/common';
import { queueNames } from './queue.constants';

@Injectable()
export class QueueRegistryService {
  listQueues() {
    return [
      {
        name: queueNames.reports,
        description: 'Sales summaries, branch comparisons, and PDF exports.',
      },
      {
        name: queueNames.imports,
        description: 'CSV item imports and opening stock staging jobs.',
      },
      {
        name: queueNames.birEsales,
        description: 'Monthly eSales CSV generation and filing preparation.',
      },
      {
        name: queueNames.birEis,
        description:
          'EIS payload signing, submission retries, and acknowledgment tracking.',
      },
    ];
  }
}
