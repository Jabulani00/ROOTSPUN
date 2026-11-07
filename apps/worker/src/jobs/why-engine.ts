import { z } from "zod";
import { diagnose, impactScore, type EngineCode, type LossContext } from "@rootspun/core";
import { getRule } from "@rootspun/rules";
import type { JobContext } from "./context.js";

/**
 * RS-205 / FR-16 — for each lost ranking or citation, determine the most likely
 * cause with evidence and the Google rule behind it, and store it.
 *
 * The loss facts are assembled upstream (from crawl, CWV, crawler-access, SERP
 * and extraction data) and passed in; this job is the pure diagnosis + persist
 * step so the rules stay unit-tested in @rootspun/core.
 */
export const whyJobSchema = z.object({
  type: z.literal("why_engine"),
  clientId: z.string().uuid(),
  agencyId: z.string().uuid(),
  losses: z
    .array(
      z.object({
        promptId: z.string(),
        engine: z.string(),
        targetUrl: z.string().nullish(),
        indexedInGsc: z.boolean().optional(),
        httpStatus: z.number().nullish(),
        robotsAllowed: z.boolean().optional(),
        metaRobotsNoindex: z.boolean().optional(),
        nosnippet: z.boolean().optional(),
        cdnBlockedBots: z.array(z.string()).optional(),
        cwv: z.object({ lcpMs: z.number().optional(), inpMs: z.number().optional(), cls: z.number().optional() }).nullish(),
        competitorCitedHosts: z.array(z.string()).optional(),
        hasAnsweringPage: z.boolean().optional(),
        searchVolume: z.number().optional(),
        lostVisibility: z.number().optional(),
      }),
    )
    .default([]),
});
export type WhyJob = z.infer<typeof whyJobSchema>;

export async function runWhyEngineJob(job: WhyJob, ctx: JobContext): Promise<void> {
  const { db, log } = ctx;
  if (job.losses.length === 0) {
    log.info({ clientId: job.clientId }, "why-engine: no losses to diagnose");
    return;
  }

  const rows = job.losses
    .map((loss) => {
      const { engine, ...facts } = loss;
      const context: LossContext = {
        clientId: job.clientId,
        engine: engine as EngineCode,
        ...facts,
      };

      const top = diagnose(context)[0];
      if (!top) return null;

      const rule = getRule(top.ruleId);
      return {
        agency_id: job.agencyId,
        client_id: job.clientId,
        prompt_id: loss.promptId,
        type: top.type,
        evidence: { ...top.evidence, ruleTitle: rule?.title ?? null, ruleUrl: rule?.url ?? null },
        rule_id: top.ruleId,
        confidence: top.confidence,
        impact: impactScore(context),
        status: "new" as const,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) {
    log.info({ clientId: job.clientId }, "why-engine: nothing diagnosed");
    return;
  }

  const { error } = await db.from("causes").insert(rows);
  if (error) throw new Error(`why-engine insert: ${error.message}`);
  log.info({ clientId: job.clientId, causes: rows.length }, "why-engine: stored causes");
}
