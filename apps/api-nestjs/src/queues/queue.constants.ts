export const queueNames = {
  reports: 'reports',
  imports: 'imports',
  birEsales: 'bir-esales',
  birEis: 'bir-eis',
} as const;

export type QueueName = (typeof queueNames)[keyof typeof queueNames];
