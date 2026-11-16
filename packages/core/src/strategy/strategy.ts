/**
 * SEO/AEO strategy engine (RS-205/304 synthesis) — pure, testable.
 *
 * Ties together the signals Rootspun already computes — on-page issues, AEO
 * readiness, technical health (indexability, crawler access, Core Web Vitals),
 * site-wide duplicate/canonical problems, and keyword rank — into one answer to
 * the only question that matters to an agency: "how do I rank higher?"
 *
 * It produces a total SEO score with a classic-vs-AEO breakdown and a single
 * ranked action plan where each step says what to do, why it matters, and how
 * much it should move the needle, prioritised by impact over effort.
 */
import type { IssueSeverity, SeoIssue } from "../seo/analyze.js";
import type { AeoRecommendation } from "../seo/aeo.js";
import type { KeywordRank } from "../keywords/rank.js";

/** Just the AEO fields the strategy needs — callers can pass a score alone. */
export interface AeoStrategyInput {
  score: number;
  recommendations?: AeoRecommendation[];
}

export type Impact = "high" | "medium" | "low";
export type Effort = "low" | "medium" | "high";
export type Area = "indexing" | "technical" | "onpage" | "content" | "aeo" | "keywords";

export interface StrategyAction {
  area: Area;
  title: string;
  why: string;
  how: string;
  impact: Impact;
  effort: Effort;
  /** Higher = do sooner (impact weighted against effort). */
  priority: number;
}

export interface CwvInput {
  lcpMs?: number | null;
  inpMs?: number | null;
  cls?: number | null;
}

export interface StrategyInput {
  url?: string;
  /** From pageIssues(analyzePage(...)). */
  onPageIssues?: SeoIssue[];
  /** AEO readiness — a score (and optional recommendations) from analyzeAeo. */
  aeo?: AeoStrategyInput | null;
  technical?: {
    noindex?: boolean;
    /** Googlebot (or a key AI bot) blocked by robots.txt / CDN. */
    crawlerBlocked?: boolean;
    cwv?: CwvInput | null;
  };
  /** Site-level findings from auditOnPage(...).issues. */
  siteIssues?: SeoIssue[];
  /** Rank context for this page's target keyword, if known. */
  keyword?: KeywordRank | null;
}

export interface Strategy {
  totalScore: number; // 0–100
  classicScore: number; // on-page + technical + duplicates
  aeoScore: number; // answer-engine readiness
  technicalScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  actions: StrategyAction[];
  summary: string;
}

const IMPACT_WEIGHT: Record<Impact, number> = { high: 3, medium: 2, low: 1 };
const EFFORT_WEIGHT: Record<Effort, number> = { low: 1, medium: 2, high: 3 };

function severityToImpact(s: IssueSeverity): Impact {
  return s;
}

function priorityOf(impact: Impact, effort: Effort): number {
  // Impact-first, effort as a tie-break divisor → quick high-impact wins float up.
  return Math.round((IMPACT_WEIGHT[impact] / EFFORT_WEIGHT[effort]) * 100) / 100;
}

/**
 * How-to guidance + effort/area per known issue code. Anything not listed falls
 * back to a generic on-page action so new codes still surface.
 */
