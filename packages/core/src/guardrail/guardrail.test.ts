import { describe, expect, it } from "vitest";
import { checkBrief, clusterNearDuplicates, type BriefPage } from "./guardrail.js";

function titles(list: string[], author?: "first_party" | "third_party"): BriefPage[] {
  return list.map((title) => ({ title, author }));
}

describe("checkBrief — allowed", () => {
  it("passes a brief of genuinely distinct pages", () => {
    const r = checkBrief({
      pages: titles([
        "How to choose a CRM",
        "Pricing guide for small teams",
        "Integrating email with your pipeline",
        "Security and compliance overview",
      ]),
    });
    expect(r.allowed).toBe(true);
    expect(r.violations).toEqual([]);
  });
});

describe("checkBrief — doorway", () => {
  it("blocks location doorway pages", () => {
    const r = checkBrief({
      pages: titles([
        "Best Plumber in London",
        "Best Plumber in Paris",
        "Best Plumber in Berlin",
        "Best Plumber in Madrid",
        "Best Plumber in Rome",
      ]),
    });
    expect(r.allowed).toBe(false);
    const v = r.violations.find((x) => x.pattern === "doorway");
    expect(v?.ruleId).toBe("rule.spam.doorway");
    expect(v?.pageIndexes).toHaveLength(5);
  });
});

describe("checkBrief — scaled content", () => {
  it("blocks mass-produced near-duplicate pages", () => {
    const pages = titles(
      Array.from({ length: 12 }, (_, i) => `cheap widget review ${i + 1}`),
    );
    const r = checkBrief({ pages });
    expect(r.allowed).toBe(false);
    const v = r.violations.find((x) => x.pattern === "scaled_content");
    expect(v?.ruleId).toBe("rule.spam.scaled_content");
    expect(v!.pageIndexes.length).toBeGreaterThanOrEqual(5);
  });

  it("does not flag scaled content below the page threshold", () => {
    const pages = titles(Array.from({ length: 4 }, (_, i) => `cheap widget review ${i + 1}`));
    const r = checkBrief({ pages });
    expect(r.violations.find((x) => x.pattern === "scaled_content")).toBeUndefined();
  });
});

describe("checkBrief — site reputation", () => {
  it("blocks third-party content hosted on the client domain", () => {
    const pages = [
      { title: "Guest post about casinos", author: "third_party" as const },
      { title: "Our product update", author: "first_party" as const },
    ];
    const r = checkBrief({ pages, hostDomain: "client.com" });
    const v = r.violations.find((x) => x.pattern === "site_reputation");
    expect(v?.ruleId).toBe("rule.spam.site_reputation");
    expect(v?.pageIndexes).toEqual([0]);
    expect(r.allowed).toBe(false);
  });
});

describe("clusterNearDuplicates", () => {
  it("groups similar titles and separates distinct ones", () => {
    const clusters = clusterNearDuplicates(
      titles(["red shoes for men", "red shoes for women", "quantum physics primer"]),
    );
    const sizes = clusters.map((c) => c.length).sort();
    expect(sizes).toEqual([1, 2]);
  });
});
