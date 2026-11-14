import { describe, expect, it } from "vitest";
import {
  collectSitemapUrls,
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
