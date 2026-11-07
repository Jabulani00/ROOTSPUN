import { describe, expect, it } from "vitest";
import { diagnose, impactScore, mostLikelyCause } from "./diagnose.js";
import type { LossContext } from "./types.js";

const base: LossContext = {
  clientId: "c1",
  promptId: "p1",
  engine: "google_organic",
};

describe("diagnose", () => {
  it("returns nothing when no signal indicates a problem", () => {
    expect(diagnose({ ...base, indexedInGsc: true, robotsAllowed: true })).toEqual([]);
  });

  it("flags noindex as a high-confidence not_indexed cause", () => {
    const [cause] = diagnose({ ...base, metaRobotsNoindex: true });
    expect(cause?.type).toBe("not_indexed");
    expect(cause?.confidence).toBe("high");
    expect(cause?.ruleId).toBe("rule.indexing.noindex");
    expect(cause?.evidence.metaRobotsNoindex).toBe(true);
  });

  it("flags a 4xx status as not_indexed", () => {
    const [cause] = diagnose({ ...base, httpStatus: 404 });
    expect(cause?.type).toBe("not_indexed");
    expect(cause?.confidence).toBe("high");
  });

  it("flags robots.txt disallow as crawl_blocked", () => {
    const [cause] = diagnose({ ...base, robotsAllowed: false });
    expect(cause?.type).toBe("crawl_blocked");
    expect(cause?.confidence).toBe("high");
  });

  it("flags CDN bot blocks as crawl_blocked", () => {
    const [cause] = diagnose({ ...base, cdnBlockedBots: ["GPTBot", "PerplexityBot"] });
    expect(cause?.type).toBe("crawl_blocked");
    expect(cause?.evidence.cdnBlockedBots).toEqual(["GPTBot", "PerplexityBot"]);
  });

  it("flags nosnippet as snippet_blocked", () => {
    const [cause] = diagnose({ ...base, engine: "ai_overview", nosnippet: true });
    expect(cause?.type).toBe("snippet_blocked");
  });

  it("flags poor Core Web Vitals as slow_template with capped confidence", () => {
    const [cause] = diagnose({
      ...base,
      indexedInGsc: true,
      robotsAllowed: true,
      cwv: { lcpMs: 5000, inpMs: 400, cls: 0.4 },
    });
    expect(cause?.type).toBe("slow_template");
    // CWV alone is never high-confidence
    expect(cause?.confidence).not.toBe("high");
    expect((cause?.evidence.failures as string[]).length).toBe(3);
  });

  it("does not flag CWV when within good thresholds", () => {
    const causes = diagnose({
      ...base,
      indexedInGsc: true,
      robotsAllowed: true,
      cwv: { lcpMs: 2000, inpMs: 150, cls: 0.05 },
    });
    expect(causes.find((c) => c.type === "slow_template")).toBeUndefined();
  });

  it("flags no_answering_page", () => {
    const [cause] = diagnose({ ...base, hasAnsweringPage: false });
    expect(cause?.type).toBe("no_answering_page");
  });

  it("flags competitor_cited and ranks a fundamental blocker above it", () => {
    const causes = diagnose({
      ...base,
      engine: "ai_mode",
      metaRobotsNoindex: true,
      competitorCitedHosts: ["rival.com"],
    });
    // not_indexed (0.92) should outrank competitor_cited
    expect(causes[0]?.type).toBe("not_indexed");
    expect(causes.some((c) => c.type === "competitor_cited")).toBe(true);
  });

  it("orders multiple causes by descending score deterministically", () => {
    const causes = diagnose({
      ...base,
      robotsAllowed: false, // crawl_blocked 0.9
      cwv: { lcpMs: 9000 }, // slow_template low
    });
    const scores = causes.map((c) => c.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(causes[0]?.type).toBe("crawl_blocked");
  });
});

describe("mostLikelyCause", () => {
  it("returns the top cause or null", () => {
    expect(mostLikelyCause({ ...base, indexedInGsc: true, robotsAllowed: true })).toBeNull();
    expect(mostLikelyCause({ ...base, metaRobotsNoindex: true })?.type).toBe("not_indexed");
  });
});

describe("impactScore", () => {
  it("multiplies volume by lost visibility with floors", () => {
    expect(impactScore({ ...base, searchVolume: 1000, lostVisibility: 0.5 })).toBe(500);
    expect(impactScore({ ...base, searchVolume: 0, lostVisibility: 0 })).toBe(0);
    // volume floored at 1, lost defaults to 1
    expect(impactScore({ ...base })).toBe(1);
  });
});
