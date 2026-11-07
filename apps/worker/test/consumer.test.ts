import { describe, expect, it } from "vitest";
import pino from "pino";
import { MemoryQueueDriver } from "../src/queue/memory-driver.js";
import {
  BASE_VT_SECONDS,
  MAX_ATTEMPTS,
  backoffSeconds,
  processOnce,
} from "../src/queue/consumer.js";
import type { Logger } from "../src/logger.js";

const log = pino({ level: "silent" }) as unknown as Logger;
const QUEUE = "test";

describe("backoffSeconds", () => {
  it("doubles each attempt from the base", () => {
    expect(backoffSeconds(1)).toBe(BASE_VT_SECONDS);
    expect(backoffSeconds(2)).toBe(BASE_VT_SECONDS * 2);
    expect(backoffSeconds(3)).toBe(BASE_VT_SECONDS * 4);
  });
});

describe("processOnce", () => {
  it("returns empty on an empty queue", async () => {
    const d = new MemoryQueueDriver();
    expect((await processOnce(d, QUEUE, async () => {}, log)).status).toBe("empty");
  });

  it("archives the message on success", async () => {
    const d = new MemoryQueueDriver();
    await d.send(QUEUE, { hello: "world" });
    const seen: unknown[] = [];
    const r = await processOnce(d, QUEUE, async (p) => void seen.push(p), log);
    expect(r.status).toBe("ok");
    expect(seen).toEqual([{ hello: "world" }]);
    expect(d.depth(QUEUE)).toBe(0);
  });

  it("retries with backoff, then dead-letters after MAX_ATTEMPTS", async () => {
    const d = new MemoryQueueDriver();
    await d.send(QUEUE, { work: 1 });
    const failing = async () => {
      throw new Error("boom");
    };

    // Attempt 1 → retry (message stays, invisible for backoff window)
    let r = await processOnce(d, QUEUE, failing, log);
    expect(r.status).toBe("retry");
    expect(r.attempt).toBe(1);
    expect(d.depth(QUEUE)).toBe(1);

    // Still invisible immediately after
    expect((await processOnce(d, QUEUE, failing, log)).status).toBe("empty");

    // Advance past backoff → attempt 2 → retry
    d.advance(backoffSeconds(1) * 1000 + 1);
    r = await processOnce(d, QUEUE, failing, log);
    expect(r.status).toBe("retry");
    expect(r.attempt).toBe(2);

    // Advance → attempt 3 (== MAX_ATTEMPTS) → dead-letter
    d.advance(backoffSeconds(2) * 1000 + 1);
    r = await processOnce(d, QUEUE, failing, log);
    expect(r.status).toBe("dead_letter");
    expect(r.attempt).toBe(MAX_ATTEMPTS);
    expect(d.depth(QUEUE)).toBe(0);
    expect(d.deadLettered(QUEUE)).toHaveLength(1);
    expect(d.deadLettered(QUEUE)[0]?.error).toContain("boom");
  });
});
