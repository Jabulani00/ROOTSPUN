import type { EngineCode } from "@rootspun/core";
import type { WorkerEnv } from "../env.js";
import {
  ProviderNotConfiguredError,
  type LlmAnswer,
  type LlmProvider,
  type SerpProvider,
} from "./types.js";

export * from "./types.js";

/**
 * Provider registry. Real adapters (DataForSEO/SerpApi, OpenAI, Gemini,
 * Perplexity) are wired here; until a key is present a provider throws
 * ProviderNotConfiguredError so a misconfigured deploy fails loudly rather than
 * silently producing empty data.
 */
export function getSerpProvider(env: WorkerEnv): SerpProvider {
  // TODO(phase1): implement DataForSEO / SerpApi adapters behind this interface.
  return {
    name: env.SERP_PROVIDER,
    async run() {
      throw new ProviderNotConfiguredError(env.SERP_PROVIDER);
    },
  };
}

const LLM_KEY_BY_ENGINE: Partial<Record<EngineCode, keyof WorkerEnv>> = {
  chatgpt: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
};

export function getLlmProvider(engine: EngineCode, env: WorkerEnv): LlmProvider {
  const keyName = LLM_KEY_BY_ENGINE[engine];
  const configured = keyName ? Boolean(env[keyName]) : false;
  return {
    engine,
    async sample(): Promise<LlmAnswer> {
      if (!configured) throw new ProviderNotConfiguredError(engine);
      // TODO(phase1): call the engine's API (OpenAI SDK; Perplexity is OpenAI-compatible).
      throw new ProviderNotConfiguredError(engine);
    },
  };
}
