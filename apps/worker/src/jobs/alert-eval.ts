import { z } from "zod";
import { evaluateScoreDrop, DEFAULT_DROP_THRESHOLD } from "@rootspun/core";
import { getRule } from "@rootspun/rules";
import { getEmailProvider } from "../providers/email.js";
import { causeLabelFor } from "./cause-labels.js";
import type { JobContext } from "./context.js";

/** RS-207 — email when a client's score drops past a threshold week-on-week. */
export const alertEvalJobSchema = z.object({
  type: z.literal("alert_eval"),
  agencyId: z.string().uuid(),
  clientId: z.string().uuid(),
});
export type AlertEvalJob = z.infer<typeof alertEvalJobSchema>;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function runAlertEvalJob(job: AlertEvalJob, ctx: JobContext): Promise<void> {
  const { db, env, log } = ctx;

  const { data: client } = await db.from("clients").select("name").eq("id", job.clientId).maybeSingle();

  const { data: scores } = await db
    .from("scores_daily")
    .select("date, uvs")
    .eq("client_id", job.clientId)
    .is("engine_id", null)
    .is("topic", null)
    .order("date", { ascending: false })
    .limit(30);

  const latest = scores?.[0];
  if (!latest) {
    log.info({ clientId: job.clientId }, "alert: no scores yet");
    return;
  }
  const latestDate = new Date(latest.date);
  const previous =
    scores!.find((s) => new Date(s.date).getTime() <= latestDate.getTime() - WEEK_MS) ?? null;

  const { data: alert } = await db
    .from("alerts")
    .select("id, threshold, last_fired_at")
    .eq("client_id", job.clientId)
    .eq("kind", "score_drop")
    .maybeSingle();
  const threshold = alert?.threshold ?? DEFAULT_DROP_THRESHOLD;
  const lastFiredAt = alert?.last_fired_at ? new Date(alert.last_fired_at) : null;

  const decision = evaluateScoreDrop(
    Number(latest.uvs),
    previous ? Number(previous.uvs) : null,
    threshold,
    lastFiredAt,
  );
  if (!decision.fired) {
    log.info({ clientId: job.clientId, reason: decision.reason, delta: decision.delta }, "alert: not firing");
    return;
  }

  // Top 3 causes for the email body.
  const { data: causes } = await db
    .from("causes")
    .select("type, rule_id, impact")
    .eq("client_id", job.clientId)
    .order("impact", { ascending: false })
    .limit(3);

  const recipients = await resolveRecipients(ctx, job.agencyId);
  const html = renderAlertEmail(client?.name ?? "Your client", decision.delta, causes ?? []);

  const email = getEmailProvider(env, log);
  await email.send({
    to: recipients,
    subject: `⚠️ ${client?.name ?? "Client"} visibility dropped ${decision.delta} points`,
    html,
  });

  // Record the fire so we don't alert again today.
  if (alert?.id) {
    await db.from("alerts").update({ last_fired_at: new Date().toISOString() }).eq("id", alert.id);
  } else {
    await db.from("alerts").insert({ agency_id: job.agencyId, client_id: job.clientId, kind: "score_drop" });
    await db
      .from("alerts")
      .update({ last_fired_at: new Date().toISOString() })
      .eq("client_id", job.clientId)
      .eq("kind", "score_drop");
  }

  log.info({ clientId: job.clientId, delta: decision.delta, recipients: recipients.length }, "alert: fired");
}

/** Owner/admin emails for the agency, via the auth admin API (service role). */
async function resolveRecipients(ctx: JobContext, agencyId: string): Promise<string[]> {
  const { data: members } = await ctx.db
    .from("memberships")
    .select("user_id, role")
    .eq("agency_id", agencyId)
    .in("role", ["owner", "admin"]);

  const emails: string[] = [];
  for (const m of members ?? []) {
    const { data } = await ctx.db.auth.admin.getUserById(m.user_id);
    if (data.user?.email) emails.push(data.user.email);
  }
  return emails;
}

function renderAlertEmail(
  clientName: string,
  delta: number,
  causes: { type: string; rule_id: string | null }[],
): string {
  const items = causes
    .map((c) => {
      const rule = c.rule_id ? getRule(c.rule_id) : undefined;
      const link = rule ? ` — <a href="${rule.url}">${rule.title}</a>` : "";
      return `<li>${causeLabelFor(c.type)}${link}</li>`;
    })
    .join("");
  return `
    <h2>${clientName} visibility dropped ${delta} points</h2>
    <p>The Unified Visibility Score fell week on week. Top likely causes:</p>
    <ul>${items || "<li>No causes diagnosed yet — run the Why Engine.</li>"}</ul>
    <p>Open Rootspun to review the evidence and act.</p>
  `;
}
