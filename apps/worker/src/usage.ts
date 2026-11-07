import type { JobContext } from "./jobs/context.js";

/** Rough monthly run allowance per plan — used for the cap check (RS-110). */
const PLAN_RUN_LIMIT: Record<string, number> = {
  trial: 1_000,
  starter: 50_000,
  growth: 200_000,
  scale: 1_000_000,
};

/** NFR-09 — every outside API call logs its cost against the agency. */
export async function recordUsage(
  ctx: JobContext,
  input: { agencyId: string; kind: "prompt_run" | "page_crawl"; qty?: number; costUsd?: number },
): Promise<void> {
  const { error } = await ctx.db.from("usage_events").insert({
    agency_id: input.agencyId,
    kind: input.kind,
    qty: input.qty ?? 1,
    cost_usd: input.costUsd ?? 0,
  });
  if (error) ctx.log.warn({ err: error.message }, "usage: failed to record event");
}

/**
 * RS-110 — returns true when the agency has hit its plan's run limit this period,
 * so the caller can pause runs and surface a banner.
 */
export async function isOverPlanLimit(ctx: JobContext, agencyId: string): Promise<boolean> {
  const { data: agency } = await ctx.db.from("agencies").select("plan").eq("id", agencyId).maybeSingle();
  const limit = PLAN_RUN_LIMIT[agency?.plan ?? "trial"] ?? PLAN_RUN_LIMIT.trial!;

  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  const { data: events } = await ctx.db
    .from("usage_events")
    .select("qty")
    .eq("agency_id", agencyId)
    .eq("kind", "prompt_run")
    .gte("at", periodStart.toISOString());

  const used = (events ?? []).reduce((sum, e) => sum + e.qty, 0);
  return used >= limit;
}
