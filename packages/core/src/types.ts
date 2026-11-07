/**
 * Shared domain types for scoring and the Why Engine.
 * These are deliberately decoupled from the database row types in `@rootspun/db`
 * so the pure functions here can be unit-tested without a database.
 */

export type EngineCode =
  | "google_organic"
  | "ai_overview"
  | "ai_mode"
  | "chatgpt"
  | "gemini"
  | "perplexity"
  | "claude"
  | "copilot";

/** Engines where position is an integer organic rank (SERP). */
export const ORGANIC_ENGINES: readonly EngineCode[] = ["google_organic"];

/** Engines where visibility is presence/citation in a generated answer. */
export const AI_ENGINES: readonly EngineCode[] = [
  "ai_overview",
  "ai_mode",
  "chatgpt",
  "gemini",
  "perplexity",
  "claude",
  "copilot",
];

export type Sentiment = "positive" | "neutral" | "negative";

export interface Mention {
  /** "client" for the tracked brand, otherwise a competitor identifier. */
  entity: "client" | (string & {});
  /** 1-based order of appearance within the answer/result (1 = most prominent). */
  position: number;
  sentiment: Sentiment;
}

export interface Citation {
  host: string;
  isClient: boolean;
  /** 1-based rank of the citation within the answer. */
  rank: number;
}

/**
 * One sample = one run of one prompt on one engine (NFR-07: 3 per engine).
 * For organic engines `organicRank` is set; for AI engines `mentions`/`citations`
 * describe the generated answer.
 */
export interface Sample {
  engine: EngineCode;
  /** Organic position of the client's best-ranking URL, if present. */
  organicRank?: number | null;
  mentions?: Mention[];
  citations?: Citation[];
}

export interface PromptInput {
  promptId: string;
  topic: string;
  /** Monthly search volume; used as the aggregation weight (RS-106). */
  searchVolume: number;
  samples: Sample[];
}

export interface PromptVisibility {
  promptId: string;
  topic: string;
  engine: EngineCode;
  /** Visibility in [0,1] for this prompt on this engine. */
  visibility: number;
  /** Number of samples that contributed. */
  sampleCount: number;
  /** Sample-to-sample standard deviation of the per-sample signal. */
  variance: number;
  searchVolume: number;
}

export type Confidence = "high" | "medium" | "low";

export interface UnifiedVisibilityScore {
  /** 0–100, volume-weighted across prompts (FR-08). */
  uvs: number;
  /** 0–100 client share of all brand+competitor mentions. */
  shareOfVoice: number;
  confidence: Confidence;
  promptsScored: number;
  totalSamples: number;
}
