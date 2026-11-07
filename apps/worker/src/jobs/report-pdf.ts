import { z } from "zod";
import type { JobContext } from "./context.js";

/** RS-109 — generate a branded PDF report and store/email it. */
export const reportPdfJobSchema = z.object({
  type: z.literal("report_pdf"),
  agencyId: z.string().uuid(),
  clientId: z.string().uuid(),
  period: z.string(),
});
export type ReportPdfJob = z.infer<typeof reportPdfJobSchema>;

export async function runReportPdfJob(job: ReportPdfJob, ctx: JobContext): Promise<void> {
  // TODO(phase1): render @react-pdf/renderer with agency branding, upload to Storage, email via Resend.
  ctx.log.info({ clientId: job.clientId, period: job.period }, "report-pdf: not yet implemented");
}
