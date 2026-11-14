/**
 * Site-wide on-page SEO audit (FR-12) — pure, testable.
 *
 * The per-page analyzer (analyze.ts) can't see duplication or canonical
 * conflicts that only show up across a crawl. This takes the crawled pages and
 * finds duplicate titles/descriptions and canonicalization problems — the
 * on-page issues that quietly split or suppress rankings.
 */
import type { IssueSeverity, SeoIssue } from "./analyze.js";

export interface OnPageRecord {
  url: string;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  /** When true the page is excluded from duplicate checks (not meant to rank). */
  noindex?: boolean;
}

export interface DuplicateGroup {
  value: string;
  urls: string[];
}

export interface CanonicalIssue {
  url: string;
  severity: IssueSeverity;
  code: string;
  message: string;
}

export interface SiteAudit {
  pagesAudited: number;
  duplicateTitles: DuplicateGroup[];
  duplicateDescriptions: DuplicateGroup[];
  canonicalIssues: CanonicalIssue[];
  /** Aggregated, de-duplicated site-level findings, ranked by severity. */
  issues: SeoIssue[];
}

function norm(s: string | null): string {
  return (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Canonicalise a URL for comparison: drop scheme, www, trailing slash, hash. */
function canonUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.host.replace(/^www\./, "").toLowerCase();
    let path = u.pathname.replace(/\/+$/, "");
    if (path === "") path = "/";
    return `${host}${path}${u.search}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function groupDuplicates(records: OnPageRecord[], pick: (r: OnPageRecord) => string | null): DuplicateGroup[] {
  const map = new Map<string, { value: string; urls: string[] }>();
  for (const r of records) {
    if (r.noindex) continue;
    const raw = pick(r);
    const key = norm(raw);
    if (!key) continue;
    const e = map.get(key) ?? { value: (raw ?? "").trim(), urls: [] };
    e.urls.push(r.url);
    map.set(key, e);
  }
  return [...map.values()].filter((g) => g.urls.length > 1).sort((a, b) => b.urls.length - a.urls.length);
}

/** Audit a crawl's pages for duplicate titles/descriptions and canonical issues. */
export function auditOnPage(records: OnPageRecord[]): SiteAudit {
  const duplicateTitles = groupDuplicates(records, (r) => r.title);
  const duplicateDescriptions = groupDuplicates(records, (r) => r.metaDescription);

  const canonicalIssues: CanonicalIssue[] = [];
  for (const r of records) {
    if (!r.canonical) {
      canonicalIssues.push({ url: r.url, severity: "low", code: "canonical_missing", message: "No canonical link — add a self-referencing canonical" });
      continue;
    }
    const pageHost = hostOf(r.url);
    const canHost = hostOf(r.canonical);
    if (canHost && pageHost && canHost !== pageHost) {
      canonicalIssues.push({
        url: r.url,
        severity: "high",
        code: "canonical_offsite",
        message: `Canonical points to another domain (${canHost}) — this page won't rank and may leak signals`,
      });
    } else if (canonUrl(r.canonical) !== canonUrl(r.url)) {
      canonicalIssues.push({
        url: r.url,
        severity: "medium",
        code: "canonical_elsewhere",
        message: `Canonicalised to ${canonUrl(r.canonical)} — this URL is telling Google not to rank it`,
      });
    }
  }

  // Aggregate into site-level issues.
  const issues: SeoIssue[] = [];
  if (duplicateTitles.length > 0) {
    const n = duplicateTitles.reduce((s, g) => s + g.urls.length, 0);
    issues.push({ severity: "high", code: "dup_titles", message: `${n} pages share a duplicate <title> across ${duplicateTitles.length} group(s)` });
  }
  if (duplicateDescriptions.length > 0) {
    const n = duplicateDescriptions.reduce((s, g) => s + g.urls.length, 0);
    issues.push({ severity: "medium", code: "dup_descriptions", message: `${n} pages share a duplicate meta description across ${duplicateDescriptions.length} group(s)` });
  }
  const offsite = canonicalIssues.filter((c) => c.code === "canonical_offsite").length;
  const elsewhere = canonicalIssues.filter((c) => c.code === "canonical_elsewhere").length;
  const missing = canonicalIssues.filter((c) => c.code === "canonical_missing").length;
  if (offsite > 0) issues.push({ severity: "high", code: "canonical_offsite", message: `${offsite} page(s) canonicalise to another domain` });
  if (elsewhere > 0) issues.push({ severity: "medium", code: "canonical_elsewhere", message: `${elsewhere} page(s) canonicalise away from themselves` });
  if (missing > 0) issues.push({ severity: "low", code: "canonical_missing", message: `${missing} page(s) have no canonical link` });

  const order: Record<IssueSeverity, number> = { high: 0, medium: 1, low: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    pagesAudited: records.length,
    duplicateTitles,
    duplicateDescriptions,
    canonicalIssues,
    issues,
  };
}
