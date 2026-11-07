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
  return {
    mentions: extractMentions(input.text, input.entities),
    citations: extractCitations(input.citedUrls, input.clientHosts),
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
