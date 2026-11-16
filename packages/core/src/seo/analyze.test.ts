import { describe, expect, it } from "vitest";
import { analyzePage, pageIssues, isExpectedNoindexPath } from "./analyze.js";

const goodPage = `
<html lang="en"><head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Life Coaching in South Africa — Find Your Purpose Today</title>
  <meta name="description" content="Transform your life with certified coaching. Book a free discovery call and start your personal growth journey today.">
  <link rel="canonical" href="https://example.co.za/coaching">
  <meta property="og:title" content="Life Coaching">
  <script type="application/ld+json">{"@type":"Organization"}</script>
</head><body>
  <h1>Life Coaching that changes lives</h1>
  <h2>Our approach</h2>
  <p>${"word ".repeat(400)}</p>
  <img src="a.jpg" alt="coach"><img src="b.jpg">
  <a href="/about">About</a><a href="https://facebook.com/x">FB</a>
</body></html>`;

describe("analyzePage", () => {
  it("extracts rich signals", () => {
    const a = analyzePage(goodPage, "https://example.co.za/coaching");
    expect(a.title).toContain("Life Coaching");
    expect(a.metaDescription).toBeTruthy();
    expect(a.canonical).toBe("https://example.co.za/coaching");
    expect(a.h1Count).toBe(1);
    expect(a.h2Count).toBe(1);
    expect(a.wordCount).toBeGreaterThan(300);
    expect(a.imageCount).toBe(2);
    expect(a.imagesMissingAlt).toBe(1);
    expect(a.hasJsonLd).toBe(true);
    expect(a.hasOpenGraph).toBe(true);
    expect(a.internalLinks).toContain("/about");
    expect(a.externalLinkCount).toBe(1);
    expect(a.hasViewport).toBe(true);
    expect(a.lang).toBe("en");
  });

  it("flags a missing mobile viewport and html lang", () => {
    const issues = pageIssues(analyzePage("<html><head></head><body><p>x</p></body></html>", "https://x.co/"));
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("no_viewport");
    expect(codes).toContain("no_lang");
    expect(issues.find((i) => i.code === "no_viewport")?.severity).toBe("medium");
  });

  it("flags missing Open Graph tags, and not when present", () => {
    expect(pageIssues(analyzePage("<html><head></head><body>x</body></html>", "https://x.co/")).map((i) => i.code)).toContain("no_open_graph");
    const withOg = `<html><head><meta property="og:title" content="T"></head><body>x</body></html>`;
    expect(pageIssues(analyzePage(withOg, "https://x.co/")).map((i) => i.code)).not.toContain("no_open_graph");
  });

  it("flags issues on a weak page", () => {
    const weak = `<html><head></head><body><p>short</p><img src="x.jpg"></body></html>`;
    const issues = pageIssues(analyzePage(weak, "https://example.co.za/"));
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("title_missing");
    expect(codes).toContain("meta_desc_missing");
    expect(codes).toContain("h1_missing");
    expect(codes).toContain("thin_content");
    expect(issues[0]?.severity).toBe("high"); // sorted, high first
  });

  it("flags noindex as high severity", () => {
    const p = analyzePage(`<meta name="robots" content="noindex">`, "https://x.co/");
    expect(pageIssues(p).some((i) => i.code === "noindex" && i.severity === "high")).toBe(true);
  });

  it("treats noindex on a cart/checkout/account page as expected, not critical", () => {
    const noindex = `<meta name="robots" content="noindex">`;
    for (const u of [
      "https://shop.co.za/cart-2/",
      "https://shop.co.za/checkout/",
      "https://shop.co.za/my-account/",
      "https://shop.co.za/wishlist/",
    ]) {
      const issues = pageIssues(analyzePage(noindex, u));
      expect(issues.some((i) => i.code === "noindex" && i.severity === "high")).toBe(false);
      expect(issues.some((i) => i.code === "noindex_expected" && i.severity === "low")).toBe(true);
      // and it should not nag about thin content on a utility page
      expect(issues.some((i) => i.code === "thin_content")).toBe(false);
    }
  });

  it("isExpectedNoindexPath matches utility paths but not content pages", () => {
    expect(isExpectedNoindexPath("https://shop.co.za/cart-2/")).toBe(true);
    expect(isExpectedNoindexPath("https://shop.co.za/my-account/orders")).toBe(true);
    expect(isExpectedNoindexPath("/checkout/")).toBe(true);
    expect(isExpectedNoindexPath("https://shop.co.za/products/drill")).toBe(false);
    expect(isExpectedNoindexPath("https://shop.co.za/about")).toBe(false);
  });

  it("is clean on a well-optimized page", () => {
    const issues = pageIssues(analyzePage(goodPage, "https://example.co.za/coaching"));
    expect(issues.some((i) => i.severity === "high")).toBe(false);
    expect(issues.find((i) => i.code === "img_alt")).toBeTruthy(); // the one missing-alt image
  });
});
