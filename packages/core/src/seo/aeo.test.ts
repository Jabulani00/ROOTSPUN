import { describe, expect, it } from "vitest";
import { analyzeAeo, aeoSignals } from "./aeo.js";

const aeoReady = `
<html><head>
  <script type="application/ld+json">{"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is a cordless drill?"}]}</script>
  <script type="application/ld+json">{"@type":"HowTo","name":"How to drill"}</script>
</head><body>
  <article>
    <p>A cordless drill is a battery-powered tool for making holes and driving screws without a cable.</p>
    <h2>What size drill do I need?</h2>
    <p>${"word ".repeat(40)}</p>
    <h2>How do I choose a battery?</h2>
    <ul><li>Voltage</li><li>Amp-hours</li></ul>
    <time datetime="2026-01-02">Jan 2, 2026</time>
    <span class="author">by Jane Smith</span>
  </article>
</body></html>`;

const aeoPoor = `
<html><head></head><body>
  <h2>Our products</h2>
  <p>${"word ".repeat(140)}</p>
</body></html>`;

describe("aeoSignals", () => {
  it("detects the answer-engine signals on a well-structured page", () => {
    const s = aeoSignals(aeoReady);
    expect(s.hasFaqSchema).toBe(true);
    expect(s.hasHowToSchema).toBe(true);
    expect(s.questionHeadings).toBe(2);
    expect(s.listCount).toBe(1);
    expect(s.hasLeadDefinition).toBe(true);
    expect(s.leadAnswerWords).toBeGreaterThan(0);
    expect(s.leadAnswerWords).toBeLessThanOrEqual(60);
    expect(s.hasAuthor).toBe(true);
    expect(s.hasDate).toBe(true);
  });

  it("finds little on a poorly-structured page", () => {
    const s = aeoSignals(aeoPoor);
    expect(s.hasFaqSchema).toBe(false);
    expect(s.questionHeadings).toBe(0);
    expect(s.listCount).toBe(0);
    expect(s.leadAnswerWords).toBeGreaterThan(90);
  });
});

describe("analyzeAeo", () => {
  it("scores a ready page high with no high-severity recommendations", () => {
    const r = analyzeAeo(aeoReady);
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.recommendations.some((x) => x.severity === "high")).toBe(false);
  });

  it("scores a poor page low and flags the big gaps first", () => {
    const r = analyzeAeo(aeoPoor);
    expect(r.score).toBeLessThan(40);
    const highCodes = r.recommendations.filter((x) => x.severity === "high").map((x) => x.code);
    expect(highCodes).toContain("no_question_headings");
    expect(highCodes).toContain("no_faq_schema");
    // sorted: high severity first
    expect(r.recommendations[0]?.severity).toBe("high");
  });

  it("never exceeds 100", () => {
    expect(analyzeAeo(aeoReady).score).toBeLessThanOrEqual(100);
  });
});
