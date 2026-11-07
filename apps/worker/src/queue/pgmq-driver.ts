import type { RootspunClient } from "@rootspun/db";
import type { QueueDriver, QueueMessage } from "./types.js";

/**
 * Supabase Queues (pgmq) driver. Uses the pgmq_public RPC surface that Supabase
 * exposes (pgmq.send / read / archive / set_vt). Dead letters go to a
 * conventionally-named `<queue>_dlq`.
 *
 * Note: the `rpc` calls are typed loosely because the pgmq functions are not in
 * the generated public schema types; payloads are validated by each job handler.
 */
export class PgmqDriver implements QueueDriver {
  constructor(private db: RootspunClient) {}

  private rpc<T = unknown>(fn: string, args: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.db as any).schema("pgmq_public").rpc(fn, args) as Promise<{
      data: T;
      error: { message: string } | null;
    }>;
  }

  async read<T>(queue: string, vtSeconds: number): Promise<QueueMessage<T> | null> {
    const { data, error } = await this.rpc<
      { msg_id: number; read_ct: number; message: T }[]
    >("read", { queue_name: queue, sleep_seconds: vtSeconds, n: 1 });
    if (error) throw new Error(`pgmq read: ${error.message}`);
    const row = data?.[0];
    if (!row) return null;
    return { msgId: row.msg_id, readCt: row.read_ct, payload: row.message };
  }

  async archive(queue: string, msgId: number): Promise<void> {
    const { error } = await this.rpc("archive", { queue_name: queue, msg_id: msgId });
    if (error) throw new Error(`pgmq archive: ${error.message}`);
  }

  async setVt(queue: string, msgId: number, vtSeconds: number): Promise<void> {
    const { error } = await this.rpc("set_vt", {
      queue_name: queue,
      msg_id: msgId,
      vt_offset: vtSeconds,
    });
    if (error) throw new Error(`pgmq set_vt: ${error.message}`);
  }

  async send<T>(queue: string, payload: T, delaySeconds = 0): Promise<void> {
    const { error } = await this.rpc("send", {
      queue_name: queue,
      message: payload,
      sleep_seconds: delaySeconds,
    });
    if (error) throw new Error(`pgmq send: ${error.message}`);
  }

  async deadLetter<T>(queue: string, payload: T, errorMsg: string): Promise<void> {
    await this.send(`${queue}_dlq`, { payload, error: errorMsg, failedAt: new Date().toISOString() });
  }
}
