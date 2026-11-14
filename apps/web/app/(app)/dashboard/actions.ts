"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureAgencyId } from "@/lib/auth";

/**
 * Seed a realistic demo client so a new agency can see a fully populated
 * dashboard (for sales demos). All inserts go through the user's session, so RLS
 * scopes them to this agency. Idempotent-ish: skips if a demo client exists.
 */
export async function loadSampleDataAction(): Promise<{ error?: string; clientId?: string }> {
  const agencyId = await ensureAgencyId();
  if (!agencyId) return { error: "No agency" };
  const db = createClient();

  const { data: existing } = await db
    .from("clients")
    .select("id")
    .eq("agency_id", agencyId)
    .ilike("name", "Demo —%")
    .maybeSingle();
  if (existing) return { clientId: existing.id };

  const { data: client, error } = await db
    .from("clients")
    .insert({ agency_id: agencyId, name: "Demo — Life Changing Journey", country: "ZA", language: "en" })
    .select("id")
    .single();
  if (error || !client) return { error: error?.message ?? "Could not create demo client" };
  const clientId = client.id;

  await db.from("domains").insert({ agency_id: agencyId, client_id: clientId, host: "lifechangingjourney.co.za", is_primary: true });
  await db.from("competitors").insert([
    { agency_id: agencyId, client_id: clientId, name: "Heal Love Live", host: "healloveliveinvest.co.za" },
    { agency_id: agencyId, client_id: clientId, name: "The View", host: "theviewcountryhouse.co.za" },
  ]);

  const prompts = [
    ["life coaching south africa", "Coaching", 1300],
    ["personal growth coach", "Coaching", 880],
    ["best life coach johannesburg", "Coaching", 590],
    ["mindset transformation program", "Programs", 320],
    ["how to find purpose in life", "Content", 2400],
    ["online life coaching", "Coaching", 720],
    ["career transition coach", "Coaching", 480],
    ["wellness retreat south africa", "Retreats", 1100],
  ] as const;
  await db.from("prompts").insert(
    prompts.map(([text, topic, vol]) => ({
      agency_id: agencyId,
      client_id: clientId,
      text,
      topic,
      priority: vol > 1000,
      search_volume: vol,
    })),
  );

  // Engines for per-engine scores.
  const { data: engines } = await db.from("engines").select("id, code");
  const engineId = new Map((engines ?? []).map((e) => [e.code, e.id]));
  const demoEngines = ["google_organic", "ai_overview", "chatgpt", "perplexity"] as const;
  const base: Record<string, number> = { google_organic: 72, ai_overview: 58, chatgpt: 49, perplexity: 41 };

  const rows: Record<string, unknown>[] = [];
  const today = new Date();
  for (let d = 13; d >= 0; d--) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - d);
    const iso = date.toISOString().slice(0, 10);
    const ramp = (13 - d) / 13; // 0 → 1 over the window
    const overall = Math.round((48 + ramp * 20) * 10) / 10;
    rows.push({
      agency_id: agencyId,
      client_id: clientId,
      engine_id: null,
      topic: null,
      date: iso,
      uvs: overall,
      share_of_voice: Math.round((30 + ramp * 14) * 10) / 10,
      confidence: "high",
    });
    for (const code of demoEngines) {
      const id = engineId.get(code);
      if (id == null) continue;
      rows.push({
        agency_id: agencyId,
        client_id: clientId,
        engine_id: id,
        topic: null,
        date: iso,
        uvs: Math.round((base[code]! - 10 + ramp * 12) * 10) / 10,
        share_of_voice: 0,
        confidence: "high",
      });
    }
  }
  await db.from("scores_daily").upsert(rows as never, { onConflict: "client_id,engine_id,topic,date" });

  // A few diagnosed causes.
  const aiId = engineId.get("ai_overview") ?? null;
  await db.from("causes").insert([
    {
      agency_id: agencyId, client_id: clientId, engine_id: aiId, type: "slow_template",
      evidence: { lcpMs: 4200, inpMs: 260, failures: ["LCP 4200ms > 2500ms", "INP 260ms > 200ms"], ruleTitle: "Core Web Vitals and Google Search", ruleUrl: "https://developers.google.com/search/docs/appearance/core-web-vitals" },
      rule_id: "rule.cwv.poor", confidence: "medium", impact: 2400, status: "new",
    },
    {
      agency_id: agencyId, client_id: clientId, engine_id: aiId, type: "competitor_cited",
      evidence: { competitorCitedHosts: ["healloveliveinvest.co.za"], ruleTitle: "Search Essentials", ruleUrl: "https://developers.google.com/search/docs/essentials" },
      rule_id: "rule.content.competitor_cited", confidence: "medium", impact: 1300, status: "new",
    },
    {
      agency_id: agencyId, client_id: clientId, engine_id: null, type: "no_answering_page",
      evidence: { hasAnsweringPage: false, ruleTitle: "Creating helpful, people-first content", ruleUrl: "https://developers.google.com/search/docs/fundamentals/creating-helpful-content" },
      rule_id: "rule.content.no_answer", confidence: "high", impact: 880, status: "new",
    },
  ]);

  revalidatePath("/dashboard");
  revalidatePath(`/clients/${clientId}/visibility`);
  return { clientId };
}
