import OpenAI from "openai";
import { normalizeHost, type EngineCode } from "@rootspun/core";
import type { WorkerEnv } from "../env.js";
import { ProviderNotConfiguredError, type LlmAnswer, type LlmProvider } from "./types.js";

/**
 * OpenAI-compatible LLM adapter (RS-104). ChatGPT uses the OpenAI API directly;
 * Perplexity and Gemini expose OpenAI-compatible endpoints, so the same SDK
 * serves them with a different base URL. Models are overridable via env.
 *
 * Costs are estimated from token usage (NFR-09); rates are $ per 1M tokens.
 */
interface EngineCfg {
  baseURL?: string;
  apiKey: string;
  model: string;
  inPerM: number;
  outPerM: number;
}

function configFor(engine: EngineCode, env: WorkerEnv): EngineCfg | null {
  switch (engine) {
    case "chatgpt":
      return env.OPENAI_API_KEY
        ? { apiKey: env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL ?? "gpt-4o-mini", inPerM: 0.15, outPerM: 0.6 }
        : null;
    case "perplexity":
      return env.PERPLEXITY_API_KEY
        ? {
            baseURL: "https://api.perplexity.ai",
            apiKey: env.PERPLEXITY_API_KEY,
            model: process.env.PERPLEXITY_MODEL ?? "sonar",
            inPerM: 1,
            outPerM: 1,
          }
        : null;
    case "gemini":
      return env.GEMINI_API_KEY
        ? {
            baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
            apiKey: env.GEMINI_API_KEY,
            model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
            inPerM: 0.1,
            outPerM: 0.4,
          }
        : null;
    default:
      return null; // claude/copilot: phase 4, handled elsewhere
  }
}

/** Pull model-reported citations (Perplexity returns a top-level `citations` array). */
function extractCitations(response: unknown): { url: string; host: string }[] {
  const cites = (response as { citations?: unknown }).citations;
  if (!Array.isArray(cites)) return [];
  return cites
    .filter((c): c is string => typeof c === "string")
    .map((url) => ({ url, host: normalizeHost(url) }));
}

export function openAiCompatibleProvider(engine: EngineCode, env: WorkerEnv): LlmProvider {
  return {
    engine,
    async sample({ prompt }): Promise<LlmAnswer> {
      const cfg = configFor(engine, env);
      if (!cfg) throw new ProviderNotConfiguredError(engine);

      const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
      const res = await client.chat.completions.create({
        model: cfg.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      });

      const text = res.choices[0]?.message?.content ?? "";
      const usage = res.usage;
      const costUsd = usage
        ? (usage.prompt_tokens * cfg.inPerM + usage.completion_tokens * cfg.outPerM) / 1_000_000
        : 0;

      return { text, citations: extractCitations(res), costUsd: round5(costUsd) };
    },
  };
}

function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}