const RECIPE: Record<string, { area: Area; effort: Effort; how: string }> = {
  // on-page (analyze.ts)
  title_missing: { area: "onpage", effort: "low", how: "Add a unique 30–60 char <title> with the target keyword near the front." },
  title_short: { area: "onpage", effort: "low", how: "Expand the title toward 50–60 chars; lead with the keyword and a benefit." },
  title_long: { area: "onpage", effort: "low", how: "Trim the title under ~60 chars so it isn't truncated in results." },
  meta_desc_missing: { area: "onpage", effort: "low", how: "Write a 120–160 char meta description with the keyword and a clear value prop / CTA." },
  meta_desc_long: { area: "onpage", effort: "low", how: "Shorten the meta description under ~160 chars." },
  h1_missing: { area: "onpage", effort: "low", how: "Add a single descriptive <h1> that states the page's topic." },
  h1_multiple: { area: "onpage", effort: "low", how: "Keep one <h1>; demote the rest to <h2>." },
  thin_content: { area: "content", effort: "medium", how: "Expand to genuinely helpful depth (aim 600+ words) covering the questions buyers ask." },
  hard_to_read: { area: "content", effort: "medium", how: "Shorten sentences, cut jargon and use plainer words — clearer copy ranks and gets quoted by AI more." },
  img_alt: { area: "onpage", effort: "low", how: "Add descriptive alt text to images for accessibility and image search." },
  no_viewport: { area: "technical", effort: "low", how: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> — Google indexes the mobile page first." },
  no_lang: { area: "onpage", effort: "low", how: "Set a lang attribute on <html> (e.g. lang=\"en\") for accessibility and international search." },
  canonical_missing: { area: "technical", effort: "low", how: "Add a self-referencing canonical link." },
  no_structured_data: { area: "aeo", effort: "medium", how: "Add JSON-LD (Product/Article/FAQ) so engines and AI answers can parse the page." },
  nosnippet: { area: "technical", effort: "low", how: "Remove the nosnippet directive so Google and AI answers can quote the page." },
  // site-level (onpage.ts)
  dup_titles: { area: "onpage", effort: "medium", how: "Give each indexable page a distinct <title>; duplicates split rankings." },
  dup_descriptions: { area: "onpage", effort: "low", how: "Write a distinct meta description per page." },
  canonical_offsite: { area: "technical", effort: "medium", how: "Point the canonical at this site, not another domain, or the page can't rank." },
  canonical_elsewhere: { area: "technical", effort: "medium", how: "If this URL should rank, make the canonical self-referencing." },
  // internal links (links.ts)
  orphan: { area: "onpage", effort: "medium", how: "Link to this page from the nav, related content, or body copy so it gets discovered and ranking signals." },
  orphan_pages: { area: "onpage", effort: "medium", how: "Add internal links to the orphan pages from relevant hub pages." },
  weak_internal_links: { area: "onpage", effort: "low", how: "Add more contextual internal links to under-linked pages." },
  // AEO (aeo.ts) — codes come through analyzeAeo recommendations
  no_lead_answer: { area: "aeo", effort: "low", how: "Open with a direct 1–3 sentence answer to the page's core question." },
  lead_answer_long: { area: "aeo", effort: "low", how: "Tighten the opening into a short, quotable answer; detail can follow." },
  no_question_headings: { area: "aeo", effort: "medium", how: "Rewrite H2/H3s as the questions buyers ask (how/what/why…)." },
  few_question_headings: { area: "aeo", effort: "low", how: "Add a few more question-style headings mapping to real queries." },
  no_faq_schema: { area: "aeo", effort: "medium", how: "Add FAQPage JSON-LD so AI answers can lift your Q&A directly." },
  no_lists_or_tables: { area: "aeo", effort: "low", how: "Break key points into bullet lists or a comparison table." },
  no_definition: { area: "aeo", effort: "low", how: "Add a 'X is …' definitional sentence engines can quote verbatim." },
  no_author: { area: "aeo", effort: "low", how: "Show an author/byline for E-E-A-T and answer trust." },
  no_date: { area: "aeo", effort: "low", how: "Show a published/updated date so engines can judge freshness." },
};

function actionFromIssue(code: string, severity: IssueSeverity, message: string): StrategyAction {
  const r = RECIPE[code] ?? { area: "onpage" as Area, effort: "medium" as Effort, how: "Review and resolve this issue." };
  const impact = severityToImpact(severity);
  return { area: r.area, title: message, why: whyFor(r.area), how: r.how, impact, effort: r.effort, priority: priorityOf(impact, r.effort) };
}

function whyFor(area: Area): string {
  switch (area) {
    case "indexing": return "If Google can't index it, nothing else matters.";
    case "technical": return "Technical blockers cap how high any page can rank.";
    case "onpage": return "On-page relevance signals tell Google what to rank you for.";
    case "content": return "Depth and helpfulness drive both rankings and AI citations.";
    case "aeo": return "Answer-engine structure is what gets you quoted by AI.";
    case "keywords": return "Striking-distance keywords are the fastest wins.";
  }
}

function cwvActions(cwv: CwvInput): StrategyAction[] {
  const out: StrategyAction[] = [];
  if (cwv.lcpMs != null && cwv.lcpMs > 2500)
    out.push({ area: "technical", title: `Slow LCP (${(cwv.lcpMs / 1000).toFixed(1)}s)`, why: "Core Web Vitals are a ranking signal and hurt conversions.", how: "Optimise the largest element: compress the hero image, preload it, cut render-blocking CSS/JS.", impact: "medium", effort: "high", priority: priorityOf("medium", "high") });
  if (cwv.inpMs != null && cwv.inpMs > 200)
    out.push({ area: "technical", title: `Sluggish INP (${Math.round(cwv.inpMs)}ms)`, why: "Poor interactivity frustrates users and dents Core Web Vitals.", how: "Break up long JavaScript tasks and defer non-critical scripts.", impact: "low", effort: "high", priority: priorityOf("low", "high") });
  if (cwv.cls != null && cwv.cls > 0.1)
    out.push({ area: "technical", title: `Layout shift (CLS ${cwv.cls.toFixed(2)})`, why: "Shifting content hurts UX and Core Web Vitals.", how: "Set explicit width/height on images and reserve space for embeds/ads.", impact: "low", effort: "medium", priority: priorityOf("low", "medium") });
  return out;
}

function keywordAction(k: KeywordRank): StrategyAction | null {
  if (k.position == null) {
    return { area: "content", title: `No page ranks for "${k.keyword}"`, why: "You can't win a query you have no page for.", how: `Create a focused page targeting "${k.keyword}" and the questions around it.`, impact: k.searchVolume >= 500 ? "high" : "medium", effort: "high", priority: priorityOf(k.searchVolume >= 500 ? "high" : "medium", "high") };
  }
  if (k.quickWin) {
    const target = k.position <= 10 ? "the top 3" : "page 1";
    return { area: "keywords", title: `Push "${k.keyword}" from #${k.position} to ${target}`, why: "Striking-distance keywords are the fastest, highest-ROI wins.", how: "Refresh and expand the ranking page, add internal links with the keyword anchor, and match search intent more tightly.", impact: "high", effort: "medium", priority: priorityOf("high", "medium") };
  }
  return null;
}

/** Build the full ranking strategy from whatever signals are available. */
export function buildStrategy(input: StrategyInput): Strategy {
  const actions: StrategyAction[] = [];

  // Indexing / crawl access are gating — surface them first and hardest.
  if (input.technical?.noindex)
    actions.push({ area: "indexing", title: "Page is set to noindex", why: "A noindex page can never rank — this is the #1 thing to fix.", how: "Remove the noindex meta/header unless this page is deliberately excluded.", impact: "high", effort: "low", priority: priorityOf("high", "low") + 10 });
  if (input.technical?.crawlerBlocked)
    actions.push({ area: "indexing", title: "Crawler blocked by robots.txt/CDN", why: "If Googlebot or AI bots can't fetch the page, it can't rank or be cited.", how: "Allow the relevant bots in robots.txt and check CDN/WAF rules.", impact: "high", effort: "low", priority: priorityOf("high", "low") + 10 });

  for (const i of input.onPageIssues ?? []) actions.push(actionFromIssue(i.code, i.severity, i.message));
  for (const i of input.siteIssues ?? []) actions.push(actionFromIssue(i.code, i.severity, i.message));
  for (const r of input.aeo?.recommendations ?? [])
    actions.push(actionFromIssue(r.code, r.severity, r.message));
  if (input.technical?.cwv) actions.push(...cwvActions(input.technical.cwv));
  if (input.keyword) {
    const ka = keywordAction(input.keyword);
    if (ka) actions.push(ka);
  }

  // De-duplicate by title, keeping the highest priority, then sort.
  const byTitle = new Map<string, StrategyAction>();
  for (const a of actions) {
    const prev = byTitle.get(a.title);
    if (!prev || a.priority > prev.priority) byTitle.set(a.title, a);
  }
  const ranked = [...byTitle.values()].sort((a, b) => b.priority - a.priority || IMPACT_WEIGHT[b.impact] - IMPACT_WEIGHT[a.impact]);

  // Scores.
  const penalty = (issues: SeoIssue[]) =>
    issues.reduce((s, i) => s + (i.severity === "high" ? 15 : i.severity === "medium" ? 8 : 3), 0);
  const classicPenalty = penalty(input.onPageIssues ?? []) + penalty(input.siteIssues ?? []);
  const classicScore = Math.max(0, 100 - classicPenalty);

  let technicalScore = 100;
  if (input.technical?.noindex) technicalScore -= 40;
  if (input.technical?.crawlerBlocked) technicalScore -= 40;
  const cwv = input.technical?.cwv;
  if (cwv?.lcpMs != null && cwv.lcpMs > 2500) technicalScore -= 15;
  if (cwv?.inpMs != null && cwv.inpMs > 200) technicalScore -= 10;
  if (cwv?.cls != null && cwv.cls > 0.1) technicalScore -= 10;
  technicalScore = Math.max(0, technicalScore);

  const aeoScore = input.aeo ? input.aeo.score : 50; // neutral when unknown

  // Weighted blend: AEO is heavily weighted because the product is about
  // AI-answer visibility, but classic SEO and technical still gate everything.
  const totalScore = Math.round(0.4 * classicScore + 0.35 * aeoScore + 0.25 * technicalScore);
  const grade: Strategy["grade"] = totalScore >= 90 ? "A" : totalScore >= 75 ? "B" : totalScore >= 60 ? "C" : totalScore >= 40 ? "D" : "F";

  const top = ranked[0];
  const summary = ranked.length === 0
    ? "No issues detected — maintain content freshness and keep earning links."
    : `Grade ${grade} (${totalScore}/100). ${ranked.length} prioritised action(s); start with: ${top?.title}.`;

  return { totalScore, classicScore, aeoScore, technicalScore, grade, actions: ranked, summary };
}
