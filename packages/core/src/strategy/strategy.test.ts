import { describe, expect, it } from "vitest";
import { buildStrategy } from "./strategy.js";
import type { SeoIssue } from "../seo/analyze.js";

describe("buildStrategy", () => {
  it("puts indexing blockers at the very top", () => {
    const s = buildStrategy({
      technical: { noindex: true },
      onPageIssues: [{ severity: "medium", code: "meta_desc_missing", message: "Missing meta description" }],
    });
    expect(s.actions[0]?.area).toBe("indexing");
    expect(s.actions[0]?.title).toMatch(/noindex/i);
    expect(s.technicalScore).toBeLessThan(100);
  });

  it("orders remaining actions by impact over effort (quick high-impact first)", () => {
    const onPageIssues: SeoIssue[] = [
      { severity: "high", code: "title_missing", message: "Missing <title>" }, // high impact, low effort
      { severity: "low", code: "img_alt", message: "1 image(s) missing alt text" }, // low impact, low effort
    ];
    const s = buildStrategy({ onPageIssues });
    expect(s.actions[0]?.title).toBe("Missing <title>");
    expect(s.actions[0]?.priority).toBeGreaterThan(s.actions[1]!.priority);
  });

  it("surfaces a striking-distance keyword as a high-impact action", () => {
    const s = buildStrategy({
      keyword: {
        keyword: "cordless drill",
        position: 7,
        bucket: "page1",
        rankingUrl: "https://a.co/drill",
        page: 1,
        competitorsAbove: ["rival.com"],
        featuredSnippetOpportunity: true,
        quickWin: true,
        opportunity: 80,
        searchVolume: 1000,
      },
    });
    const kw = s.actions.find((a) => a.area === "keywords");
    expect(kw).toBeTruthy();
    expect(kw?.impact).toBe("high");
    expect(kw?.title).toMatch(/top 3/);
  });

  it("includes AEO recommendations and blends the total score", () => {
    const s = buildStrategy({
      aeo: {
        score: 30,
        recommendations: [{ severity: "high", code: "no_faq_schema", message: "No FAQPage structured data" }],
      },
      onPageIssues: [],
    });
    expect(s.aeoScore).toBe(30);
    expect(s.actions.some((a) => a.area === "aeo")).toBe(true);
    // total = 0.4*100 + 0.35*30 + 0.25*100 = 75.5 → 76
    expect(s.totalScore).toBe(76);
  });

  it("grades a clean page A with no actions", () => {
    const s = buildStrategy({ aeo: { score: 100, recommendations: [] }, onPageIssues: [], technical: {} });
    expect(s.grade).toBe("A");
    expect(s.actions).toHaveLength(0);
    expect(s.summary).toMatch(/No issues/);
  });

  it("de-duplicates the same finding appearing in two sources", () => {
    const dup: SeoIssue = { severity: "low", code: "canonical_missing", message: "No canonical link" };
    const s = buildStrategy({ onPageIssues: [dup], siteIssues: [dup] });
    expect(s.actions.filter((a) => a.title === "No canonical link")).toHaveLength(1);
  });
});
