import { z } from "zod";
import type { JobContext } from "./context.js";

/** RS-203 — can Googlebot and AI crawlers reach the site (robots, CDN, logs). */
export const crawlerAccessJobSchema = z.object({
  type: z.literal("crawler_access"),
  agencyId: z.string().uuid(),
  clientId: z.string().uuid(),
});
export type CrawlerAccessJob = z.infer<typeof crawlerAccessJobSchema>;

export async function runCrawlerAccessJob(job: CrawlerAccessJob, ctx: JobContext): Promise<void> {
  // TODO(phase2): parse robots.txt per bot, live-fetch test for CDN blocks, parse uploaded logs.
  ctx.log.info({ clientId: job.clientId }, "crawler-access: not yet implemented");
}
