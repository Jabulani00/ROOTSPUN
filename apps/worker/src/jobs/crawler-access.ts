import { z } from "zod";
import { isPathAllowed } from "@rootspun/core";
import type { JobContext } from "./context.js";

/** Bots we report crawl access for (RS-203). */
const BOTS = [
  "Googlebot",
  "Google-Extended",
  "GPTBot",
  "PerplexityBot",
  "ClaudeBot",
  "CCBot",
  "Bingbot",
] as const;

/**
 * RS-203 — can Googlebot and AI crawlers reach the site? The robots.txt verdict
 * per bot uses the pure, unit-tested parser; the live-fetch CDN test and server
 * log analysis are supplied/handled separately.
 */
export const crawlerAccessJobSchema = z.object({
  type: z.literal("crawler_access"),
  agencyId: z.string().uuid(),
  clientId: z.string().uuid(),
  robotsTxt: z.string().default(""),
  testPath: z.string().default("/"),
});
export type CrawlerAccessJob = z.infer<typeof crawlerAccessJobSchema>;

export async function runCrawlerAccessJob(job: CrawlerAccessJob, ctx: JobContext): Promise<void> {
  const rows = BOTS.map((bot) => {
    const allowed = isPathAllowed(job.robotsTxt, bot, job.testPath);
    return {
      agency_id: job.agencyId,
      client_id: job.clientId,
      bot,
      allowed,
      blocked_by: allowed ? null : "robots",
    };
  });

  const { error } = await ctx.db.from("crawler_access").insert(rows);
  if (error) throw new Error(`crawler-access insert: ${error.message}`);

  const blocked = rows.filter((r) => !r.allowed).map((r) => r.bot);
  ctx.log.info({ clientId: job.clientId, blocked }, "crawler-access: evaluated robots.txt per bot");
}
