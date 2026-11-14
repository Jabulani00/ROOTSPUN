/**
 * Keyword rank analysis (FR-05, RS-103) — pure, testable.
 *
 * Given SERP results for a keyword and the client's own hosts, works out where
 * the client ranks, how far it is from a breakthrough (top-3 / page-1), and an
 * opportunity score that surfaces the keywords most likely to rank first — the
 * "striking distance" quick wins an agency should work on next. No network here;
 * the SERP rows come from the licensed provider adapter (NFR-10).
 */

export interface SerpResult {
  /** Result URL. */
  url: string;
  /** 1-based position in the organic results. */
  position: number;
}

export interface KeywordInput {
  keyword: string;
  /** Host(s) owned by the client. */
  clientHosts: string[];
  /** Organic SERP results (any order; position is authoritative). */
  results: SerpResult[];
  /** Monthly search volume, if known — weights opportunity. */
  searchVolume?: number;
}

export type RankBucket = "top3" | "page1" | "page2" | "beyond_page2" | "not_ranking";

export interface KeywordRank {
  keyword: string;
  /** Client's best (lowest) position, or null if absent from the results. */
  position: number | null;
  bucket: RankBucket;
  /** The client URL that ranks best, if any. */
  rankingUrl: string | null;
  /** 1-based results page (10 per page), or null. */
  page: number | null;
  /** Distinct competitor hosts ranking above the client, in order. */
  competitorsAbove: string[];
  /** Position 2–10: close enough that better structure could win the snippet. */
  featuredSnippetOpportunity: boolean;
  /** Position 4–20: "striking distance" — a focused push can break through. */
  quickWin: boolean;
  /** 0–100 opportunity score (higher = work on this first). */
  opportunity: number;
  searchVolume: number;
}

function host(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase();
  }
}

function bucketFor(position: number | null): RankBucket {
  if (position == null) return "not_ranking";
  if (position <= 3) return "top3";
  if (position <= 10) return "page1";
  if (position <= 20) return "page2";
  return "beyond_page2";
}

/** Base opportunity by position: striking-distance keywords score highest. */
function positionScore(position: number | null): number {
  if (position == null) return 20; // needs a new/stronger page — real but harder
  if (position <= 3) return 10; // already winning — defend, low upside
  if (position <= 10) return 90; // page 1, push into the top 3 — prime
  if (position <= 20) return 75; // page 2, one push from page 1
  return 35; // deep — needs real work
}

/** 0–1 weight from search volume (log-scaled so huge terms don't dominate). */
function volumeFactor(volume: number): number {
  if (volume <= 0) return 0.5; // unknown volume: neutral weight, don't zero it out
  const f = Math.log10(volume + 1) / Math.log10(10001); // ~0..1 across 0–10k
  return Math.max(0, Math.min(1, f));
}

/** Analyse one keyword's SERP for the client. */
export function analyzeKeyword(input: KeywordInput): KeywordRank {
  const clientSet = new Set(input.clientHosts.map((h) => host(h)));
  const sorted = [...input.results].sort((a, b) => a.position - b.position);

  let position: number | null = null;
  let rankingUrl: string | null = null;
  const competitorsAbove: string[] = [];
  const seenCompetitor = new Set<string>();

  for (const r of sorted) {
    const h = host(r.url);
    if (clientSet.has(h)) {
      position = r.position;
      rankingUrl = r.url;
      break;
    }
    if (!seenCompetitor.has(h)) {
      seenCompetitor.add(h);
      competitorsAbove.push(h);
    }
  }

  const volume = input.searchVolume ?? 0;
  const opportunity = Math.round(positionScore(position) * (0.4 + 0.6 * volumeFactor(volume)));

  return {
    keyword: input.keyword,
    position,
    bucket: bucketFor(position),
    rankingUrl,
    page: position == null ? null : Math.ceil(position / 10),
    competitorsAbove,
    featuredSnippetOpportunity: position != null && position >= 2 && position <= 10,
    quickWin: position != null && position >= 4 && position <= 20,
    opportunity: Math.max(0, Math.min(100, opportunity)),
    searchVolume: volume,
  };
}

export interface KeywordSummary {
  total: number;
  ranking: number;
  top3: number;
  page1: number; // positions 1–10 (includes top3)
  quickWins: number;
  notRanking: number;
  avgPosition: number | null; // across ranking keywords only
}

/**
 * Analyse a batch of keywords and return them ordered by opportunity (the
 * "which keywords can rank first" list), plus a portfolio summary.
 */
export function rankKeywords(inputs: KeywordInput[]): {
  keywords: KeywordRank[];
  summary: KeywordSummary;
} {
  const keywords = inputs.map(analyzeKeyword).sort((a, b) => b.opportunity - a.opportunity);

  const ranking = keywords.filter((k) => k.position != null);
  const positions = ranking.map((k) => k.position!) as number[];
  const summary: KeywordSummary = {
    total: keywords.length,
    ranking: ranking.length,
    top3: keywords.filter((k) => k.bucket === "top3").length,
    page1: keywords.filter((k) => k.position != null && k.position <= 10).length,
    quickWins: keywords.filter((k) => k.quickWin).length,
    notRanking: keywords.filter((k) => k.position == null).length,
    avgPosition: positions.length ? positions.reduce((s, p) => s + p, 0) / positions.length : null,
  };

  return { keywords, summary };
}
