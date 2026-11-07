import { describe, expect, it } from "vitest";
import {
  confidenceFrom,
  promptVisibility,
  scoreSlice,
  shareOfVoice,
  unifiedVisibilityScore,
} from "./uvs.js";
import type { PromptInput } from "../types.js";

function organicPrompt(id: string, ranks: number[], volume = 100): PromptInput {
  return {
    promptId: id,
    topic: "t",
    searchVolume: volume,
    samples: ranks.map((r) => ({ engine: "google_organic", organicRank: r })),
  };
}

describe("promptVisibility", () => {
  it("averages samples per engine and reports sample count & variance", () => {
    const pv = promptVisibility(organicPrompt("p1", [1, 1, 1]))[0]!;
    expect(pv.engine).toBe("google_organic");
    expect(pv.visibility).toBe(1);
    expect(pv.sampleCount).toBe(3);
    expect(pv.variance).toBe(0);
  });

  it("splits by engine", () => {
    const input: PromptInput = {
      promptId: "p",
      topic: "t",
      searchVolume: 10,
      samples: [
        { engine: "google_organic", organicRank: 1 },
        { engine: "chatgpt", mentions: [{ entity: "client", position: 1, sentiment: "positive" }] },
      ],
    };
    const pvs = promptVisibility(input);
    expect(pvs.map((p) => p.engine).sort()).toEqual(["chatgpt", "google_organic"]);
  });
});

describe("unifiedVisibilityScore", () => {
  it("is 0 for no prompts and 100 for all rank-1", () => {
    expect(unifiedVisibilityScore([]).uvs).toBe(0);
    const pvs = promptVisibility(organicPrompt("p", [1, 1, 1]));
    expect(unifiedVisibilityScore(pvs).uvs).toBe(100);
  });

  it("weights by search volume", () => {
    // high-volume prompt ranks 1 (vis 1), low-volume ranks poorly (~0)
    const hi = promptVisibility(organicPrompt("hi", [1], 1000));
    const lo = promptVisibility(organicPrompt("lo", [50], 1));
    const score = unifiedVisibilityScore([...hi, ...lo]).uvs;
    // dominated by the high-volume rank-1 prompt → close to 100
    expect(score).toBeGreaterThan(95);
  });

  it("reports prompts scored and total samples", () => {
    const pvs = promptVisibility(organicPrompt("p", [1, 2, 3]));
    const r = unifiedVisibilityScore(pvs);
    expect(r.promptsScored).toBe(1);
    expect(r.totalSamples).toBe(3);
  });
});

describe("confidenceFrom", () => {
  it("is low with no prompts or too few samples", () => {
    expect(confidenceFrom([])).toBe("low");
    expect(confidenceFrom(promptVisibility(organicPrompt("p", [1])))).toBe("low");
  });
  it("is high with 3 agreeing samples", () => {
    expect(confidenceFrom(promptVisibility(organicPrompt("p", [1, 1, 1])))).toBe("high");
  });
  it("is medium with high-variance samples", () => {
    // ranks 1 and 50 → very different per-sample signals → high variance
    const pv = promptVisibility(organicPrompt("p", [1, 50, 1]));
    expect(confidenceFrom(pv)).toBe("medium");
  });
});

describe("shareOfVoice", () => {
  it("is 0 when there are no mentions anywhere", () => {
    expect(shareOfVoice([organicPrompt("p", [1])])).toBe(0);
  });

  it("computes client share across mentions", () => {
    const input: PromptInput = {
      promptId: "p",
      topic: "t",
      searchVolume: 100,
      samples: [
        {
          engine: "chatgpt",
          mentions: [
            { entity: "client", position: 1, sentiment: "positive" },
            { entity: "comp-a", position: 2, sentiment: "neutral" },
            { entity: "comp-b", position: 3, sentiment: "neutral" },
          ],
        },
      ],
    };
    // 1 of 3 mentions is the client
    expect(shareOfVoice([input])).toBeCloseTo(33.3, 1);
  });
});

describe("scoreSlice", () => {
  it("returns uvs, share of voice and confidence together", () => {
    const input: PromptInput = {
      promptId: "p",
      topic: "t",
      searchVolume: 100,
      samples: [
        {
          engine: "chatgpt",
          mentions: [
            { entity: "client", position: 1, sentiment: "positive" },
            { entity: "comp-a", position: 2, sentiment: "neutral" },
          ],
          citations: [{ host: "client.com", isClient: true, rank: 1 }],
        },
        {
          engine: "chatgpt",
          mentions: [{ entity: "client", position: 1, sentiment: "positive" }],
        },
        {
          engine: "chatgpt",
          mentions: [{ entity: "client", position: 2, sentiment: "neutral" }],
        },
      ],
    };
    const r = scoreSlice([input]);
    expect(r.uvs).toBeGreaterThan(0);
    expect(r.uvs).toBeLessThanOrEqual(100);
    expect(r.shareOfVoice).toBeGreaterThan(0);
    expect(["high", "medium", "low"]).toContain(r.confidence);
    expect(r.totalSamples).toBe(3);
  });
});
