import { z } from "zod";
import {
  analyzeAeo,
  analyzeInternalLinks,
  analyzePage,
  collectSitemapEntries,
  daysSince,
  isPathAllowed,
  pageIssues,
  readabilityFromHtml,
  type SeoIssue,
} from "@rootspun/core";
import type { JobContext } from "./context.js";

/** RS-201/203 — crawl the client site and store the technical-SEO results. */
export const crawlJobSchema = z.object({
  type: z.literal("crawl"),
  agencyId: z.string().uuid(),
  clientId: z.string().uuid(),
  startUrl: z.string().url(),
  maxPages: z.number().int().min(1).max(5000).default(50),
});
export type CrawlJob = z.infer<typeof crawlJobSchema>;

const UA = "RootspunBot/1.0 (+https://rootspun.app; technical SEO audit)";
const CRAWL_BOTS = ["Googlebot", "Google-Extended", "GPTBot", "PerplexityBot", "ClaudeBot", "Bingbot"];

async function fetchText(url: string, timeoutMs = 12000, accept: "html" | "xml" = "html") {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": UA,
        accept: accept === "xml" ? "application/xml,text/xml,*/*" : "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: ctl.signal,
    });
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    const ok = accept === "xml" ? !/(image|font|octet-stream|pdf|zip)/.test(ct) : ct.includes("html");
    return { status: res.status, text: ok ? await res.text() : "", finalUrl: res.url || url };
  } catch {
    return { status: 0, text: "", finalUrl: url };
  } finally {
    clearTimeout(t);
  }
}

function templateOf(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean);
  return seg.length === 0 ? "home" : seg[0]!;
}

/**
 * Real crawl job (runs in the worker per the architecture). Uses the shared
 * `@rootspun/core` analyzers — the same logic as the in-app crawler and the CLI —
 * so results match across surfaces. Writes `crawls`, `pages` and `crawler_access`
 * via the service-role client (NFR-01: worker only).
 */
export async function runCrawlJob(job: CrawlJob, ctx: JobContext): Promise<void> {
  const { db, log } = ctx;
  const max = Math.min(job.maxPages, 50);
  const host = job.startUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "").toLowerCase();
  const origin = `https://${host}`;

  const robots = await fetchText(`${origin}/robots.txt`, 12000, "xml");
  const robotsTxt = robots.status === 200 ? robots.text : "";
  const crawlerAccess = CRAWL_BOTS.map((bot) => ({ bot, allowed: isPathAllowed(robotsTxt, bot, "/") }));

  const sitemap = await collectSitemapEntries(
    origin,
    host,
    robotsTxt,
    async (u) => {
      const r = await fetchText(u, 12000, "xml");
      return { status: r.status, text: r.text };
    },
    { limit: max * 6 },
  );
  const lastmodByPath = new Map<string, string>();
  const queue: string[] = [`${origin}/`];
  for (const e of sitemap ?? []) {
    if (queue.length < max * 6) queue.push(e.loc);
    if (e.lastmod) {
      try {
        lastmodByPath.set(new URL(e.loc).pathname.replace(/\/+$/, "") || "/", e.lastmod);
      } catch {
        /* skip */
      }
    }
  }

  const visited = new Set<string>();
  const linkPages: { url: string; internalLinks: string[] }[] = [];
  const aeoScores: number[] = [];
  const rows: {
    url: string; status: number; canonical: string | null; nosnippet: boolean;
    template: string; issues: SeoIssue[]; aeoScore: number | null;
  }[] = [];

  while (queue.length > 0 && rows.length < max) {
    const url = queue.shift()!;
    let pathname = "/";
    try {
      pathname = new URL(url).pathname;
    } catch {
      continue;
    }
    if (visited.has(pathname)) continue;
    visited.add(pathname);
    if (!isPathAllowed(robotsTxt, "Googlebot", pathname)) continue;

    const { status, text, finalUrl } = await fetchText(url);
    if (status !== 200 || !text) {
      rows.push({ url, status, canonical: null, nosnippet: false, template: templateOf(pathname), issues: [], aeoScore: null });
      continue;
    }

    const a = analyzePage(text, finalUrl);
    linkPages.push({ url: finalUrl, internalLinks: a.internalLinks });
    const issues = pageIssues(a);

    const read = readabilityFromHtml(text);
    if (a.wordCount >= 150 && read.fleschReadingEase < 45)
      issues.push({ severity: "low", code: "hard_to_read", message: `Hard to read (Flesch ${read.fleschReadingEase}, grade ${read.gradeLevel}) — simplify wording` });

    const ageDays = daysSince(lastmodByPath.get(new URL(finalUrl).pathname.replace(/\/+$/, "") || "/") ?? null);
    if (ageDays != null && ageDays > 365)
      issues.push({ severity: "low", code: "stale_content", message: `Not updated in ${Math.floor(ageDays / 30)} months (per sitemap) — refresh for freshness` });

    const aeo = analyzeAeo(text);
    aeoScores.push(aeo.score);

    rows.push({ url: finalUrl, status, canonical: a.canonical, nosnippet: a.nosnippet, template: templateOf(new URL(finalUrl).pathname), issues, aeoScore: aeo.score });

    for (const link of a.internalLinks) {
      try {
        const abs = new URL(link, finalUrl);
        if (abs.host.replace(/^www\./, "") !== host) continue;
        if (!visited.has(abs.pathname) && queue.length < max * 4) queue.push(abs.toString());
      } catch {
        /* skip */
      }
    }
  }

  // Orphan pages (no inbound internal links) → medium issue.
  if (linkPages.length > 1) {
    const orphans = new Set(analyzeInternalLinks(linkPages).orphans);
    for (const r of rows)
      if (orphans.has(r.url))
        r.issues = [{ severity: "medium", code: "orphan", message: "Orphan page — no internal links point here" }, ...r.issues];
  }

  const aeoScore = aeoScores.length ? [...aeoScores].sort((x, y) => x - y)[Math.floor(aeoScores.length / 2)]! : null;

  const { data: crawl, error } = await db
    .from("crawls")
    .insert({
      agency_id: job.agencyId,
      client_id: job.clientId,
      status: "done",
      page_count: rows.length,
      finished_at: new Date().toISOString(),
      robots_found: robots.status === 200,
      sitemap_found: sitemap !== null,
      aeo_score: aeoScore,
    })
    .select("id")
    .single();
  if (error || !crawl) {
    log.error({ clientId: job.clientId, err: error?.message }, "crawl: could not record");
    return;
  }

  if (rows.length > 0)
    await db.from("pages").insert(
      rows.map((p) => ({
        agency_id: job.agencyId,
        crawl_id: crawl.id,
        url: p.url,
        status: p.status,
        canonical: p.canonical,
        nosnippet: p.nosnippet,
        template: p.template,
        issues: p.issues,
        aeo_score: p.aeoScore,
      })),
    );

  await db.from("crawler_access").insert(
    crawlerAccess.map((c) => ({
      agency_id: job.agencyId,
      client_id: job.clientId,
      bot: c.bot,
      allowed: c.allowed,
      blocked_by: c.allowed ? null : "robots",
    })),
  );

  log.info({ clientId: job.clientId, pages: rows.length, aeoScore }, "crawl: done");
}
