/**
 * Readability scoring (content quality, FR-12/RS-204) — pure, testable.
 *
 * Clear writing ranks better and gets quoted more by AI answer engines, which
 * prefer text they can lift cleanly. This computes the Flesch Reading Ease score
 * and a U.S. grade level from a page's visible text, with a plain verdict and a
 * recommendation when the writing is too dense. No dictionary — syllables are
 * estimated with the standard vowel-group heuristic.
 */

function stripToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Estimate syllables in a word via vowel groups, with a silent-e adjustment. */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;
  let groups = (w.match(/[aeiouy]+/g) ?? []).length;
  if (/e\b/.test(w) && !/[aeiouy]e\b/.test(w)) groups -= 1; // silent terminal e
  return Math.max(1, groups);
}

export type ReadabilityVerdict = "very easy" | "easy" | "standard" | "difficult" | "very difficult";

export interface Readability {
  words: number;
  sentences: number;
  wordsPerSentence: number;
  syllablesPerWord: number;
  /** Flesch Reading Ease, 0–100 (higher = easier). */
  fleschReadingEase: number;
  /** Approximate U.S. school grade level (Flesch–Kincaid). */
  gradeLevel: number;
  verdict: ReadabilityVerdict;
}

function verdictFor(ease: number): ReadabilityVerdict {
  if (ease >= 80) return "very easy";
  if (ease >= 60) return "easy";
  if (ease >= 50) return "standard";
  if (ease >= 30) return "difficult";
  return "very difficult";
}

/** Score the readability of plain text. */
export function readability(text: string): Readability {
  const words = (text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? []) as string[];
  const sentenceCount = Math.max(1, (text.match(/[.!?]+(?:\s|$)/g) ?? []).length);
  const wordCount = words.length;
  if (wordCount === 0) {
    return { words: 0, sentences: sentenceCount, wordsPerSentence: 0, syllablesPerWord: 0, fleschReadingEase: 0, gradeLevel: 0, verdict: "very difficult" };
  }
  const syllables = words.reduce((s, w) => s + countSyllables(w), 0);
  const wordsPerSentence = wordCount / sentenceCount;
  const syllablesPerWord = syllables / wordCount;

  const ease = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
  const grade = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;

  return {
    words: wordCount,
    sentences: sentenceCount,
    wordsPerSentence: Math.round(wordsPerSentence * 10) / 10,
    syllablesPerWord: Math.round(syllablesPerWord * 100) / 100,
    fleschReadingEase: Math.max(0, Math.min(100, Math.round(ease * 10) / 10)),
    gradeLevel: Math.max(0, Math.round(grade * 10) / 10),
    verdict: verdictFor(ease),
  };
}

/** Score readability straight from a page's HTML. */
export function readabilityFromHtml(html: string): Readability {
  return readability(stripToText(html));
}
