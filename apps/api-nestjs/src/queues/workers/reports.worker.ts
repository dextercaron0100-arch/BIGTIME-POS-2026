import { queueNames } from '../queue.constants';

export function buildReportsWorkerBlueprint() {
  return {
    queue: queueNames.reports,
    concurrency: 4,
    jobs: ['daily-sales', 'branch-comparison', 'cash-balancing'],
  };
}
