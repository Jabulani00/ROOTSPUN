import type {
  Confidence,
  EngineCode,
  PromptInput,
  PromptVisibility,
  UnifiedVisibilityScore,
} from "../types.js";
import { mean, sampleVisibility, stddev } from "./visibility.js";

/**
 * Collapse a prompt's samples (3 per engine, NFR-07) into a single per-engine
 * visibility, keeping the variance so the UI can show a confidence note rather
 * than a single yes/no.
 */
export function promptVisibility(input: PromptInput): PromptVisibility[] {
  const byEngine = new Map<EngineCode, number[]>();
  for (const s of input.samples) {
    const list = byEngine.get(s.engine) ?? [];
    list.push(sampleVisibility(s));
    byEngine.set(s.engine, list);
  }

  const out: PromptVisibility[] = [];
  for (const [engine, signals] of byEngine) {
    out.push({
      promptId: input.promptId,
      topic: input.topic,
      engine,
      visibility: mean(signals),
      sampleCount: signals.length,
      variance: stddev(signals),
      searchVolume: Math.max(input.searchVolume, 0),
    });
  }
  return out;
}

/** Weight = search volume, floored at 1 so zero-volume prompts still count a little. */
function weightOf(pv: PromptVisibility): number {
  return Math.max(pv.searchVolume, 1);
}

/**
 * Confidence from sample coverage and agreement:
 *   - fewer than 2 samples/engine on average  → low
 *   - high variance across samples            → medium
 *   - otherwise                                → high
 */
export function confidenceFrom(prompts: PromptVisibility[]): Confidence {
  if (prompts.length === 0) return "low";
  const avgSamples = mean(prompts.map((p) => p.sampleCount));
  const avgVariance = mean(prompts.map((p) => p.variance));
  if (avgSamples < 2) return "low";
  if (avgVariance > 0.25) return "medium";
  return "high";
}

/**
 * Unified Visibility Score (FR-08 / RS-106): a single 0–100 number for a given
 * slice (client × engine(s) × topic × day), volume-weighted across prompts.
 *
 * Pass the prompt visibilities you want aggregated — callers filter by engine
 * and/or topic before calling to get per-engine or per-topic scores.
 */
export function unifiedVisibilityScore(
  prompts: PromptVisibility[],
): Pick<UnifiedVisibilityScore, "uvs" | "confidence" | "promptsScored" | "totalSamples"> {
  if (prompts.length === 0) {
    return { uvs: 0, confidence: "low", promptsScored: 0, totalSamples: 0 };
  }
  const totalWeight = prompts.reduce((a, p) => a + weightOf(p), 0);
  const weighted = prompts.reduce((a, p) => a + p.visibility * weightOf(p), 0);
  const uvs = round1((weighted / totalWeight) * 100);
  return {
    uvs,
    confidence: confidenceFrom(prompts),
    promptsScored: prompts.length,
    totalSamples: prompts.reduce((a, p) => a + p.sampleCount, 0),
  };
}

/**
 * Competitor share of voice: the client's share of all brand + competitor
 * mentions across the given samples, volume-weighted by prompt (FR-08).
 * Returns 0–100.
 */
export function shareOfVoice(inputs: PromptInput[]): number {
  let clientWeighted = 0;
  let totalWeighted = 0;
  for (const input of inputs) {
    const weight = Math.max(input.searchVolume, 1);
    let client = 0;
    let all = 0;
    for (const s of input.samples) {
      for (const m of s.mentions ?? []) {
        all += 1;
        if (m.entity === "client") client += 1;
      }
    }
    if (all === 0) continue;
    clientWeighted += (client / all) * weight;
    totalWeighted += weight;
  }
  if (totalWeighted === 0) return 0;
  return round1((clientWeighted / totalWeighted) * 100);
}

/** Full UVS + share of voice over a slice of raw prompt inputs. */
export function scoreSlice(inputs: PromptInput[]): UnifiedVisibilityScore {
  const pvs = inputs.flatMap(promptVisibility);
  const base = unifiedVisibilityScore(pvs);
  return {
    ...base,
    shareOfVoice: shareOfVoice(inputs),
  };
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
