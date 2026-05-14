export enum IncomingEventStatus {
  PROCESSED = 'processed',
  DUPLICATE = 'duplicate',
  INVALID = 'invalid',
  DLQ = 'dlq',
}
