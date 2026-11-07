import type { QueueDriver, QueueMessage } from "./types.js";

interface Stored {
  msgId: number;
  readCt: number;
  visibleAt: number; // ms epoch
  payload: unknown;
}

/**
 * In-memory QueueDriver for tests. Honours visibility timeouts against an
 * injectable clock so backoff and dead-letter paths can be exercised
 * deterministically.
 */
export class MemoryQueueDriver implements QueueDriver {
  private queues = new Map<string, Stored[]>();
  private dlq = new Map<string, { payload: unknown; error: string }[]>();
  private seq = 0;

  constructor(private now: () => number = () => Date.now()) {}

  advance(ms: number): void {
    this._clockOffset += ms;
  }
  private _clockOffset = 0;
  private clock(): number {
    return this.now() + this._clockOffset;
  }

  private q(queue: string): Stored[] {
    let list = this.queues.get(queue);
    if (!list) this.queues.set(queue, (list = []));
    return list;
  }

  async read<T>(queue: string, vtSeconds: number): Promise<QueueMessage<T> | null> {
    const now = this.clock();
    const msg = this.q(queue).find((m) => m.visibleAt <= now);
    if (!msg) return null;
    msg.readCt += 1;
    msg.visibleAt = now + vtSeconds * 1000;
    return { msgId: msg.msgId, readCt: msg.readCt, payload: msg.payload as T };
  }

  async archive(queue: string, msgId: number): Promise<void> {
    this.queues.set(
      queue,
      this.q(queue).filter((m) => m.msgId !== msgId),
    );
  }

  async setVt(queue: string, msgId: number, vtSeconds: number): Promise<void> {
    const msg = this.q(queue).find((m) => m.msgId === msgId);
    if (msg) msg.visibleAt = this.clock() + vtSeconds * 1000;
  }

  async send<T>(queue: string, payload: T, delaySeconds = 0): Promise<void> {
    this.q(queue).push({
      msgId: ++this.seq,
      readCt: 0,
      visibleAt: this.clock() + delaySeconds * 1000,
      payload,
    });
  }

  async deadLetter<T>(queue: string, payload: T, error: string): Promise<void> {
    let list = this.dlq.get(queue);
    if (!list) this.dlq.set(queue, (list = []));
    list.push({ payload, error });
  }

  // Test helpers
  deadLettered(queue: string): { payload: unknown; error: string }[] {
    return this.dlq.get(queue) ?? [];
  }
  depth(queue: string): number {
    return this.q(queue).length;
  }
}
