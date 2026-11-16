import { z } from "zod";
import { auditOnPage, buildStrategy, normalizeHost, type SeoIssue } from "@rootspun/core";
import { crawlSite } from "@/lib/crawl";
import { apiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({ domain: z.string().min(3) });

// Lightweight in-process abuse guard: cap instant audits per IP per window.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 8;
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

/**
 * RS-406 — instant, no-login technical + AEO audit of a single domain. Runs the
 * real crawler and the SEO/AEO strategy engine (no API keys needed) and returns
 * a score with the top fixes, so a prospect sees the value immediately.
 */
export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return apiError(400, "Enter a valid domain");

  const host = normalizeHost(parsed.data.domain);
  if (!host || !host.includes(".")) return apiError(400, "Enter a valid domain, e.g. yourbrand.com");

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip)) return apiError(429, "Too many audits from this network — try again soon.");

  let result;
  try {
    result = await crawlSite(host, 6);
  } catch {
    return apiError(502, "Could not reach that site. Check the domain and try again.");
  }
  if (result.pages.length === 0 || result.pages.every((p) => p.status !== 200)) {
    return apiError(502, `Couldn't crawl ${host} — it may be unreachable or blocking crawlers.`);
  }

  // Build the strategy from the crawl (same engine as the in-app Technical view).
  const uniqueOnPage: SeoIssue[] = [];
  const seen = new Set<string>();
  for (const p of result.pages) {
    for (const i of p.issues) {
      if (!seen.has(i.code)) {
        seen.add(i.code);
        uniqueOnPage.push(i);
      }
    }
  }
  const siteAudit = auditOnPage(
    result.pages.map((p) => ({
      url: p.url,
      title: p.title,
      metaDescription: p.metaDescription,
      canonical: p.canonical,
      noindex: p.noindex,
    })),
  );
  const googleBlocked = result.crawlerAccess.some((a) => a.bot === "Googlebot" && !a.allowed);
  const anyNoindex = result.pages.some((p) => p.noindex && !p.url.match(/cart|checkout|account|login/i));

  const strategy = buildStrategy({
    onPageIssues: uniqueOnPage,
    siteIssues: siteAudit.issues,
    technical: { noindex: anyNoindex, crawlerBlocked: googleBlocked, cwv: null },
    aeo: result.aeoScore != null ? { score: result.aeoScore } : null,
  });

  return Response.json({
    host,
    pagesCrawled: result.pages.length,
    robotsFound: result.robotsFound,
    sitemapFound: result.sitemapFound,
    crawlerAccess: result.crawlerAccess,
    schemaTypes: result.schemaTypes,
    score: strategy.totalScore,
    grade: strategy.grade,
    classicScore: strategy.classicScore,
    aeoScore: strategy.aeoScore,
    technicalScore: strategy.technicalScore,
    summary: strategy.summary,
    actions: strategy.actions.slice(0, 8),
  });
}
