import { z } from "zod";
import {
  scoreSlice,
  type EngineCode,
  type PromptInput,
  type Sample,
  type Sentiment,
} from "@rootspun/core";
import type { JobContext } from "./context.js";

export const scoreJobSchema = z.object({
  type: z.literal("score"),
  clientId: z.string().uuid(),
  date: z.string(), // yyyy-mm-dd
});
export type ScoreJob = z.infer<typeof scoreJobSchema>;

/**
 * RS-106 — compute the Unified Visibility Score + share of voice for a client
 * for a day, per engine and overall, and upsert into scores_daily.
 *
 * Reads are issued separately (not nested) and stitched in memory so the typed
 * client stays simple; all queries run under the service-role client.
 */
export async function runScoreJob(job: ScoreJob, ctx: JobContext): Promise<void> {
  const { db, log } = ctx;

  const { data: engines } = await db.from("engines").select("id, code");
  const engineCode = new Map<number, EngineCode>((engines ?? []).map((e) => [e.id, e.code as EngineCode]));
  const engineId = new Map<EngineCode, number>((engines ?? []).map((e) => [e.code as EngineCode, e.id]));

  const { data: prompts } = await db
    .from("prompts")
    .select("id, topic, search_volume, agency_id")
    .eq("client_id", job.clientId);
  if (!prompts || prompts.length === 0) {
    log.info({ clientId: job.clientId }, "score: no prompts, nothing to do");
    return;
  }
  const agencyId = prompts[0]!.agency_id;
  const promptIds = prompts.map((p) => p.id);

  // Runs for the day's samples, plus their mentions and citations.
  const { data: runs } = await db
    .from("runs")
    .select("id, prompt_id, engine_id, sample_no")
    .in("prompt_id", promptIds);
  const runIds = (runs ?? []).map((r) => r.id);

  const { data: mentions } = runIds.length
    ? await db.from("mentions").select("run_id, entity, position, sentiment").in("run_id", runIds)
    : { data: [] };
  const { data: citations } = runIds.length
    ? await db.from("citations").select("run_id, host, is_client, rank").in("run_id", runIds)
    : { data: [] };

  const mentionsByRun = groupBy(mentions ?? [], (m) => m.run_id);
  const citationsByRun = groupBy(citations ?? [], (c) => c.run_id);

  // Assemble core inputs: one PromptInput per prompt, with every sample.
  const inputs: PromptInput[] = prompts.map((p) => {
    const promptRuns = (runs ?? []).filter((r) => r.prompt_id === p.id);
    const samples: Sample[] = promptRuns.map((r) => {
      const engine = engineCode.get(r.engine_id) ?? "chatgpt";
      return {
        engine,
        mentions: (mentionsByRun.get(r.id) ?? []).map((m) => ({
          entity: m.entity === "client" ? ("client" as const) : m.entity,
          position: m.position ?? 1,
          sentiment: (m.sentiment ?? "neutral") as Sentiment,
        })),
        citations: (citationsByRun.get(r.id) ?? []).map((c) => ({
          host: c.host,
          isClient: c.is_client,
          rank: c.rank ?? 1,
        })),
      };
    });
    return { promptId: p.id, topic: p.topic ?? "untagged", searchVolume: p.search_volume, samples };
  });

  const overall = scoreSlice(inputs);

  // Build every row to upsert: one overall (engine_id null) + one per engine.
  const rows = [
    {
      agency_id: agencyId,
      client_id: job.clientId,
      engine_id: null as number | null,
      topic: null,
      date: job.date,
      uvs: overall.uvs,
      share_of_voice: overall.shareOfVoice,
      confidence: overall.confidence,
    },
  ];

  const enginesPresent = new Set<EngineCode>(inputs.flatMap((i) => i.samples.map((s) => s.engine)));
  for (const engine of enginesPresent) {
    const id = engineId.get(engine);
    if (id == null) continue;
    const engineInputs = inputs
      .map((i) => ({ ...i, samples: i.samples.filter((s) => s.engine === engine) }))
      .filter((i) => i.samples.length > 0);
    const r = scoreSlice(engineInputs);
    rows.push({
      agency_id: agencyId,
      client_id: job.clientId,
      engine_id: id,
      topic: null,
      date: job.date,
      uvs: r.uvs,
      share_of_voice: r.shareOfVoice,
      confidence: r.confidence,
    });
  }

  await db.from("scores_daily").upsert(rows, { onConflict: "client_id,engine_id,topic,date" });

  log.info(
    { clientId: job.clientId, uvs: overall.uvs, engines: rows.length - 1, confidence: overall.confidence },
    "score: upserted daily scores (overall + per engine)",
  );
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k) ?? [];
    list.push(item);
    map.set(k, list);
  }
  return map;
}
