import { z } from "zod";
import type { JobContext } from "./context.js";

/** RS-202 — Core Web Vitals per template from CrUX + PageSpeed Insights. */
export const cwvSyncJobSchema = z.object({
  type: z.literal("cwv_sync"),
  agencyId: z.string().uuid(),
  clientId: z.string().uuid(),
});
export type CwvSyncJob = z.infer<typeof cwvSyncJobSchema>;

export async function runCwvSyncJob(job: CwvSyncJob, ctx: JobContext): Promise<void> {
  // TODO(phase2): CrUX for origin/URL field data, PSI for templates without it; upsert cwv_metrics.
  ctx.log.info({ clientId: job.clientId }, "cwv-sync: not yet implemented");
}
