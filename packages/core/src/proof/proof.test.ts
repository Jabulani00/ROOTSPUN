import { describe, expect, it } from "vitest";
import { computeLift, rankFixTypesByLift, windowElapsed } from "./proof.js";

describe("computeLift (difference-in-differences)", () => {
  it("nets out tide movement from the control group", () => {
    // treated rose 10, control rose 4 → net lift 6
    const r = computeLift({ metric: "uvs", treatedBefore: 50, treatedAfter: 60, controlBefore: 50, controlAfter: 54 });
    expect(r.treatedDelta).toBe(10);
    expect(r.controlDelta).toBe(4);
    expect(r.netLift).toBe(6);
    expect(r.netLiftPct).toBe(12); // 6 / 50 * 100
  });

  it("can be negative when the fix underperforms the tide", () => {
    const r = computeLift({ metric: "citations", treatedBefore: 20, treatedAfter: 22, controlBefore: 20, controlAfter: 26 });
    expect(r.netLift).toBe(-4);
  });

  it("returns null percent when the baseline is zero", () => {
    const r = computeLift({ metric: "gsc_clicks", treatedBefore: 0, treatedAfter: 10, controlBefore: 0, controlAfter: 3 });
    expect(r.netLift).toBe(7);
    expect(r.netLiftPct).toBeNull();
  });
});

describe("windowElapsed", () => {
  const shipped = new Date("2026-01-01T00:00:00Z");
  it("is false before the window and true after", () => {
    expect(windowElapsed(shipped, 14, new Date("2026-01-10T00:00:00Z"))).toBe(false);
    expect(windowElapsed(shipped, 14, new Date("2026-01-15T00:00:00Z"))).toBe(true);
    expect(windowElapsed(shipped, 28, new Date("2026-01-29T00:00:00Z"))).toBe(true);
  });
});

describe("rankFixTypesByLift", () => {
  it("ranks by mean lift, tie-breaking on sample count", () => {
    const ranked = rankFixTypesByLift([
      { fixType: "not_indexed", netLift: 10 },
      { fixType: "not_indexed", netLift: 20 },
      { fixType: "slow_template", netLift: 15 },
      { fixType: "no_answering_page", netLift: 15 },
      { fixType: "no_answering_page", netLift: 15 },
    ]);
    expect(ranked[0]?.fixType).toBe("not_indexed"); // mean 15, n2 beats slow_template mean15 n1
    expect(ranked[0]?.meanLift).toBe(15);
    // no_answering_page also mean 15 n2 — tie with not_indexed broken by insertion/stable sort
    expect(ranked.find((r) => r.fixType === "slow_template")?.n).toBe(1);
  });

  it("handles an empty list", () => {
    expect(rankFixTypesByLift([])).toEqual([]);
  });
});
