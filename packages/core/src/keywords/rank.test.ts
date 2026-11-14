import { describe, expect, it } from "vitest";
import { analyzeKeyword, rankKeywords } from "./rank.js";

const serp = (hosts: string[]) => hosts.map((h, i) => ({ url: `https://${h}/page`, position: i + 1 }));

describe("analyzeKeyword", () => {
  it("finds the client's best position and competitors above it", () => {
    const r = analyzeKeyword({
      keyword: "cordless drill",
      clientHosts: ["acme.com"],
      results: serp(["rival.com", "big.com", "acme.com", "acme.com"]),
      searchVolume: 1000,
    });
    expect(r.position).toBe(3);
    expect(r.bucket).toBe("top3");
    expect(r.rankingUrl).toBe("https://acme.com/page");
    expect(r.competitorsAbove).toEqual(["rival.com", "big.com"]);
    expect(r.page).toBe(1);
  });

  it("marks a page-2 keyword as a striking-distance quick win", () => {
    const hosts = Array.from({ length: 20 }, (_, i) => (i === 13 ? "acme.com" : `comp${i}.com`));
    const r = analyzeKeyword({ keyword: "best drill 2026", clientHosts: ["acme.com"], results: serp(hosts), searchVolume: 500 });
    expect(r.position).toBe(14);
    expect(r.bucket).toBe("page2");
    expect(r.quickWin).toBe(true);
    expect(r.featuredSnippetOpportunity).toBe(false);
    expect(r.opportunity).toBeGreaterThan(40);
  });

  it("handles a keyword the client does not rank for", () => {
    const r = analyzeKeyword({ keyword: "power tools", clientHosts: ["acme.com"], results: serp(["a.com", "b.com"]) });
    expect(r.position).toBeNull();
    expect(r.bucket).toBe("not_ranking");
    expect(r.quickWin).toBe(false);
    expect(r.page).toBeNull();
  });

  it("flags a featured-snippet opportunity near the top", () => {
    const r = analyzeKeyword({ keyword: "what is a drill", clientHosts: ["acme.com"], results: serp(["x.com", "acme.com"]), searchVolume: 2000 });
    expect(r.position).toBe(2);
    expect(r.featuredSnippetOpportunity).toBe(true);
  });

  it("ignores www and matches host regardless of scheme", () => {
    const r = analyzeKeyword({
      keyword: "drill",
      clientHosts: ["https://www.acme.com"],
      results: [{ url: "https://acme.com/x", position: 5 }],
    });
    expect(r.position).toBe(5);
  });
});

describe("rankKeywords", () => {
  it("orders by opportunity and summarises the portfolio", () => {
    const { keywords, summary } = rankKeywords([
      { keyword: "won", clientHosts: ["acme.com"], results: serp(["acme.com"]), searchVolume: 100 }, // pos 1, low upside
      { keyword: "strike", clientHosts: ["acme.com"], results: serp(["a.com", "b.com", "c.com", "d.com", "acme.com"]), searchVolume: 1500 }, // pos 5, prime
      { keyword: "gap", clientHosts: ["acme.com"], results: serp(["a.com", "b.com"]), searchVolume: 800 }, // not ranking
    ]);
    // the page-1 striking-distance keyword should be the top opportunity
    expect(keywords[0]?.keyword).toBe("strike");
    expect(summary.total).toBe(3);
    expect(summary.ranking).toBe(2);
    expect(summary.top3).toBe(1);
    expect(summary.quickWins).toBe(1);
    expect(summary.notRanking).toBe(1);
    expect(summary.avgPosition).toBe(3); // (1 + 5) / 2
  });
});
