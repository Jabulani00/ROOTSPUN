import type { Sentiment } from "../types.js";

/**
 * Tiny lexicon-based sentiment. Deliberately simple and transparent: it scores a
 * window of text around a brand mention by counting positive vs negative cue
 * words. It is a first-pass signal (RS-105 spot-check target ≥ 90% on clear
 * cases); a model-based pass can replace this behind the same signature.
 */
const POSITIVE = new Set([
  "best", "leading", "top", "excellent", "great", "popular", "trusted", "reliable",
  "recommended", "powerful", "favorite", "favourite", "strong", "innovative",
  "affordable", "intuitive", "loved", "robust", "praised", "preferred",
]);
const NEGATIVE = new Set([
  "worst", "poor", "bad", "slow", "expensive", "limited", "lacking", "weak",
  "buggy", "outdated", "complicated", "confusing", "unreliable", "criticized",
  "criticised", "disappointing", "overpriced", "clunky", "difficult",
]);
const NEGATORS = new Set(["not", "no", "never", "n't", "without", "hardly"]);

/** Score the sentiment of `window` text (already narrowed around a mention). */
export function scoreSentiment(windowText: string): Sentiment {
  const tokens = windowText.toLowerCase().match(/[a-z']+/g) ?? [];
  let score = 0;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    const flip = i > 0 && NEGATORS.has(tokens[i - 1]!);
    if (POSITIVE.has(tok)) score += flip ? -1 : 1;
    else if (NEGATIVE.has(tok)) score += flip ? 1 : -1;
  }
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

/** Extract a +/- `radius`-character window of text centred on `index`. */
export function windowAround(text: string, index: number, radius = 80): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end);
}
