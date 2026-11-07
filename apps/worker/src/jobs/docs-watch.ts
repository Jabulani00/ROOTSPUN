import { z } from "zod";
import { allRules } from "@rootspun/rules";
import type { JobContext } from "./context.js";

/** RS-204 — watch Google Search Central pages; flag when documentation changes. */
export const docsWatchJobSchema = z.object({ type: z.literal("docs_watch") });
export type DocsWatchJob = z.infer<typeof docsWatchJobSchema>;

export async function runDocsWatchJob(_job: DocsWatchJob, ctx: JobContext): Promise<void> {
  // Ensure the library mirror exists; a real run fetches each URL and compares checksums.
  const rules = allRules();
  // TODO(phase2): fetch each rule.url, hash content, update google_rules.checksum/last_changed_at.
  ctx.log.info({ rules: rules.length }, "docs-watch: checked rule library (fetch TODO)");
}
