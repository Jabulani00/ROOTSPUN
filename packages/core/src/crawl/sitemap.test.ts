import { describe, expect, it } from "vitest";
import {
  collectSitemapEntries,
  collectSitemapUrls,
  daysSince,
  sitemapEntries,
  sitemapLocs,
  sitemapUrlsFromRobots,
  type SitemapFetcher,
} from "./sitemap.js";

const urlset = (urls: string[]) =>
  `<?xml version="1.0"?><urlset>${urls.map((u) => `<loc>${u}</loc>`).join("")}</urlset>`;
const index = (maps: string[]) =>
  `<?xml version="1.0"?><sitemapindex>${maps.map((u) => `<loc>${u}</loc>`).join("")}</sitemapindex>`;

/** Build a fetcher from a path→{status,text} map. */
function stub(map: Record<string, { status: number; text: string }>): SitemapFetcher {
  return async (url: string) => map[url] ?? { status: 404, text: "" };
}

describe("sitemap helpers", () => {
  it("extracts <loc> values", () => {
    expect(sitemapLocs("<loc>https://a.co/x</loc>\n<loc> https://a.co/y </loc>")).toEqual([
      "https://a.co/x",
      "https://a.co/y",
    ]);
  });

  it("reads Sitemap: directives from robots.txt (case-insensitive)", () => {
    const robots = "User-agent: *\nAllow: /\nSitemap: https://a.co/sitemap.xml\nsitemap: https://a.co/news.xml";
    expect(sitemapUrlsFromRobots(robots)).toEqual(["https://a.co/sitemap.xml", "https://a.co/news.xml"]);
  });
});

describe("sitemapEntries + daysSince", () => {
  it("parses loc and lastmod from a urlset", () => {
    const xml = `<urlset><url><loc>https://a.co/x</loc><lastmod>2024-01-02</lastmod></url><url><loc>https://a.co/y</loc></url></urlset>`;
    expect(sitemapEntries(xml)).toEqual([
      { loc: "https://a.co/x", lastmod: "2024-01-02" },
      { loc: "https://a.co/y", lastmod: null },
    ]);
  });

  it("daysSince computes age and handles bad input", () => {
    const now = Date.parse("2026-01-01");
    expect(daysSince("2025-01-01", now)).toBe(365);
    expect(daysSince(null)).toBeNull();
    expect(daysSince("not-a-date")).toBeNull();
  });

  it("collectSitemapEntries returns same-host entries with lastmod", async () => {
    const entries = await collectSitemapEntries(
      "https://a.co",
      "a.co",
      "",
      stub({
        "https://a.co/sitemap.xml": {
          status: 200,
          text: `<urlset><url><loc>https://a.co/p</loc><lastmod>2024-05-01</lastmod></url><url><loc>https://other.com/z</loc></url></urlset>`,
        },
      }),
    );
    expect(entries).toEqual([{ loc: "https://a.co/p", lastmod: "2024-05-01" }]);
  });
});

describe("collectSitemapUrls", () => {
  it("returns null when no sitemap exists", async () => {
    const urls = await collectSitemapUrls("https://a.co", "a.co", "", stub({}));
    expect(urls).toBeNull();
  });

  it("collects same-host page URLs from a flat urlset", async () => {
    const urls = await collectSitemapUrls(
      "https://a.co",
      "a.co",
      "",
      stub({
        "https://a.co/sitemap.xml": {
          status: 200,
          text: urlset(["https://a.co/", "https://www.a.co/about", "https://other.com/x"]),
        },
      }),
    );
    expect(urls).toEqual(["https://a.co/", "https://www.a.co/about"]); // other-host dropped
  });

  it("follows a sitemap index down to child page URLs", async () => {
    const urls = await collectSitemapUrls(
      "https://a.co",
      "a.co",
      "Sitemap: https://a.co/sitemap_index.xml",
      stub({
        "https://a.co/sitemap_index.xml": { status: 200, text: index(["https://a.co/posts.xml", "https://a.co/pages.xml"]) },
        "https://a.co/posts.xml": { status: 200, text: urlset(["https://a.co/post-1", "https://a.co/post-2"]) },
        "https://a.co/pages.xml": { status: 200, text: urlset(["https://a.co/contact"]) },
      }),
    );
    expect(urls).toEqual(["https://a.co/post-1", "https://a.co/post-2", "https://a.co/contact"]);
  });

  it("honours the page limit", async () => {
    const urls = await collectSitemapUrls(
      "https://a.co",
      "a.co",
      "",
      stub({
        "https://a.co/sitemap.xml": {
          status: 200,
          text: urlset(["https://a.co/1", "https://a.co/2", "https://a.co/3", "https://a.co/4"]),
        },
      }),
      { limit: 2 },
    );
    expect(urls).toHaveLength(2);
  });
});
