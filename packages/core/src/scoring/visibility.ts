import type { EngineCode, Sample, Sentiment } from "../types.js";
import { AI_ENGINES } from "../types.js";

/**
 * Organic position → visibility in [0,1].
 *
 * Models the well-documented steep decay of organic click-through: position 1
 * captures roughly a third of attention and the curve falls off fast. We use a
 * smooth power-law decay rather than a hard CTR table so ranks beyond the first
 * page still contribute a small, monotonically decreasing signal.
 *
 *   rank 1  → 1.00
 *   rank 2  → ~0.55
 *   rank 3  → ~0.38
 *   rank 10 → ~0.13
 *   rank 20 → ~0.07
 *   absent  → 0
 */
export function positionVisibility(rank: number | null | undefined): number {
  if (rank == null || rank < 1 || !Number.isFinite(rank)) return 0;
  // 1 / rank^0.85, clamped to [0,1].
  const v = 1 / Math.pow(rank, 0.85);
  return clamp01(v);
}

const SENTIMENT_WEIGHT: Record<Sentiment, number> = {
  positive: 1,
  neutral: 0.75,
  negative: 0.4,
};

/**
 * One AI answer sample → visibility in [0,1].
 *
 * Combines three signals for the client brand:
 *   - presence & prominence: earlier mention = higher (1 / position decay)
 *   - sentiment: negative mentions are worth less than positive
 *   - citation bonus: being a cited source is stronger than a bare mention
 *
 * If the client is neither mentioned nor cited, visibility is 0.
 */
export function aiSampleVisibility(sample: Sample): number {
  const mentions = sample.mentions ?? [];
  const citations = sample.citations ?? [];

  const clientMentions = mentions.filter((m) => m.entity === "client");
  const clientCitations = citations.filter((c) => c.isClient);

  if (clientMentions.length === 0 && clientCitations.length === 0) return 0;

  let mentionSignal = 0;
  if (clientMentions.length > 0) {
    // Best (earliest, most positive) mention drives the signal.
    mentionSignal = Math.max(
      ...clientMentions.map((m) => {
        const prominence = 1 / Math.pow(Math.max(m.position, 1), 0.5);
        return prominence * SENTIMENT_WEIGHT[m.sentiment];
      }),
    );
  }

  let citationSignal = 0;
  if (clientCitations.length > 0) {
    citationSignal = Math.max(
      ...clientCitations.map((c) => 1 / Math.pow(Math.max(c.rank, 1), 0.5)),
    );
  }

  // Mention is the base; a citation adds up to a 25% boost on top.
  const base = Math.max(mentionSignal, citationSignal * 0.9);
  const boost = citationSignal > 0 && mentionSignal > 0 ? 0.25 * citationSignal : 0;
  return clamp01(base + boost);
}

/** Per-sample signal for any engine, dispatching on engine family. */
export function sampleVisibility(sample: Sample): number {
  if (isAiEngine(sample.engine)) return aiSampleVisibility(sample);
  return positionVisibility(sample.organicRank);
}

export function isAiEngine(engine: EngineCode): boolean {
  return AI_ENGINES.includes(engine);
}

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Population standard deviation of a list of numbers (0 for <2 items). */
export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
