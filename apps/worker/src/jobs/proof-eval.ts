import { z } from "zod";
import { computeLift, type LiftMetric } from "@rootspun/core";
import type { JobContext } from "./context.js";

/**
 * RS-401 — measure a shipped fix's lift at a window boundary using
 * difference-in-differences vs a control group, and store the outcome.
 * The treated/control before/after figures are gathered upstream (from
 * scores_daily, citations and gsc_daily over the frozen baseline and window).
 */
export const proofEvalJobSchema = z.object({
  type: z.literal("proof_eval"),
  agencyId: z.string().uuid(),
  fixId: z.string().uuid(),
  metric: z.enum(["uvs", "citations", "gsc_clicks"]),
  treatedBefore: z.number(),
  treatedAfter: z.number(),
  controlBefore: z.number(),
  controlAfter: z.number(),
  windowDays: z.number().int().default(14),
});
export type ProofEvalJob = z.infer<typeof proofEvalJobSchema>;

export async function runProofEvalJob(job: ProofEvalJob, ctx: JobContext): Promise<void> {
  const lift = computeLift({
    metric: job.metric as LiftMetric,
    treatedBefore: job.treatedBefore,
    treatedAfter: job.treatedAfter,
    controlBefore: job.controlBefore,
    controlAfter: job.controlAfter,
  });

  const { error } = await ctx.db.from("fix_outcomes").insert({
    agency_id: job.agencyId,
    fix_id: job.fixId,
    metric: job.metric,
    before: job.treatedBefore,
    after: job.treatedAfter,
    window_days: job.windowDays,
  });
  if (error) throw new Error(`proof-eval insert: ${error.message}`);

  ctx.log.info(
    { fixId: job.fixId, metric: job.metric, netLift: lift.netLift, windowDays: job.windowDays },
    "proof-eval: recorded fix outcome",
  );
}
