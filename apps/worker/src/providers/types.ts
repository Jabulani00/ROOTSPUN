import type { EngineCode } from "@rootspun/core";

/** Raw organic + AI-block result for one prompt from a licensed SERP provider. */
export interface SerpResult {
  organic: { url: string; host: string; rank: number }[];
  aiOverviewPresent: boolean;
  aiModePresent: boolean;
  aiCitations: { url: string; host: string; rank: number }[];
  costUsd: number;
}

export interface SerpProvider {
  readonly name: string;
  run(input: { prompt: string; country: string; language: string }): Promise<SerpResult>;
}

/** One sampled answer from an AI assistant engine. */
export interface LlmAnswer {
  text: string;
  /** Model-reported citations where available (Perplexity, Gemini grounding). */
  citations: { url: string; host: string }[];
  costUsd: number;
}

export interface LlmProvider {
  readonly engine: EngineCode;
  sample(input: { prompt: string }): Promise<LlmAnswer>;
}

/** Thrown when a provider is referenced but its credentials are not configured. */
export class ProviderNotConfiguredError extends Error {
  constructor(name: string) {
    super(`Provider "${name}" is not configured — set its API key`);
    this.name = "ProviderNotConfiguredError";
  }
}
