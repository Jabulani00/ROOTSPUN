"use server";

import { revalidatePath } from "next/cache";
import { getRule } from "@rootspun/rules";
import { createClient } from "@/lib/supabase/server";
import { causeLabel } from "@/lib/cause-labels";

/** Suggested first steps per cause type (RS-303). */
const FIX_STEPS: Record<string, string[]> = {
  not_indexed: ["Remove noindex / fix the 4xx", "Request indexing in Search Console", "Confirm the page is indexable"],
  crawl_blocked: ["Remove the robots.txt Disallow", "Whitelist the bot at the CDN/WAF", "Re-test live fetch"],
  snippet_blocked: ["Remove nosnippet / data-nosnippet", "Set a generous max-snippet", "Re-check AI surface eligibility"],
  slow_template: ["Profile the slow template", "Fix the failing Core Web Vital", "Verify field data improves"],
  competitor_cited: ["Audit the cited competitor pages", "Close depth/freshness/E-E-A-T gaps", "Add supporting structured data"],
  no_answering_page: ["Create a page that directly answers the prompt", "Cover the entities and sub-questions", "Add internal links"],
};

const KIND: Record<string, "dev" | "content" | "pr"> = {
  not_indexed: "dev",
  crawl_blocked: "dev",
  snippet_blocked: "dev",
  slow_template: "dev",
  competitor_cited: "content",
  no_answering_page: "content",
};

/** RS-303 — turn an accepted cause into a fix ticket with steps, rule link and impact. */
export async function createFixFromCauseAction(
  clientId: string,
  causeId: string,
): Promise<{ error?: string; fixId?: string }> {
  const db = createClient();

  const { data: cause } = await db
    .from("causes")
    .select("id, agency_id, client_id, type, rule_id, evidence, impact")
    .eq("id", causeId)
    .maybeSingle();
  if (!cause) return { error: "Cause not found" };

  const rule = cause.rule_id ? getRule(cause.rule_id) : undefined;
  const ev = (cause.evidence ?? {}) as Record<string, unknown>;
  const affectedUrls = typeof ev.targetUrl === "string" ? [ev.targetUrl] : [];

  const brief = {
    steps: FIX_STEPS[cause.type] ?? ["Investigate and resolve the issue"],
    affectedUrls,
    ruleTitle: rule?.title ?? null,
    ruleUrl: rule?.url ?? null,
    expectedImpact: Math.round(Number(cause.impact)),
  };

  const { data: fix, error } = await db
    .from("fixes")
    .insert({
      agency_id: cause.agency_id,
      client_id: cause.client_id,
      cause_id: cause.id,
      title: `Fix: ${causeLabel(cause.type)}`,
      kind: KIND[cause.type] ?? "dev",
      brief,
      status: "open",
    })
    .select("id")
    .single();
  if (error || !fix) return { error: error?.message ?? "Could not create fix" };

  // Accepting a cause when you action it keeps triage consistent.
  await db.from("causes").update({ status: "accepted" }).eq("id", causeId);

  revalidatePath(`/clients/${clientId}/fixes`);
  revalidatePath(`/clients/${clientId}/causes`);
  return { fixId: fix.id };
}

/** Update a fix's workflow status (open → in progress → shipped). */
export async function updateFixStatusAction(
  clientId: string,
  fixId: string,
  status: "open" | "in_progress" | "shipped",
): Promise<{ error?: string }> {
  const db = createClient();
  const patch: { status: typeof status; shipped_at?: string } = { status };
  if (status === "shipped") patch.shipped_at = new Date().toISOString();
  const { error } = await db.from("fixes").update(patch).eq("id", fixId);
  if (error) return { error: error.message };
  revalidatePath(`/clients/${clientId}/fixes`);
  return {};
}
