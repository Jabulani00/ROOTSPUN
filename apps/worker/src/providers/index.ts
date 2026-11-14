import type { EngineCode } from "@rootspun/core";
import type { WorkerEnv } from "../env.js";
import { ProviderNotConfiguredError, type SerpProvider } from "./types.js";
import { openAiCompatibleProvider } from "./llm-openai.js";
import { anthropicProvider } from "./llm-anthropic.js";
import { dataForSeoProvider } from "./serp-dataforseo.js";

export * from "./types.js";

/**
 * Provider registry. Real adapters (DataForSEO/SerpApi, OpenAI, Gemini,
 * Perplexity) are wired here; until a key is present a provider throws
 * ProviderNotConfiguredError so a misconfigured deploy fails loudly rather than
 * silently producing empty data.
 */
export function getSerpProvider(env: WorkerEnv): SerpProvider {
  if (env.SERP_PROVIDER === "dataforseo") return dataForSeoProvider(env);
  // TODO: SerpApi adapter behind the same interface (swappable per the risk plan).
  return {
    name: env.SERP_PROVIDER,
    async run() {
      throw new ProviderNotConfiguredError(env.SERP_PROVIDER);
    },
  };
}

/** OpenAI-compatible engines (ChatGPT, Perplexity, Gemini). */
const OPENAI_COMPATIBLE: EngineCode[] = ["chatgpt", "perplexity", "gemini"];

export function getLlmProvider(engine: EngineCode, env: WorkerEnv) {
  if (OPENAI_COMPATIBLE.includes(engine)) {
    return openAiCompatibleProvider(engine, env);
  }
  if (engine === "claude") {
    return anthropicProvider(engine, env);
  }
  // copilot: licensed provider in a later phase.
  return {
    engine,
    async sample() {
      throw new ProviderNotConfiguredError(engine);
    },
  };
}
