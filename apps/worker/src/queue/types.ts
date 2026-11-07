/** A message read from a queue. `readCt` is how many times it has been delivered. */
export interface QueueMessage<T> {
  msgId: number;
  readCt: number;
  payload: T;
}

/**
 * Minimal queue contract the consumer depends on. Implemented by the pgmq driver
 * (Supabase Queues) in production and an in-memory driver in tests, so the
 * retry/backoff/dead-letter logic is exercised without a database.
 */
export interface QueueDriver {
  /** Read one message, making it invisible for `vtSeconds`. Null if the queue is empty. */
  read<T>(queue: string, vtSeconds: number): Promise<QueueMessage<T> | null>;
  /** Remove a message from the queue after successful handling. */
  archive(queue: string, msgId: number): Promise<void>;
  /** Extend a message's invisibility (used for exponential backoff on retry). */
  setVt(queue: string, msgId: number, vtSeconds: number): Promise<void>;
  /** Enqueue a message, optionally delayed. */
  send<T>(queue: string, payload: T, delaySeconds?: number): Promise<void>;
  /** Move a permanently-failed payload to the dead-letter queue (NFR-06). */
  deadLetter<T>(queue: string, payload: T, error: string): Promise<void>;
}
