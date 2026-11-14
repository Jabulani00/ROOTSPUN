import { describe, expect, it } from "vitest";
import { auditOnPage } from "./onpage.js";

describe("auditOnPage", () => {
  it("detects duplicate titles and descriptions (ignoring noindex pages)", () => {
    const audit = auditOnPage([
      { url: "https://a.co/1", title: "Drills", metaDescription: "Buy drills", canonical: "https://a.co/1" },
      { url: "https://a.co/2", title: "Drills", metaDescription: "Buy drills", canonical: "https://a.co/2" },
      { url: "https://a.co/3", title: "Unique", metaDescription: "Buy drills", canonical: "https://a.co/3" },
      { url: "https://a.co/cart", title: "Drills", metaDescription: "Buy drills", canonical: "https://a.co/cart", noindex: true },
    ]);
    expect(audit.duplicateTitles).toHaveLength(1);
    expect(audit.duplicateTitles[0]?.urls).toEqual(["https://a.co/1", "https://a.co/2"]); // cart excluded
    expect(audit.duplicateDescriptions[0]?.urls).toHaveLength(3);
    expect(audit.issues.some((i) => i.code === "dup_titles" && i.severity === "high")).toBe(true);
  });

  it("flags an off-site canonical as high severity", () => {
    const audit = auditOnPage([
      { url: "https://a.co/x", title: "X", metaDescription: "x", canonical: "https://other.com/x" },
    ]);
    expect(audit.canonicalIssues[0]?.code).toBe("canonical_offsite");
    expect(audit.canonicalIssues[0]?.severity).toBe("high");
  });

  it("flags a page canonicalised away from itself", () => {
    const audit = auditOnPage([
      { url: "https://a.co/dup?ref=1", title: "Dup", metaDescription: "d", canonical: "https://a.co/dup" },
    ]);
    expect(audit.canonicalIssues[0]?.code).toBe("canonical_elsewhere");
  });

  it("treats a self-referencing canonical (www / trailing slash) as fine", () => {
    const audit = auditOnPage([
      { url: "https://www.a.co/page/", title: "P", metaDescription: "p", canonical: "https://a.co/page" },
    ]);
    expect(audit.canonicalIssues).toHaveLength(0);
  });

  it("flags a missing canonical as low", () => {
    const audit = auditOnPage([
      { url: "https://a.co/n", title: "N", metaDescription: "n", canonical: null },
    ]);
    expect(audit.canonicalIssues[0]?.code).toBe("canonical_missing");
    expect(audit.issues.some((i) => i.code === "canonical_missing")).toBe(true);
  });
});
