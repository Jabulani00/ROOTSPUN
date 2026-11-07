import type { RootspunClient } from "@rootspun/db";
import type { WorkerEnv } from "../env.js";
import type { Logger } from "../logger.js";
import type { QueueDriver } from "../queue/types.js";

/** Everything a job handler needs. The db client is the service-role client. */
export interface JobContext {
  db: RootspunClient;
  env: WorkerEnv;
  log: Logger;
  queue: QueueDriver;
}
