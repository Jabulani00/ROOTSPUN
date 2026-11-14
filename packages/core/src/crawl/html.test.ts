import { describe, expect, it } from "vitest";
import { extractHtmlSignals, renderedVsRawDiff } from "./html.js";

describe("extractHtmlSignals", () => {
  it("extracts title and canonical", () => {
    const s = extractHtmlSignals(
      `<html><head><title> Home </title><link rel="canonical" href="https://x.com/"></head></html>`,
    );
    expect(s.title).toBe("Home");
    expect(s.canonical).toBe("https://x.com/");
  });

  it("detects meta robots noindex and nosnippet", () => {
    const s = extractHtmlSignals(`<meta name="robots" content="noindex, nosnippet">`);
    expect(s.metaRobotsNoindex).toBe(true);
    expect(s.nosnippet).toBe(true);
  });

  it("detects data-nosnippet attribute", () => {
    const s = extractHtmlSignals(`<div data-nosnippet>secret</div>`);
    expect(s.nosnippet).toBe(true);
    expect(s.metaRobotsNoindex).toBe(false);
  });

  it("reads googlebot-specific meta", () => {
    const s = extractHtmlSignals(`<meta name="googlebot" content="noindex">`);
    expect(s.metaRobotsNoindex).toBe(true);
  });

  it("returns nulls/false when signals are absent", () => {
    const s = extractHtmlSignals(`<html><body><p>hi</p></body></html>`);
    expect(s.title).toBeNull();
    expect(s.canonical).toBeNull();
    expect(s.metaRobotsNoindex).toBe(false);
    expect(s.nosnippet).toBe(false);
  });
});

describe("renderedVsRawDiff", () => {
  it("is 0 when rendered text is already in the raw HTML", () => {
    const raw = `<html><body><p>hello world content here</p></body></html>`;
    expect(renderedVsRawDiff(raw, raw)).toBe(0);
  });

  it("is high when the rendered content is JS-injected", () => {
    const raw = `<html><body><div id="app"></div><script>app()</script></body></html>`;
    const rendered = `<html><body><div id="app"><article>Fully rendered product description text</article></div></body></html>`;
    expect(renderedVsRawDiff(raw, rendered)).toBeGreaterThan(50);
  });

  it("ignores script/style content", () => {
    const raw = `<html><body><style>.x{color:red}</style><p>visible text body</p></body></html>`;
    const rendered = `<html><body><p>visible text body</p></body></html>`;
    expect(renderedVsRawDiff(raw, rendered)).toBe(0);
  });

  it("returns 0 for empty rendered content", () => {
    expect(renderedVsRawDiff("<p>x</p>", "")).toBe(0);
  });
});
