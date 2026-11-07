import type { Logger } from "../logger.js";
import type { QueueDriver } from "./types.js";

/** NFR-06: every worker job retried 3 times, then dead-lettered. */
export const MAX_ATTEMPTS = 3;
/** Base visibility timeout; backoff multiplies this by 2^attempt. */
export const BASE_VT_SECONDS = 30;

export type ProcessStatus = "empty" | "ok" | "retry" | "dead_letter";

export interface ProcessResult {
  status: ProcessStatus;
  msgId?: number;
  attempt?: number;
}

export type JobHandler<T> = (payload: T) => Promise<void>;

/** Exponential backoff delay for the next retry of a message on its Nth read. */
export function backoffSeconds(readCt: number): number {
  return BASE_VT_SECONDS * 2 ** Math.max(readCt - 1, 0);
}

/**
 * Read and process a single message from `queue`. On handler failure the message
 * is left on the queue with an increased visibility timeout (backoff) until it
 * has been delivered MAX_ATTEMPTS times, after which it is dead-lettered.
 */
export async function processOnce<T>(
  driver: QueueDriver,
  queue: string,
  handler: JobHandler<T>,
  log: Logger,
): Promise<ProcessResult> {
  const msg = await driver.read<T>(queue, BASE_VT_SECONDS);
  if (!msg) return { status: "empty" };

  const child = log.child({ queue, msgId: msg.msgId, attempt: msg.readCt });
  try {
    await handler(msg.payload);
    await driver.archive(queue, msg.msgId);
    child.info("job ok");
    return { status: "ok", msgId: msg.msgId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (msg.readCt >= MAX_ATTEMPTS) {
      await driver.deadLetter(queue, msg.payload, message);
      await driver.archive(queue, msg.msgId);
      child.error({ err: message }, "job dead-lettered");
      return { status: "dead_letter", msgId: msg.msgId, attempt: msg.readCt };
    }
    await driver.setVt(queue, msg.msgId, backoffSeconds(msg.readCt));
    child.warn({ err: message, retryIn: backoffSeconds(msg.readCt) }, "job failed, will retry");
    return { status: "retry", msgId: msg.msgId, attempt: msg.readCt };
  }
}

/**
 * Continuously drain a queue until stopped. Sleeps `idleMs` when the queue is
 * empty to avoid hot-looping.
 */
export async function runConsumer<T>(
  driver: QueueDriver,
  queue: string,
  handler: JobHandler<T>,
  log: Logger,
  opts: { signal: AbortSignal; idleMs?: number },
): Promise<void> {
  const idleMs = opts.idleMs ?? 1000;
  while (!opts.signal.aborted) {
    const result = await processOnce(driver, queue, handler, log);
    if (result.status === "empty") {
      await sleep(idleMs, opts.signal);
    }
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });
}
