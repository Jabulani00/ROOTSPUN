/**
 * Technical-SEO page analysis (RS-201, fortified) — pure, testable.
 *
 * Extracts the on-page signals that drive both classic search and AI-answer
 * visibility from a page's HTML, and turns them into a ranked list of issues.
 * Regex-based (no DOM) so it stays browser-safe and dependency-free. The HTTP
 * fetch / headless render lives in the crawler; this is the analysis.
 */
import { extractHtmlSignals } from "../crawl/html.js";

export interface PageAnalysis {
  url: string;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  canonical: string | null;
  noindex: boolean;
  nosnippet: boolean;
  h1: string[];
  h1Count: number;
  h2Count: number;
  wordCount: number;
  imageCount: number;
  imagesMissingAlt: number;
  hasJsonLd: boolean;
  hasOpenGraph: boolean;
  hreflangCount: number;
  internalLinks: string[];
  externalLinkCount: number;
  /** Mobile viewport meta present (mobile-first indexing). */
  hasViewport: boolean;
  /** `lang` value on <html>, or null. */
  lang: string | null;
}

export type IssueSeverity = "high" | "medium" | "low";
export interface SeoIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function metaContent(html: string, nameOrProp: "name" | "property", key: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    if (new RegExp(`${nameOrProp}\\s*=\\s*["']${key}["']`, "i").test(tag)) {
      const m = /content\s*=\s*["']([^"']*)["']/i.exec(tag);
      if (m) return m[1]!.trim();
    }
  }
  return null;
}

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ");
}

/** Parse a page's HTML into a structured technical-SEO analysis. */
export function analyzePage(html: string, url: string): PageAnalysis {
  const sig = extractHtmlSignals(html);
  const host = hostOf(url);

  const metaDescription = metaContent(html, "name", "description");
  const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
    m[1]!.replace(/<[^>]+>/g, "").trim(),
  );
  const h2Count = (html.match(/<h2\b/gi) ?? []).length;
  const words = (visibleText(html).match(/[A-Za-z0-9']+/g) ?? []).length;

  const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];
  const imagesMissingAlt = imgTags.filter((t) => !/\balt\s*=\s*["'][^"']*\S[^"']*["']/i.test(t)).length;

  const hasJsonLd = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["']/i.test(html);
  const hasOpenGraph = /property\s*=\s*["']og:/i.test(html);
  const hreflangCount = (html.match(/hreflang\s*=/gi) ?? []).length;
  const hasViewport = /<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(html);
  const lang = /<html\b[^>]*\blang\s*=\s*["']([^"']+)["']/i.exec(html)?.[1]?.trim() ?? null;

  const hrefs = [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]!);
  const internalLinks: string[] = [];
  let externalLinkCount = 0;
  for (const href of hrefs) {
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    if (href.startsWith("/") || hostOf(href) === host || !/^https?:\/\//i.test(href)) {
      internalLinks.push(href);
    } else {
      externalLinkCount++;
    }
  }

  return {
    url,
    title: sig.title,
    titleLength: sig.title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    canonical: sig.canonical,
    noindex: sig.metaRobotsNoindex,
    nosnippet: sig.nosnippet,
    h1,
    h1Count: h1.length,
    h2Count,
    wordCount: words,
    imageCount: imgTags.length,
    imagesMissingAlt,
    hasJsonLd,
    hasOpenGraph,
    hreflangCount,
    internalLinks: [...new Set(internalLinks)],
    externalLinkCount,
    hasViewport,
    lang,
  };
}

/**
 * Utility pages that are *meant* to be noindex (carts, checkout, account,
 * login, search results, etc.). Google's own guidance is to keep these out of
 * the index, so a noindex here is correct, not a defect — flagging it "high"
 * creates false alarms on every WooCommerce/Shopify store. Matched on the URL
 * path so it works across platforms (/cart-2/, /my-account/, /checkout/…).
 */
const EXPECTED_NOINDEX_PATH =
  /(^|\/)(cart|carts|checkout|basket|bag|my-account|account|login|signin|sign-in|register|signup|sign-up|logout|wishlist|wishlists|order-received|order-tracking|thank-you|thankyou|password-reset|lost-password|search)(\/|-|$)/i;

export function isExpectedNoindexPath(url: string): boolean {
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    /* treat the raw string as a path */
  }
  return EXPECTED_NOINDEX_PATH.test(path);
}

/** Turn an analysis into ranked technical-SEO issues. */
export function pageIssues(a: PageAnalysis): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const add = (severity: IssueSeverity, code: string, message: string) =>
    issues.push({ severity, code, message });

  if (a.noindex) {
    if (isExpectedNoindexPath(a.url))
      add("low", "noindex_expected", "noindex on a utility page (cart/checkout/account) — expected, confirm it's intentional");
    else add("high", "noindex", "Page is set to noindex — it will not rank in Google");
  }
  if (a.nosnippet) add("medium", "nosnippet", "nosnippet set — AI Overviews/answers can't quote this page");

  if (!a.title) add("high", "title_missing", "Missing <title>");
  else if (a.titleLength < 30) add("low", "title_short", `Title is short (${a.titleLength} chars)`);
  else if (a.titleLength > 60) add("low", "title_long", `Title may be truncated (${a.titleLength} chars)`);

  if (!a.metaDescription) add("medium", "meta_desc_missing", "Missing meta description");
  else if (a.metaDescriptionLength > 160)
    add("low", "meta_desc_long", `Meta description may be truncated (${a.metaDescriptionLength} chars)`);

  if (a.h1Count === 0) add("medium", "h1_missing", "No <h1> heading");
  else if (a.h1Count > 1) add("low", "h1_multiple", `${a.h1Count} <h1> headings (prefer one)`);

  if (a.wordCount < 300 && !isExpectedNoindexPath(a.url))
    add("medium", "thin_content", `Thin content (~${a.wordCount} words)`);
  if (a.imagesMissingAlt > 0) add("low", "img_alt", `${a.imagesMissingAlt} image(s) missing alt text`);
  if (!a.hasViewport) add("medium", "no_viewport", "No mobile viewport meta — fails mobile-friendliness (mobile-first indexing)");
  if (!a.lang) add("low", "no_lang", "No lang attribute on <html> — set it for accessibility and international search");
  if (!a.canonical) add("low", "canonical_missing", "No canonical link");
  if (!a.hasJsonLd) add("low", "no_structured_data", "No JSON-LD structured data (helps AI + rich results)");
  if (!a.hasOpenGraph) add("low", "no_open_graph", "No Open Graph tags — links render poorly when shared or surfaced");

  const order: Record<IssueSeverity, number> = { high: 0, medium: 1, low: 2 };
  return issues.sort((x, y) => order[x.severity] - order[y.severity]);
}
