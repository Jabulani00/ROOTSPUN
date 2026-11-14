import Anthropic from "@anthropic-ai/sdk";
import type { EngineCode } from "@rootspun/core";
import type { WorkerEnv } from "../env.js";
import { ProviderNotConfiguredError, type LlmAnswer, type LlmProvider } from "./types.js";

/**
 * Anthropic (Claude) adapter (RS-403). Samples what Claude answers for a prompt,
 * so the brand's visibility in Claude can be tracked alongside the other engines.
 * Default model claude-opus-5-5 (override via ANTHROPIC_MODEL); cost is estimated
 * from token usage at the model's published rates (NFR-09).
 */
const IN_PER_M = 4; // $/1M input tokens (claude-opus-5-5)
const OUT_PER_M = 20; // $/1M output tokens

export function anthropicProvider(engine: EngineCode, env: WorkerEnv): LlmProvider {
  return {
    engine,
    async sample({ prompt }): Promise<LlmAnswer> {
      if (!env.ANTHROPIC_API_KEY) throw new ProviderNotConfiguredError(engine);

      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
      const res = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      });

      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();

      const u = res.usage;
      const costUsd = u ? (u.input_tokens * IN_PER_M + u.output_tokens * OUT_PER_M) / 1_000_000 : 0;

      return { text, citations: [], costUsd: Math.round(costUsd * 1e5) / 1e5 };
    },
  };
}
