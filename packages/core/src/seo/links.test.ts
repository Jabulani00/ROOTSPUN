import { describe, expect, it } from "vitest";
import { analyzeInternalLinks } from "./links.js";

describe("analyzeInternalLinks", () => {
  it("counts inbound/outbound and flags orphans (home excluded)", () => {
    const audit = analyzeInternalLinks([
      { url: "https://a.co/", internalLinks: ["/about", "/blog", "https://ext.com/x"] },
      { url: "https://a.co/about", internalLinks: ["/"] },
      { url: "https://a.co/blog", internalLinks: ["/about"] },
      { url: "https://a.co/orphan", internalLinks: ["/"] }, // nothing links TO it
    ]);
    const about = audit.pages.find((p) => p.path === "/about")!;
    expect(about.inbound).toBe(2); // home + blog
    const orphan = audit.pages.find((p) => p.path === "/orphan")!;
    expect(orphan.orphan).toBe(true);
    expect(audit.orphans).toEqual(["https://a.co/orphan"]);
    const home = audit.pages.find((p) => p.path === "/")!;
    expect(home.orphan).toBe(false); // home never flagged even with 0 inbound... (has inbound here)
    expect(audit.issues.some((i) => i.code === "orphan_pages" && i.severity === "high")).toBe(true);
  });

  it("ignores links outside the crawled set and counts one edge per target", () => {
    const audit = analyzeInternalLinks([
      { url: "https://a.co/", internalLinks: ["/x", "/x", "/x", "/missing"] },
      { url: "https://a.co/x", internalLinks: [] },
    ]);
    const x = audit.pages.find((p) => p.path === "/x")!;
    expect(x.inbound).toBe(1); // deduped, and /missing not counted
    const home = audit.pages.find((p) => p.path === "/")!;
    expect(home.outbound).toBe(1);
  });

  it("treats trailing slashes and absolute/relative links as the same page", () => {
    const audit = analyzeInternalLinks([
      { url: "https://a.co/", internalLinks: ["https://a.co/about/"] },
      { url: "https://a.co/about", internalLinks: [] },
    ]);
    expect(audit.pages.find((p) => p.path === "/about")!.inbound).toBe(1);
  });

  it("ranks hubs by inbound links", () => {
    const audit = analyzeInternalLinks([
      { url: "https://a.co/", internalLinks: ["/hub", "/b"] },
      { url: "https://a.co/b", internalLinks: ["/hub"] },
      { url: "https://a.co/hub", internalLinks: [] },
    ]);
    expect(audit.topHubs[0]?.path).toBe("/hub");
    expect(audit.topHubs[0]?.inbound).toBe(2);
  });
});
