import { z } from "zod";
import type { JobContext } from "./context.js";

/** RS-107 — daily Search Console sync (read-only OAuth, token from Vault). */
export const gscSyncJobSchema = z.object({
  type: z.literal("gsc_sync"),
  agencyId: z.string().uuid(),
  clientId: z.string().uuid(),
  backfillMonths: z.number().int().min(0).max(16).default(0),
});
export type GscSyncJob = z.infer<typeof gscSyncJobSchema>;

export async function runGscSyncJob(job: GscSyncJob, ctx: JobContext): Promise<void> {
  // TODO(phase1): refresh OAuth token from Vault, call Search Console API, upsert gsc_daily.
  ctx.log.info({ clientId: job.clientId }, "gsc-sync: not yet implemented");
}
