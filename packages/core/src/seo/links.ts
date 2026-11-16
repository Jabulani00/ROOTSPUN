/**
 * Internal link-graph analysis (on-page SEO, FR-12) — pure, testable.
 *
 * Internal links spread ranking signals ("link equity") and tell Google which
 * pages matter. Pages with no internal links pointing at them ("orphans") are
 * hard to discover and rarely rank. Given each crawled page and the internal
 * links it points to, this builds the inbound/outbound graph, finds orphans and
 * weakly-linked pages, and surfaces the strongest hubs.
 */
import type { IssueSeverity, SeoIssue } from "./analyze.js";

export interface LinkPage {
  url: string;
  /** Internal link hrefs found on the page (absolute or relative). */
  internalLinks: string[];
}

export interface PageLinkStat {
  url: string;
  path: string;
  inbound: number;
  outbound: number;
  orphan: boolean;
}

export interface LinkAudit {
  pages: PageLinkStat[];
  /** Non-home pages with zero inbound internal links. */
  orphans: string[];
  /** Pages with the most inbound links (internal authority hubs). */
  topHubs: PageLinkStat[];
  issues: SeoIssue[];
}

/** Normalise a URL (absolute or relative to `base`) to a comparable path key. */
function toPath(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    let p = u.pathname.replace(/\/+$/, "");
    if (p === "") p = "/";
    return p.toLowerCase();
  } catch {
    return null;
  }
}

function isHome(path: string): boolean {
  return path === "/" || path === "/index.html" || path === "/home";
}

/** Analyse the internal link graph across a crawl's pages. */
export function analyzeInternalLinks(pages: LinkPage[]): LinkAudit {
  // Known page paths — only links that resolve to a crawled page count.
  const pathToUrl = new Map<string, string>();
  for (const p of pages) {
    const key = toPath(p.url, p.url);
    if (key && !pathToUrl.has(key)) pathToUrl.set(key, p.url);
  }

  const inbound = new Map<string, number>();
  const outbound = new Map<string, number>();
  for (const key of pathToUrl.keys()) {
    inbound.set(key, 0);
    outbound.set(key, 0);
  }

  for (const p of pages) {
    const from = toPath(p.url, p.url);
    if (from == null) continue;
    const seenTargets = new Set<string>(); // count one edge per target page
    for (const link of p.internalLinks) {
      const to = toPath(link, p.url);
      if (to == null || to === from) continue;
      if (!pathToUrl.has(to)) continue; // link points outside the crawled set
      if (seenTargets.has(to)) continue;
      seenTargets.add(to);
      inbound.set(to, (inbound.get(to) ?? 0) + 1);
      outbound.set(from, (outbound.get(from) ?? 0) + 1);
    }
  }

  const stats: PageLinkStat[] = [...pathToUrl.entries()].map(([path, url]) => {
    const inb = inbound.get(path) ?? 0;
    return { url, path, inbound: inb, outbound: outbound.get(path) ?? 0, orphan: inb === 0 && !isHome(path) };
  });

  const orphans = stats.filter((s) => s.orphan).map((s) => s.url);
  const weaklyLinked = stats.filter((s) => !s.orphan && !isHome(s.path) && s.inbound === 1).length;
  const topHubs = [...stats].sort((a, b) => b.inbound - a.inbound).slice(0, 5);

  const issues: SeoIssue[] = [];
  if (orphans.length > 0)
    issues.push({ severity: "high", code: "orphan_pages", message: `${orphans.length} orphan page(s) — no internal links point to them` });
  if (weaklyLinked > 0)
    issues.push({ severity: "low", code: "weak_internal_links", message: `${weaklyLinked} page(s) have only one internal link in — add more contextual links` });

  const order: Record<IssueSeverity, number> = { high: 0, medium: 1, low: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);

  return { pages: stats, orphans, topHubs, issues };
}
