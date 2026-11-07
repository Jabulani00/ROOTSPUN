import { serviceClient } from "@rootspun/db";
import { loadEnv } from "./env.js";
import { logger } from "./logger.js";
import { dispatch } from "./jobs/registry.js";
import type { JobContext } from "./jobs/context.js";
import { PgmqDriver } from "./queue/pgmq-driver.js";
import { runConsumer } from "./queue/consumer.js";

/** The single queue all jobs flow through; pg_cron and the web app enqueue here. */
const JOBS_QUEUE = "rootspun_jobs";

async function main(): Promise<void> {
  const env = loadEnv();
  const db = serviceClient();
  const queue = new PgmqDriver(db);
  const ctx: JobContext = { db, env, log: logger, queue };

  const controller = new AbortController();
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => {
      logger.info({ sig }, "shutting down");
      controller.abort();
    });
  }

  logger.info({ queue: JOBS_QUEUE }, "worker started");
  await runConsumer(queue, JOBS_QUEUE, (payload) => dispatch(payload, ctx), logger, {
    signal: controller.signal,
  });
  logger.info("worker stopped");
}

main().catch((err) => {
  logger.error({ err: err instanceof Error ? err.message : String(err) }, "worker crashed");
  process.exitCode = 1;
});
