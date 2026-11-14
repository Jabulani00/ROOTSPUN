/**
 * Answer-Engine Optimization (AEO) analysis (RS-204) — pure, testable.
 *
 * Classic SEO asks "can this page rank?"; AEO asks "will an AI answer engine
 * quote this page?". Answer engines favour pages that state a concise answer up
 * front, structure content as questions, and expose machine-readable Q&A. This
 * extracts those signals from HTML and turns them into a 0–100 readiness score
 * plus ranked, actionable recommendations. Regex-based, no DOM, browser-safe.
 */

export interface AeoSignals {
  /** H2/H3 headings phrased as questions (how/what/why… or ending in "?"). */
  questionHeadings: number;
  /** Page exposes FAQPage / Question JSON-LD. */
  hasFaqSchema: boolean;
  /** Page exposes HowTo JSON-LD. */
  hasHowToSchema: boolean;
  /** Count of <ul>/<ol> lists (extractable, answer-friendly). */
  listCount: number;
  /** Count of <table> elements. */
  tableCount: number;
  /** A definitional "X is a/an/the…" sentence appears near the top. */
  hasLeadDefinition: boolean;
  /** Word count of the first substantive paragraph (the "lead answer"). */
  leadAnswerWords: number;
  /** Page shows an author/byline. */
  hasAuthor: boolean;
  /** Page shows a published/updated date. */
  hasDate: boolean;
}

export type AeoSeverity = "high" | "medium" | "low";
export interface AeoRecommendation {
  severity: AeoSeverity;
  code: string;
  message: string;
}

export interface AeoResult {
  score: number; // 0–100 readiness
  signals: AeoSignals;
  recommendations: AeoRecommendation[];
}

const QUESTION_WORDS = /^(how|what|why|when|where|who|which|can|does|do|is|are|should|will)\b/i;

function stripTags(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function headingTexts(html: string, tag: "h2" | "h3"): string[] {
  return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi"))].map((m) =>
    stripTags(m[1]!),
  );
}

/** JSON-LD @type matching (handles arrays and graph nodes loosely via regex). */
function hasLdType(html: string, type: RegExp): boolean {
  const blocks = [...html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  return blocks.some((b) => type.test(b[1] ?? ""));
}

/** Extract the AEO signals from a page's HTML. */
export function aeoSignals(html: string): AeoSignals {
  const h2 = headingTexts(html, "h2");
  const h3 = headingTexts(html, "h3");
  const questionHeadings = [...h2, ...h3].filter(
    (t) => t.endsWith("?") || QUESTION_WORDS.test(t),
  ).length;

  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1]!))
    .filter((t) => t.split(/\s+/).filter(Boolean).length >= 8);
  const lead = paragraphs[0] ?? "";
  const leadAnswerWords = lead ? lead.split(/\s+/).filter(Boolean).length : 0;
  const hasLeadDefinition = /\b\w[\w\s-]{1,60}?\s+(is|are|refers to|means)\s+(a|an|the|when|any|\d)/i.test(lead);

  return {
    questionHeadings,
    hasFaqSchema: hasLdType(html, /"FAQPage"|"Question"/i),
    hasHowToSchema: hasLdType(html, /"HowTo"/i),
    listCount: (html.match(/<(ul|ol)\b/gi) ?? []).length,
    tableCount: (html.match(/<table\b/gi) ?? []).length,
    hasLeadDefinition,
    leadAnswerWords,
    hasAuthor: /\b(rel\s*=\s*["']author["']|class\s*=\s*["'][^"']*author|byline|"author"\s*:)/i.test(html),
    hasDate:
      /<time\b[^>]*datetime=/i.test(html) ||
      /"datePublished"|"dateModified"/i.test(html) ||
      /\b(published|updated)\s+(on\s+)?\w+\s+\d{1,2},?\s+\d{4}/i.test(stripTags(html).slice(0, 4000)),
  };
}

/** Score AEO readiness 0–100 and produce ranked recommendations. */
export function analyzeAeo(html: string): AeoResult {
  const s = aeoSignals(html);
  const recs: AeoRecommendation[] = [];
  const add = (severity: AeoSeverity, code: string, message: string) =>
    recs.push({ severity, code, message });

  // Weighted scoring — each component contributes to the 0–100 total.
  let score = 0;

  // Concise lead answer (25): ideal 15–60 words. Too long or missing hurts.
  if (s.leadAnswerWords === 0) {
    add("high", "no_lead_answer", "No clear lead paragraph — open with a concise 1–3 sentence answer");
  } else if (s.leadAnswerWords <= 60) {
    score += 25;
  } else if (s.leadAnswerWords <= 90) {
    score += 15;
    add("low", "lead_answer_long", `Lead paragraph is long (~${s.leadAnswerWords} words) — tighten the opening answer`);
  } else {
    score += 5;
    add("medium", "lead_answer_long", `Lead paragraph is very long (~${s.leadAnswerWords} words) — AI engines favour a short direct answer up top`);
  }

  // Question-style headings (20): structure content as the questions users ask.
  if (s.questionHeadings >= 2) score += 20;
  else if (s.questionHeadings === 1) {
    score += 10;
    add("low", "few_question_headings", "Only one question-style heading — phrase more sections as the questions buyers ask");
  } else add("high", "no_question_headings", "No question-style headings — AI answers map to H2/H3 phrased as questions");

  // FAQ schema (20): machine-readable Q&A is prime AI-citation fuel.
  if (s.hasFaqSchema) score += 20;
  else add("high", "no_faq_schema", "No FAQPage structured data — add FAQ schema so engines can lift Q&A directly");

  // Lists or tables (15): extractable, answer-friendly structure.
  if (s.listCount > 0 || s.tableCount > 0) score += 15;
  else add("medium", "no_lists_or_tables", "No lists or tables — break key points into bullets/steps for easy extraction");

  // HowTo schema (5): bonus for procedural content.
  if (s.hasHowToSchema) score += 5;

  // Definitional lead (5): "X is …" sentences are quoted verbatim.
  if (s.hasLeadDefinition) score += 5;
  else add("low", "no_definition", "Open with a definitional sentence (“X is …”) — engines quote these directly");

  // Author + date (10): E-E-A-T / freshness signals.
  if (s.hasAuthor) score += 5;
  else add("low", "no_author", "No visible author/byline — add one for E-E-A-T and answer trust");
  if (s.hasDate) score += 5;
  else add("low", "no_date", "No published/updated date — add one so engines can judge freshness");

  const order: Record<AeoSeverity, number> = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => order[a.severity] - order[b.severity]);

  return { score: Math.min(100, score), signals: s, recommendations: recs };
}
