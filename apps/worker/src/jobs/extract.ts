import { z } from "zod";
import { extractAnswer, type EntityTerms } from "@rootspun/core";
import type { JobContext } from "./context.js";

/**
 * RS-105 — extract brand mentions, cited URLs and sentiment from a saved answer.
 * The answer text + cited URLs are passed from the llm-run/serp-run step; the
 * client's domains, brand terms and competitors are loaded to build the entity
 * term lists. Extraction itself is the pure, unit-tested logic in @rootspun/core.
 */
export const extractJobSchema = z.object({
  type: z.literal("extract"),
  agencyId: z.string().uuid(),
  clientId: z.string().uuid(),
  runId: z.string().uuid(),
  text: z.string(),
  citedUrls: z.array(z.string()).default([]),
});
export type ExtractJob = z.infer<typeof extractJobSchema>;

export async function runExtractJob(job: ExtractJob, ctx: JobContext): Promise<void> {
  const { db, log } = ctx;

  const [{ data: domains }, { data: brandTerms }, { data: competitors }] = await Promise.all([
    db.from("domains").select("host").eq("client_id", job.clientId),
    db.from("brand_terms").select("term").eq("client_id", job.clientId),
    db.from("competitors").select("name, host").eq("client_id", job.clientId),
  ]);

  const clientHosts = (domains ?? []).map((d) => d.host);
  const entities: EntityTerms[] = [
    { entity: "client", terms: (brandTerms ?? []).map((b) => b.term) },
    ...(competitors ?? []).map((c) => ({ entity: c.name, terms: [c.name, c.host] })),
  ];

  const { mentions, citations } = extractAnswer({
    text: job.text,
    citedUrls: job.citedUrls,
    clientHosts,
    entities,
  });

  if (mentions.length > 0) {
    const { error } = await db.from("mentions").insert(
      mentions.map((m) => ({
        agency_id: job.agencyId,
        run_id: job.runId,
        entity: m.entity,
        position: m.position,
        sentiment: m.sentiment,
      })),
    );
    if (error) throw new Error(`extract mentions: ${error.message}`);
  }

  if (citations.length > 0) {
    const { error } = await db.from("citations").insert(
      citations.map((c, i) => ({
        agency_id: job.agencyId,
        run_id: job.runId,
        url: job.citedUrls[i] ?? c.host,
        host: c.host,
        is_client: c.isClient,
        rank: c.rank,
      })),
    );
    if (error) throw new Error(`extract citations: ${error.message}`);
  }

  log.info(
    { runId: job.runId, mentions: mentions.length, citations: citations.length },
    "extract: stored mentions and citations",
  );
}
