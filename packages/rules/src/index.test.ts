import { describe, expect, it } from "vitest";
import { allRules, getRule, rulesByCategory, RULES_VERSION } from "./index.js";

describe("google rules library", () => {
  it("loads rules with a version", () => {
    expect(RULES_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(allRules().length).toBeGreaterThanOrEqual(6);
  });

  it("every rule has the required fields and a Search Central URL", () => {
    for (const r of allRules()) {
      expect(r.id).toBeTruthy();
      expect(r.title).toBeTruthy();
      expect(r.summary).toBeTruthy();
      expect(r.whyGoogleCares).toBeTruthy();
      expect(r.fixHint).toBeTruthy();
      expect(r.url).toMatch(/^https:\/\/developers\.google\.com\/search\//);
    }
  });

  it("resolves the ruleIds the Why Engine references", () => {
    for (const id of [
      "rule.indexing.noindex",
      "rule.crawl.blocked",
      "rule.snippet.nosnippet",
      "rule.cwv.poor",
      "rule.content.no_answer",
      "rule.content.competitor_cited",
    ]) {
      expect(getRule(id), id).toBeDefined();
    }
  });

  it("exposes spam policies for the Fix Studio guardrail", () => {
    const spam = rulesByCategory("spam");
    expect(spam.map((r) => r.id)).toContain("rule.spam.doorway");
    expect(spam.length).toBeGreaterThanOrEqual(3);
  });

  it("returns undefined for unknown ids", () => {
    expect(getRule("rule.does.not.exist")).toBeUndefined();
  });
});
