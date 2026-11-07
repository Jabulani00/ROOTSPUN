import { z } from "zod";
import type { JobContext } from "./context.js";

/** RS-201 — crawl the client site (Crawlee + Playwright), up to 5,000 pages. */
export const crawlJobSchema = z.object({
  type: z.literal("crawl"),
  agencyId: z.string().uuid(),
  clientId: z.string().uuid(),
  startUrl: z.string().url(),
  maxPages: z.number().int().min(1).max(5000).default(5000),
});
export type CrawlJob = z.infer<typeof crawlJobSchema>;

export async function runCrawlJob(job: CrawlJob, ctx: JobContext): Promise<void> {
  // TODO(phase2): Crawlee crawl — status, canonical, robots, nosnippet, raw vs rendered.
  ctx.log.info({ clientId: job.clientId, startUrl: job.startUrl }, "crawl: not yet implemented");
}
