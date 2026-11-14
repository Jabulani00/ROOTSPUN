"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { crawlSite } from "@/lib/crawl";

/** RS-201/203 — crawl the client's site now and store the technical-SEO results. */
export async function runCrawlAction(clientId: string): Promise<{ error?: string; pages?: number }> {
  const db = createClient();

  const { data: client } = await db.from("clients").select("id, agency_id").eq("id", clientId).maybeSingle();
  if (!client) return { error: "Client not found" };
  const { data: domain } = await db
    .from("domains")
    .select("host")
    .eq("client_id", clientId)
    .eq("is_primary", true)
    .maybeSingle();
  if (!domain) return { error: "Add a primary domain for this client first" };

  let result;
  try {
    result = await crawlSite(domain.host, 8);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Crawl failed" };
  }

  const { data: crawl, error } = await db
    .from("crawls")
    .insert({
      agency_id: client.agency_id,
      client_id: clientId,
      status: "done",
      page_count: result.pages.length,
      finished_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !crawl) return { error: error?.message ?? "Could not record crawl" };

  if (result.pages.length > 0) {
    await db.from("pages").insert(
      result.pages.map((p) => ({
        agency_id: client.agency_id,
        crawl_id: crawl.id,
        url: p.url,
        status: p.status,
        canonical: p.canonical,
        nosnippet: p.nosnippet,
        template: p.template,
      })),
    );
  }

  await db.from("crawler_access").insert(
    result.crawlerAccess.map((c) => ({
      agency_id: client.agency_id,
      client_id: clientId,
      bot: c.bot,
      allowed: c.allowed,
      blocked_by: c.allowed ? null : "robots",
    })),
  );

  revalidatePath(`/clients/${clientId}/technical`);
  return { pages: result.pages.length };
}
