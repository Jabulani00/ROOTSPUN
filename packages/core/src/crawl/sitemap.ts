/**
 * Sitemap resolution (RS-201) — pure, testable, transport-agnostic.
 *
 * Turns a site's robots.txt + sitemap files into a flat list of same-host page
 * URLs to seed a crawl. Yoast/WordPress (and many others) ship a *sitemap index*
 * that points at child sitemaps, so this follows one level of index. The HTTP
 * fetch is injected so this stays dependency-free and unit-testable.
 */

/** Minimal result of fetching a URL's text body. */
export interface SitemapFetchResult {
  status: number;
  text: string;
}
export type SitemapFetcher = (url: string) => Promise<SitemapFetchResult>;

function normHost(host: string): string {
  return host.replace(/^www\./, "").toLowerCase();
}

function sameHost(url: string, host: string): boolean {
  try {
    return normHost(new URL(url).host) === normHost(host);
  } catch {
    return false;
  }
}

/** Extract every <loc> value from a sitemap/urlset/sitemapindex document. */
export function sitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]!.trim());
}

/** The sitemap URLs declared in robots.txt via `Sitemap:` directives. */
export function sitemapUrlsFromRobots(robotsTxt: string): string[] {
  return [...robotsTxt.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]!.trim());
}

export interface SitemapEntry {
  loc: string;
  /** `<lastmod>` value if present, else null. */
  lastmod: string | null;
}

function entriesFromBlocks(xml: string, tag: "url" | "sitemap"): SitemapEntry[] {
  const out: SitemapEntry[] = [];
  for (const m of xml.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi"))) {
    const block = m[1] ?? "";
    const loc = /<loc>\s*([^<\s]+)\s*<\/loc>/i.exec(block)?.[1];
    if (!loc) continue;
    const lastmod = /<lastmod>\s*([^<\s]+)\s*<\/lastmod>/i.exec(block)?.[1]?.trim() ?? null;
    out.push({ loc: loc.trim(), lastmod });
  }
  return out;
}

/** Parse a sitemap document into entries (loc + optional lastmod). */
export function sitemapEntries(xml: string): SitemapEntry[] {
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  return entriesFromBlocks(xml, isIndex ? "sitemap" : "url");
}

/** Whole days since an ISO/`YYYY-MM-DD` date, or null if unparseable. */
export function daysSince(dateStr: string | null, now = Date.now()): number | null {
  if (!dateStr) return null;
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / 86_400_000);
}

/**
 * Like {@link collectSitemapUrls} but returns same-host page entries with their
 * `<lastmod>` (for content-freshness checks). Follows one level of index.
 */
export async function collectSitemapEntries(
  origin: string,
  host: string,
  robotsTxt: string,
  fetcher: SitemapFetcher,
  opts: CollectSitemapOptions = {},
): Promise<SitemapEntry[] | null> {
  const limit = opts.limit ?? 60;
  const maxChildren = opts.maxChildren ?? 10;
  const candidates = [
    ...new Set([...sitemapUrlsFromRobots(robotsTxt), `${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`]),
  ];

  let found = false;
  const byLoc = new Map<string, SitemapEntry>();
  const add = (e: SitemapEntry) => {
    if (!sameHost(e.loc, host) || byLoc.size >= limit) return;
    if (!byLoc.has(e.loc)) byLoc.set(e.loc, e);
  };

  for (const sm of candidates) {
    if (byLoc.size >= limit) break;
    const res = await fetcher(sm);
    if (res.status !== 200 || !res.text) continue;
    found = true;

    if (/<sitemapindex[\s>]/i.test(res.text)) {
      const children = entriesFromBlocks(res.text, "sitemap").filter((e) => sameHost(e.loc, host));
      for (const child of children.slice(0, maxChildren)) {
        if (byLoc.size >= limit) break;
        const cr = await fetcher(child.loc);
        if (cr.status !== 200 || !cr.text) continue;
        for (const e of sitemapEntries(cr.text)) add(e);
      }
    } else {
      for (const e of sitemapEntries(res.text)) add(e);
    }
  }

  return found ? [...byLoc.values()] : null;
}

export interface CollectSitemapOptions {
  /** Max page URLs to return. Default 60. */
  limit?: number;
  /** Max child sitemaps to follow from an index. Default 10. */
  maxChildren?: number;
}

/**
 * Resolve a site's sitemap(s) into same-host page URLs.
 * Returns `null` when no sitemap document could be fetched at all (status≠200 /
 * empty), so callers can distinguish "no sitemap" from "sitemap with 0 pages".
 */
export async function collectSitemapUrls(
  origin: string,
  host: string,
  robotsTxt: string,
  fetcher: SitemapFetcher,
  opts: CollectSitemapOptions = {},
): Promise<string[] | null> {
  const limit = opts.limit ?? 60;
  const maxChildren = opts.maxChildren ?? 10;

  const candidates = [
    ...new Set([
      ...sitemapUrlsFromRobots(robotsTxt),
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
    ]),
  ];

  let found = false;
  const pages = new Set<string>();

  for (const sm of candidates) {
    if (pages.size >= limit) break;
    const res = await fetcher(sm);
    if (res.status !== 200 || !res.text) continue;
    found = true;

    const isIndex = /<sitemapindex[\s>]/i.test(res.text);
    const locs = sitemapLocs(res.text).filter((u) => sameHost(u, host));

    if (isIndex) {
      for (const child of locs.slice(0, maxChildren)) {
        if (pages.size >= limit) break;
        const cr = await fetcher(child);
        if (cr.status !== 200 || !cr.text) continue;
        for (const u of sitemapLocs(cr.text).filter((p) => sameHost(p, host))) {
          if (pages.size >= limit) break;
          pages.add(u);
        }
      }
    } else {
      for (const u of locs) {
        if (pages.size >= limit) break;
        pages.add(u);
      }
    }
  }

  return found ? [...pages] : null;
}
