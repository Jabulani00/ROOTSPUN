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
  const { db, log, queue } = ctx;

  if (await isOverPlanLimit(ctx, job.agencyId)) {
    log.warn({ agencyId: job.agencyId }, "llm-run: plan limit reached, skipping");
    return;
  }

  const { data: engine } = await db.from("engines").select("id").eq("code", job.engine).maybeSingle();
  if (!engine) throw new Error(`Unknown engine: ${job.engine}`);

  const provider = getLlmProvider(job.engine as EngineCode, ctx.env);

  for (let i = 0; i < job.samples; i++) {
    const answer = await provider.sample({ prompt: job.prompt });

    const { data: run, error } = await db
      .from("runs")
      .insert({
        agency_id: job.agencyId,
        prompt_id: job.promptId,
        engine_id: engine.id,
        sample_no: i + 1,
        cost_usd: answer.costUsd,
      })
      .select("id")
      .single();
    if (error || !run) throw new Error(`llm-run insert: ${error?.message}`);

    await recordUsage(ctx, { agencyId: job.agencyId, kind: "prompt_run", costUsd: answer.costUsd });

    // Hand the raw answer to the extraction step (mentions, citations, sentiment).
    await queue.send("rootspun_jobs", {
      type: "extract",
      agencyId: job.agencyId,
      clientId: job.clientId,
      runId: run.id,
      text: answer.text,
      citedUrls: answer.citations.map((c) => c.url),
    });
  }

  log.info({ promptId: job.promptId, engine: job.engine, samples: job.samples }, "llm-run: sampled");
}
