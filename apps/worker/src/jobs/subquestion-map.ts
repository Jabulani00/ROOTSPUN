import { z } from "zod";
import { mapSubQuestions } from "@rootspun/core";
import type { JobContext } from "./context.js";

/**
 * RS-301 — map a money query's sub-questions to the best client page and report
 * coverage gaps. The sub-questions (LLM-generated) and candidate pages (from the
 * crawl) are supplied by upstream steps; the matching maths is the pure,
 * unit-tested core function.
 */
export const subquestionMapJobSchema = z.object({
  type: z.literal("subquestion_map"),
  agencyId: z.string().uuid(),
  clientId: z.string().uuid(),
  promptId: z.string().uuid(),
  subQuestions: z.array(z.string()).default([]),
  pages: z.array(z.object({ url: z.string(), keywords: z.array(z.string()) })).default([]),
});
export type SubquestionMapJob = z.infer<typeof subquestionMapJobSchema>;

export async function runSubquestionMapJob(job: SubquestionMapJob, ctx: JobContext): Promise<void> {
  if (job.subQuestions.length === 0) {
    ctx.log.info({ promptId: job.promptId }, "subquestion-map: no sub-questions");
    return;
  }
  const result = mapSubQuestions(job.subQuestions, job.pages);
  // TODO(phase3): persist coverage % per topic and raise a cause for each gap.
  ctx.log.info(
    { promptId: job.promptId, coveragePct: result.pct, gaps: result.gaps.length },
    "subquestion-map: computed coverage",
  );
}
