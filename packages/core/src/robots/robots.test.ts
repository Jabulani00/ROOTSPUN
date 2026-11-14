import { describe, expect, it } from "vitest";
import { isPathAllowed, parseRobots } from "./robots.js";

describe("parseRobots", () => {
  it("groups rules under their user-agents and ignores comments", () => {
    const groups = parseRobots(`
      # comment
      User-agent: GPTBot
      Disallow: /private

      User-agent: *
      Allow: /
    `);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.agents).toEqual(["gptbot"]);
    expect(groups[1]?.agents).toEqual(["*"]);
  });
});

describe("isPathAllowed — per bot", () => {
  const txt = `
User-agent: GPTBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: *
Disallow: /admin
`;

  it("blocks GPTBot everywhere", () => {
    expect(isPathAllowed(txt, "GPTBot", "/anything")).toBe(false);
  });
  it("blocks Google-Extended but not Googlebot", () => {
    expect(isPathAllowed(txt, "Google-Extended", "/x")).toBe(false);
    expect(isPathAllowed(txt, "Googlebot", "/x")).toBe(true);
  });
  it("applies the * group to an unlisted bot", () => {
    expect(isPathAllowed(txt, "BingBot", "/admin/users")).toBe(false);
    expect(isPathAllowed(txt, "BingBot", "/public")).toBe(true);
  });
});

describe("isPathAllowed — longest match & allow override", () => {
  const txt = `
User-agent: *
Disallow: /private
Allow: /private/public
`;
  it("lets the longer Allow override the Disallow", () => {
    expect(isPathAllowed(txt, "Googlebot", "/private/public/page")).toBe(true);
    expect(isPathAllowed(txt, "Googlebot", "/private/secret")).toBe(false);
  });
});

describe("isPathAllowed — wildcards and end-anchor", () => {
  const txt = `
User-agent: *
Disallow: /*.pdf$
`;
  it("matches the wildcard with end-anchor", () => {
    expect(isPathAllowed(txt, "Googlebot", "/docs/report.pdf")).toBe(false);
    expect(isPathAllowed(txt, "Googlebot", "/docs/report.pdf.html")).toBe(true);
  });
});

describe("isPathAllowed — defaults", () => {
  it("allows everything when no group matches or file is empty", () => {
    expect(isPathAllowed("", "Googlebot", "/")).toBe(true);
    expect(isPathAllowed("User-agent: GPTBot\nDisallow: /", "Googlebot", "/")).toBe(true);
  });
  it("treats an empty Disallow as no restriction", () => {
    expect(isPathAllowed("User-agent: *\nDisallow:", "Googlebot", "/anything")).toBe(true);
  });
});
