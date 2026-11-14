"use server";

import { rankKeywords, type KeywordRank, type KeywordSummary } from "@rootspun/core";
import { createClient } from "@/lib/supabase/server";
import { googleCseSearch, serpConfigured } from "@/lib/serp";

export interface CheckRanksResult {
  error?: string;
  keywords?: KeywordRank[];
  summary?: KeywordSummary;
  checked?: number;
}

/**
 * RS-103 — check where the client ranks for each of its tracked keywords, using
 * the free Google Custom Search provider, and score the opportunities. Capped at
 * 20 keywords per run to respect the free-tier quota (100 queries/day).
 */
export async function checkRanksAction(clientId: string): Promise<CheckRanksResult> {
  if (!serpConfigured()) {
    return { error: "Add GOOGLE_CSE_KEY and GOOGLE_CSE_ID to check live keyword ranks." };
  }

  const db = createClient();
  const { data: client } = await db.from("clients").select("id, language").eq("id", clientId).maybeSingle();
  if (!client) return { error: "Client not found" };

  const [{ data: domains }, { data: prompts }] = await Promise.all([
    db.from("domains").select("host").eq("client_id", clientId),
    db
      .from("prompts")
      .select("text, search_volume, priority")
      .eq("client_id", clientId)
      .order("priority", { ascending: false })
      .order("search_volume", { ascending: false })
      .limit(20),
  ]);

  const clientHosts = (domains ?? []).map((d) => d.host);
  if (clientHosts.length === 0) return { error: "Add a domain for this client first" };
  if (!prompts || prompts.length === 0) return { error: "Add some keywords/prompts first" };

  const language = client.language ?? "en";
  const inputs = [];
  for (const p of prompts) {
    const serp = await googleCseSearch(p.text, language);
    if ("error" in serp) continue; // skip the odd failed query, keep going
    inputs.push({ keyword: p.text, clientHosts, results: serp.results, searchVolume: p.search_volume });
  }

  if (inputs.length === 0) return { error: "No SERP results returned — check the Custom Search key/quota." };

  const { keywords, summary } = rankKeywords(inputs);
  return { keywords, summary, checked: inputs.length };
}
