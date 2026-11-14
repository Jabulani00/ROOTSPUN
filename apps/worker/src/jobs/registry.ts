import { z } from "zod";
import type { JobContext } from "./context.js";
import { runScoreJob, scoreJobSchema } from "./score.js";
import { runWhyEngineJob, whyJobSchema } from "./why-engine.js";
import { runSerpJob, serpRunJobSchema } from "./serp-run.js";
import { runLlmJob, llmRunJobSchema } from "./llm-run.js";
import { runExtractJob, extractJobSchema } from "./extract.js";
import { runGscSyncJob, gscSyncJobSchema } from "./gsc-sync.js";
import { runCrawlJob, crawlJobSchema } from "./crawl.js";
import { runCwvSyncJob, cwvSyncJobSchema } from "./cwv-sync.js";
import { runCrawlerAccessJob, crawlerAccessJobSchema } from "./crawler-access.js";
import { runDocsWatchJob, docsWatchJobSchema } from "./docs-watch.js";
import { runReportPdfJob, reportPdfJobSchema } from "./report-pdf.js";
import { runAlertEvalJob, alertEvalJobSchema } from "./alert-eval.js";
import { runProofEvalJob, proofEvalJobSchema } from "./proof-eval.js";
import { runSubquestionMapJob, subquestionMapJobSchema } from "./subquestion-map.js";
import { runEntityCheckJob, entityCheckJobSchema } from "./entity-check.js";

/** Union of every job message the worker understands. */
export const jobMessageSchema = z.discriminatedUnion("type", [
  scoreJobSchema,
  whyJobSchema,
  serpRunJobSchema,
  llmRunJobSchema,
  extractJobSchema,
  gscSyncJobSchema,
  crawlJobSchema,
  cwvSyncJobSchema,
  crawlerAccessJobSchema,
  docsWatchJobSchema,
  reportPdfJobSchema,
  alertEvalJobSchema,
  proofEvalJobSchema,
  subquestionMapJobSchema,
  entityCheckJobSchema,
]);
export type JobMessage = z.infer<typeof jobMessageSchema>;
export type JobType = JobMessage["type"];

/**
 * Validate a raw queue payload and route it to its handler. Validation failures
 * throw, so a malformed message is retried and ultimately dead-lettered rather
 * than silently dropped.
 */
export async function dispatch(raw: unknown, ctx: JobContext): Promise<void> {
  const job = jobMessageSchema.parse(raw);
  switch (job.type) {
    case "score":
      return runScoreJob(job, ctx);
    case "why_engine":
      return runWhyEngineJob(job, ctx);
    case "serp_run":
      return runSerpJob(job, ctx);
    case "llm_run":
      return runLlmJob(job, ctx);
    case "extract":
      return runExtractJob(job, ctx);
    case "gsc_sync":
      return runGscSyncJob(job, ctx);
    case "crawl":
      return runCrawlJob(job, ctx);
    case "cwv_sync":
      return runCwvSyncJob(job, ctx);
    case "crawler_access":
      return runCrawlerAccessJob(job, ctx);
    case "docs_watch":
      return runDocsWatchJob(job, ctx);
    case "report_pdf":
      return runReportPdfJob(job, ctx);
    case "alert_eval":
      return runAlertEvalJob(job, ctx);
    case "proof_eval":
      return runProofEvalJob(job, ctx);
    case "subquestion_map":
      return runSubquestionMapJob(job, ctx);
    case "entity_check":
      return runEntityCheckJob(job, ctx);
  }
}
