import "server-only";
import { analyzePage, collectSitemapUrls, isPathAllowed, pageIssues, type SeoIssue } from "@rootspun/core";

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
  template: string;
  issues: SeoIssue[];
}

export interface CrawlResult {
  robotsFound: boolean;
  sitemapFound: boolean;
  crawlerAccess: { bot: string; allowed: boolean }[];
  pages: CrawledPage[];
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
  const sitemapUrls = await collectSitemapUrls(
    origin,
    host,
    robotsTxt,
    async (u) => {
      const r = await fetchText(u, 12000, "xml");
      return { status: r.status, text: r.text };
    },
    { limit: max * 6 },
  );
  const sitemapFound = sitemapUrls !== null;
  for (const u of sitemapUrls ?? []) {
    if (queue.length < max * 6) queue.push(u);
  }
  const visited = new Set<string>();
  const pages: CrawledPage[] = [];

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
      pages.push({ url, status, canonical: null, noindex: false, nosnippet: false, wordCount: 0, title: null, template: templateOf(pathname), issues: [] });
      continue;
    }

    const a = analyzePage(text, finalUrl);
    pages.push({
      url: finalUrl,
      status,
      canonical: a.canonical,
      noindex: a.noindex,
      nosnippet: a.nosnippet,
      wordCount: a.wordCount,
      title: a.title,
      template: templateOf(new URL(finalUrl).pathname),
      issues: pageIssues(a),
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

  return { robotsFound: robots.status === 200, sitemapFound, crawlerAccess, pages };
}
