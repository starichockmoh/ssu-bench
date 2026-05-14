export const NotificationEventType = {
  TaskCreated: 'task.created',
  BidCreated: 'bid.created',
  BidSelected: 'bid.selected',
  TaskCompletedByContractor: 'task.completed_by_contractor',
  TaskConfirmed: 'task.confirmed',
  PaymentCompleted: 'payment.completed',
  UserBlocked: 'user.blocked',
  TechnicalTest: 'technical.test',
} as const;
