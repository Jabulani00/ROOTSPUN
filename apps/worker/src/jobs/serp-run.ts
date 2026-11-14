import { z } from "zod";
import { normalizeHost } from "@rootspun/core";
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
  const { db, log, queue } = ctx;

  if (await isOverPlanLimit(ctx, job.agencyId)) {
    log.warn({ agencyId: job.agencyId }, "serp-run: plan limit reached, skipping");
    return;
  }

  const [{ data: engines }, { data: domains }] = await Promise.all([
    db.from("engines").select("id, code"),
    db.from("domains").select("host").eq("client_id", job.clientId),
  ]);
  const engineId = new Map((engines ?? []).map((e) => [e.code, e.id]));
  const clientHosts = new Set((domains ?? []).map((d) => normalizeHost(d.host)));

  const provider = getSerpProvider(ctx.env);
  const result = await provider.run({ prompt: job.prompt, country: job.country, language: job.language });

  // ── Google organic: store a run and the client's rank as a client citation ──
  const organicEngine = engineId.get("google_organic");
  if (organicEngine != null) {
    const { data: run } = await db
      .from("runs")
      .insert({ agency_id: job.agencyId, prompt_id: job.promptId, engine_id: organicEngine, sample_no: 1, cost_usd: result.costUsd })
      .select("id")
      .single();
    if (run) {
      const clientHit = result.organic.find((o) => clientHosts.has(o.host));
      const rows = result.organic.slice(0, 10).map((o) => ({
        agency_id: job.agencyId,
        run_id: run.id,
        url: o.url,
        host: o.host,
        is_client: clientHosts.has(o.host),
        rank: o.rank,
      }));
      if (rows.length > 0) await db.from("citations").insert(rows);
      log.info({ promptId: job.promptId, clientRank: clientHit?.rank ?? null }, "serp-run: stored organic");
    }
  }

  // ── AI Overview / AI Mode: store a run + citations when the block is present ──
  for (const [code, present] of [
    ["ai_overview", result.aiOverviewPresent],
    ["ai_mode", result.aiModePresent],
  ] as const) {
    const eid = engineId.get(code);
    if (!present || eid == null) continue;
    const { data: run } = await db
      .from("runs")
      .insert({ agency_id: job.agencyId, prompt_id: job.promptId, engine_id: eid, sample_no: 1, cost_usd: 0 })
      .select("id")
      .single();
    if (run && result.aiCitations.length > 0) {
      await db.from("citations").insert(
        result.aiCitations.map((c) => ({
          agency_id: job.agencyId,
          run_id: run.id,
          url: c.url,
          host: c.host,
          is_client: clientHosts.has(c.host),
          rank: c.rank,
        })),
      );
    }
  }

  await recordUsage(ctx, { agencyId: job.agencyId, kind: "prompt_run", costUsd: result.costUsd });

  await queue.send("rootspun_jobs", {
    type: "score",
    clientId: job.clientId,
    date: new Date().toISOString().slice(0, 10),
  });
}
