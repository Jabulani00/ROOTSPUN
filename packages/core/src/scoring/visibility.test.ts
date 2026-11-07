import { describe, expect, it } from "vitest";
import {
  aiSampleVisibility,
  clamp01,
  mean,
  positionVisibility,
  sampleVisibility,
  stddev,
} from "./visibility.js";
import type { Sample } from "../types.js";

describe("positionVisibility", () => {
  it("is 1.0 at rank 1 and decays monotonically", () => {
    expect(positionVisibility(1)).toBe(1);
    expect(positionVisibility(2)).toBeLessThan(positionVisibility(1));
    expect(positionVisibility(10)).toBeLessThan(positionVisibility(3));
    expect(positionVisibility(20)).toBeLessThan(positionVisibility(10));
  });

  it("returns 0 for absent / invalid ranks", () => {
    expect(positionVisibility(null)).toBe(0);
    expect(positionVisibility(undefined)).toBe(0);
    expect(positionVisibility(0)).toBe(0);
    expect(positionVisibility(-3)).toBe(0);
    expect(positionVisibility(Number.NaN)).toBe(0);
    expect(positionVisibility(Infinity)).toBe(0);
  });

  it("stays within [0,1]", () => {
    for (const r of [1, 2, 5, 50, 100]) {
      const v = positionVisibility(r);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("aiSampleVisibility", () => {
  const base: Sample = { engine: "chatgpt" };

  it("is 0 when the client is neither mentioned nor cited", () => {
    expect(aiSampleVisibility(base)).toBe(0);
    expect(
      aiSampleVisibility({
        ...base,
        mentions: [{ entity: "competitor-a", position: 1, sentiment: "positive" }],
      }),
    ).toBe(0);
  });

  it("rewards an early positive client mention more than a late negative one", () => {
    const early = aiSampleVisibility({
      ...base,
      mentions: [{ entity: "client", position: 1, sentiment: "positive" }],
    });
    const late = aiSampleVisibility({
      ...base,
      mentions: [{ entity: "client", position: 5, sentiment: "negative" }],
    });
    expect(early).toBeGreaterThan(late);
    expect(early).toBeGreaterThan(0);
  });

  it("gives a citation boost when both mention and citation are present", () => {
    const mentionOnly = aiSampleVisibility({
      ...base,
      mentions: [{ entity: "client", position: 2, sentiment: "neutral" }],
    });
    const mentionAndCite = aiSampleVisibility({
      ...base,
      mentions: [{ entity: "client", position: 2, sentiment: "neutral" }],
      citations: [{ host: "client.com", isClient: true, rank: 1 }],
    });
    expect(mentionAndCite).toBeGreaterThan(mentionOnly);
  });

  it("counts a bare client citation even with no mention", () => {
    const v = aiSampleVisibility({
      ...base,
      citations: [{ host: "client.com", isClient: true, rank: 1 }],
    });
    expect(v).toBeGreaterThan(0);
  });
});

describe("sampleVisibility dispatch", () => {
  it("uses organic rank for google_organic", () => {
    expect(sampleVisibility({ engine: "google_organic", organicRank: 1 })).toBe(1);
  });
  it("uses AI logic for ai engines", () => {
    expect(
      sampleVisibility({
        engine: "perplexity",
        mentions: [{ entity: "client", position: 1, sentiment: "positive" }],
      }),
    ).toBeGreaterThan(0);
  });
});

describe("stats helpers", () => {
  it("clamp01 bounds values and handles NaN", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(Number.NaN)).toBe(0);
  });
  it("mean and stddev", () => {
    expect(mean([])).toBe(0);
    expect(mean([2, 4])).toBe(3);
    expect(stddev([5])).toBe(0);
    expect(stddev([0, 1])).toBeCloseTo(0.5, 5);
  });
});
