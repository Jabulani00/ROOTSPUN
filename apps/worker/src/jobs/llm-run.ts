import { z } from "zod";
import type { EngineCode } from "@rootspun/core";
import { getLlmProvider } from "../providers/index.js";
import { recordUsage, isOverPlanLimit } from "../usage.js";
import type { JobContext } from "./context.js";

/** RS-104 — sample answers from ChatGPT, Gemini, Perplexity (3 runs per engine). */
export const llmRunJobSchema = z.object({
  type: z.literal("llm_run"),
  agencyId: z.string().uuid(),
  clientId: z.string().uuid(),
  promptId: z.string().uuid(),
  prompt: z.string(),
  engine: z.enum(["chatgpt", "gemini", "perplexity", "claude", "copilot"]),
  samples: z.number().int().min(1).max(5).default(3),
});
export type LlmRunJob = z.infer<typeof llmRunJobSchema>;

export async function runLlmJob(job: LlmRunJob, ctx: JobContext): Promise<void> {
  if (await isOverPlanLimit(ctx, job.agencyId)) {
    ctx.log.warn({ agencyId: job.agencyId }, "llm-run: plan limit reached, skipping");
    return;
  }
  const provider = getLlmProvider(job.engine as EngineCode, ctx.env);
  for (let i = 0; i < job.samples; i++) {
    const answer = await provider.sample({ prompt: job.prompt });
    // TODO(phase1): store raw answer to Storage, enqueue extract job.
    await recordUsage(ctx, { agencyId: job.agencyId, kind: "prompt_run", costUsd: answer.costUsd });
  }
}
