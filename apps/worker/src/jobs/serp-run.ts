import { z } from "zod";
import { getSerpProvider } from "../providers/index.js";
import { recordUsage, isOverPlanLimit } from "../usage.js";
import type { JobContext } from "./context.js";

/** RS-103 — track a prompt in Google organic, AI Overviews and AI Mode. */
export const serpRunJobSchema = z.object({
  type: z.literal("serp_run"),
  agencyId: z.string().uuid(),
  clientId: z.string().uuid(),
  promptId: z.string().uuid(),
  prompt: z.string(),
  country: z.string().default("ZA"),
  language: z.string().default("en"),
});
export type SerpRunJob = z.infer<typeof serpRunJobSchema>;

export async function runSerpJob(job: SerpRunJob, ctx: JobContext): Promise<void> {
  if (await isOverPlanLimit(ctx, job.agencyId)) {
    ctx.log.warn({ agencyId: job.agencyId }, "serp-run: plan limit reached, skipping");
    return;
  }
  const provider = getSerpProvider(ctx.env);
  const result = await provider.run({ prompt: job.prompt, country: job.country, language: job.language });
  // TODO(phase1): persist runs + citations rows from `result`.
  await recordUsage(ctx, { agencyId: job.agencyId, kind: "prompt_run", costUsd: result.costUsd });
}
