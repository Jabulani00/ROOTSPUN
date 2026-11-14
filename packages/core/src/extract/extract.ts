import type { Citation, Mention } from "../types.js";
import { scoreSentiment, windowAround } from "./sentiment.js";

/** Terms that identify one entity (the client or a competitor). */
export interface EntityTerms {
  entity: "client" | (string & {});
  terms: string[];
}

export interface ExtractInput {
  /** The generated answer text. */
  text: string;
  /** URLs cited by the answer (in order of appearance). */
  citedUrls: string[];
  /** Host(s) owned by the client, for isClient tagging. */
  clientHosts: string[];
  /** Client + competitor term lists. */
  entities: EntityTerms[];
  /**
   * Also pull URLs embedded in the answer text (markdown links + bare URLs) and
   * append any not already in `citedUrls`. Many engines (Perplexity, ChatGPT
   * with browsing) cite inline rather than via a structured list, so this
   * recovers citations the provider didn't hand us separately. Default false to
   * keep callers that already pass a clean citation list unchanged.
   */
  autoDiscoverUrls?: boolean;
}

export interface ExtractResult {
  mentions: Mention[];
  citations: Citation[];
}

/** Normalise a URL (or bare host) to a lowercase registrable host without www. */
export function normalizeHost(urlOrHost: string): string {
  let h = urlOrHost.trim().toLowerCase();
  h = h.replace(/^[a-z]+:\/\//, ""); // scheme
  h = h.replace(/^www\./, "");
  h = h.replace(/[/?#].*$/, ""); // path/query/hash
  h = h.replace(/:\d+$/, ""); // port
  return h;
}

/**
 * Pull URLs out of answer text: markdown links `[label](url)` first, then bare
 * `http(s)://…` URLs. Trailing sentence punctuation and wrapping brackets are
 * trimmed, and results are de-duplicated preserving first-seen order.
 */
export function extractUrlsFromText(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string) => {
    // Strip trailing punctuation and a dangling close-paren/bracket/quote.
    const url = raw.replace(/[)\]>"'.,;:!?]+$/, "").trim();
    if (!/^https?:\/\/\S+\.\S+/i.test(url)) return;
    const key = url.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(url);
  };

  for (const m of text.matchAll(/\]\(\s*(https?:\/\/[^\s)]+)\s*\)/gi)) push(m[1]!);
  for (const m of text.matchAll(/\bhttps?:\/\/[^\s<>()[\]"']+/gi)) push(m[0]!);
  return out;
}

/** Map cited URLs to Citation rows, tagging client-owned hosts. */
export function extractCitations(citedUrls: string[], clientHosts: string[]): Citation[] {
  const clientSet = new Set(clientHosts.map(normalizeHost));
  return citedUrls.map((url, i) => {
    const host = normalizeHost(url);
    return { host, isClient: clientSet.has(host), rank: i + 1 };
  });
}

function firstTermIndex(text: string, terms: string[]): number {
  let best = -1;
  const lower = text.toLowerCase();
  for (const term of terms) {
    const t = term.trim().toLowerCase();
    if (!t) continue;
    // word-ish boundary so "crm" doesn't match inside "crminal"
    const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(t)}([^a-z0-9]|$)`, "i");
    const m = re.exec(lower);
    if (m) {
      const idx = m.index + (m[1]?.length ?? 0);
      if (best === -1 || idx < best) best = idx;
    }
  }
  return best;
}

/**
 * Find which entities are mentioned in the answer and in what order. Position is
 * the 1-based order of first appearance; sentiment is scored from the surrounding
 * window. Entities not mentioned are omitted.
 */
export function extractMentions(text: string, entities: EntityTerms[]): Mention[] {
  const found = entities
    .map((e) => ({ entity: e.entity, index: firstTermIndex(text, e.terms) }))
    .filter((x) => x.index >= 0)
    .sort((a, b) => a.index - b.index);

  return found.map((x, i) => ({
    entity: x.entity,
    position: i + 1,
    sentiment: scoreSentiment(windowAround(text, x.index)),
  }));
}

/** Full extraction for one answer (RS-105): mentions + citations. */
export function extractAnswer(input: ExtractInput): ExtractResult {
  let urls = input.citedUrls;
  if (input.autoDiscoverUrls) {
    const have = new Set(input.citedUrls.map((u) => u.toLowerCase()));
    const discovered = extractUrlsFromText(input.text).filter((u) => !have.has(u.toLowerCase()));
    urls = [...input.citedUrls, ...discovered];
  }
  return {
    mentions: extractMentions(input.text, input.entities),
    citations: extractCitations(urls, input.clientHosts),
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
