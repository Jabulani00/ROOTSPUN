import "server-only";
import {
  analyzeAeo,
  analyzeInternalLinks,
  analyzePage,
  collectSitemapEntries,
  daysSince,
  detectSchemaTypes,
  isPathAllowed,
  pageIssues,
  readabilityFromHtml,
  type SeoIssue,
} from "@rootspun/core";

const UA = "RootspunBot/1.0 (+https://rootspun.app; technical SEO audit)";
export const CRAWL_BOTS = ["Googlebot", "Google-Extended", "GPTBot", "PerplexityBot", "ClaudeBot", "Bingbot"];

export interface CrawledPage {
  url: string;
  status: number;
  canonical: string | null;
  noindex: boolean;
  nosnippet: boolean;
  wordCount: number;
  title: string | null;
  metaDescription: string | null;
  template: string;
  issues: SeoIssue[];
  /** Answer-engine readiness score 0–100 (null for non-200 pages). */
  aeoScore: number | null;
}

export interface CrawlResult {
  robotsFound: boolean;
  sitemapFound: boolean;
  crawlerAccess: { bot: string; allowed: boolean }[];
  pages: CrawledPage[];
  /** Median AEO score across fetched pages (null if none). */
  aeoScore: number | null;
  /** Distinct schema.org types seen across the crawl. */
  schemaTypes: string[];
  /** De-duplicated AEO recommendations seen across the crawl (for the strategy). */
  aeoRecs: SeoIssue[];
}

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
    // Sitemaps are served as XML (and some servers omit the content-type);
    // only block clearly-binary bodies so sitemap <loc> parsing actually works.
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

/** Crawl up to `max` internal pages of a site and analyse each for SEO issues. */
export async function crawlSite(domain: string, max = 10): Promise<CrawlResult> {
  const host = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "").toLowerCase();
  const origin = `https://${host}`;

  const robots = await fetchText(`${origin}/robots.txt`, 12000, "xml");
  const robotsTxt = robots.status === 200 ? robots.text : "";
  const crawlerAccess = CRAWL_BOTS.map((bot) => ({ bot, allowed: isPathAllowed(robotsTxt, bot, "/") }));

  // Seed the crawl with the homepage plus any same-host page URLs in the sitemap.
  const queue: string[] = [`${origin}/`];
  const sitemapEntries = await collectSitemapEntries(
    origin,
    host,
    robotsTxt,
    async (u) => {
      const r = await fetchText(u, 12000, "xml");
      return { status: r.status, text: r.text };
    },
    { limit: max * 6 },
  );
  const sitemapFound = sitemapEntries !== null;
  // lastmod per pathname, for a content-freshness check during analysis.
  const lastmodByPath = new Map<string, string>();
  for (const e of sitemapEntries ?? []) {
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
  const pages: CrawledPage[] = [];
  const linkPages: { url: string; internalLinks: string[] }[] = [];
  const schemaTypes = new Set<string>();
  const aeoRecMap = new Map<string, SeoIssue>();

  while (queue.length > 0 && pages.length < max) {
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
      pages.push({ url, status, canonical: null, noindex: false, nosnippet: false, wordCount: 0, title: null, metaDescription: null, template: templateOf(pathname), issues: [], aeoScore: null });
      continue;
    }

    const a = analyzePage(text, finalUrl);
    linkPages.push({ url: finalUrl, internalLinks: a.internalLinks });
    for (const t of detectSchemaTypes(text)) schemaTypes.add(t);

    const issues = pageIssues(a);
    // Dense writing hurts rankings and AI citations — flag it on real content.
    const read = readabilityFromHtml(text);
    if (a.wordCount >= 150 && read.fleschReadingEase < 45) {
      issues.push({
        severity: "low",
        code: "hard_to_read",
        message: `Hard to read (Flesch ${read.fleschReadingEase}, grade ${read.gradeLevel}) — simplify wording`,
      });
    }

    const aeo = analyzeAeo(text);
    for (const r of aeo.recommendations) if (!aeoRecMap.has(r.code)) aeoRecMap.set(r.code, r);

    // Content freshness from the sitemap's lastmod (recency aids rankings + AI).
    const lastmod = lastmodByPath.get(new URL(finalUrl).pathname.replace(/\/+$/, "") || "/");
    const ageDays = daysSince(lastmod ?? null);
    if (ageDays != null && ageDays > 365) {
      issues.push({
        severity: "low",
        code: "stale_content",
        message: `Not updated in ${Math.floor(ageDays / 30)} months (per sitemap) — refresh for freshness`,
      });
    }

    pages.push({
      url: finalUrl,
      status,
      canonical: a.canonical,
      noindex: a.noindex,
      nosnippet: a.nosnippet,
      wordCount: a.wordCount,
      title: a.title,
      metaDescription: a.metaDescription,
      template: templateOf(new URL(finalUrl).pathname),
      issues,
      aeoScore: aeo.score,
    });

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

  // Internal link graph: flag orphan pages (no inbound internal links) so they
  // surface in the aggregated issues and the ranking strategy. Medium severity
  // because a capped crawl can miss inbound links from uncrawled pages.
  if (linkPages.length > 1) {
    const orphanSet = new Set(analyzeInternalLinks(linkPages).orphans);
    for (const p of pages) {
      if (orphanSet.has(p.url)) {
        p.issues = [
          { severity: "medium", code: "orphan", message: "Orphan page — no internal links point here" },
          ...p.issues,
        ];
      }
    }
  }

  const aeoScores = pages.map((p) => p.aeoScore).filter((n): n is number => n != null).sort((a, b) => a - b);
  const aeoScore = aeoScores.length ? aeoScores[Math.floor(aeoScores.length / 2)]! : null;

  return {
    robotsFound: robots.status === 200,
    sitemapFound,
    crawlerAccess,
    pages,
    aeoScore,
    schemaTypes: [...schemaTypes],
    aeoRecs: [...aeoRecMap.values()],
  };
}
