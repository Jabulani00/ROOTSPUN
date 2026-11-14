import { z } from "zod";
import { compareFacts } from "@rootspun/core";
import type { JobContext } from "./context.js";

/**
 * RS-302 — check that brand facts are consistent across AI answers and top cited
 * pages. Canonical facts and observed values are supplied upstream (agency input
 * + LLM/web extraction); the comparison is the pure, unit-tested core function.
 */
export const entityCheckJobSchema = z.object({
  type: z.literal("entity_check"),
  agencyId: z.string().uuid(),
  clientId: z.string().uuid(),
  canonical: z.record(z.string()),
  observed: z
    .array(z.object({ field: z.string(), value: z.string(), source: z.string() }))
    .default([]),
});
export type EntityCheckJob = z.infer<typeof entityCheckJobSchema>;

export async function runEntityCheckJob(job: EntityCheckJob, ctx: JobContext): Promise<void> {
  const result = compareFacts(job.canonical, job.observed);
  // TODO(phase3): persist mismatches (field, expected, found, source) for the UI.
  ctx.log.info(
    {
      clientId: job.clientId,
      consistent: result.consistent.length,
      mismatches: result.mismatches.length,
      unverified: result.unverified.length,
    },
    "entity-check: compared brand facts",
  );
}
