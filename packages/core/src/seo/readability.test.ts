import { describe, expect, it } from "vitest";
import { countSyllables, readability, readabilityFromHtml } from "./readability.js";

describe("countSyllables", () => {
  it("estimates common words", () => {
    expect(countSyllables("cat")).toBe(1);
    expect(countSyllables("hello")).toBe(2);
    expect(countSyllables("readability")).toBeGreaterThanOrEqual(4);
    expect(countSyllables("make")).toBe(1); // silent e
  });
});

describe("readability", () => {
  it("rates short simple sentences as easy", () => {
    const r = readability("The cat sat on the mat. The dog ran. We had fun.");
    expect(r.fleschReadingEase).toBeGreaterThan(80);
    expect(["very easy", "easy"]).toContain(r.verdict);
    expect(r.words).toBe(12);
  });

  it("rates long complex sentences as difficult", () => {
    const text =
      "The implementation leverages sophisticated multidimensional optimization methodologies, consequently necessitating substantial computational infrastructure throughout the organizational transformation initiative.";
    const r = readability(text);
    expect(r.fleschReadingEase).toBeLessThan(30);
    expect(r.verdict).toBe("very difficult");
    expect(r.gradeLevel).toBeGreaterThan(12);
  });

  it("handles empty text safely", () => {
    const r = readability("   ");
    expect(r.words).toBe(0);
    expect(r.fleschReadingEase).toBe(0);
  });

  it("strips HTML before scoring", () => {
    const r = readabilityFromHtml("<p>The cat sat on the mat.</p><script>var x = 1 + 2;</script>");
    expect(r.words).toBe(6); // script content excluded
  });
});
