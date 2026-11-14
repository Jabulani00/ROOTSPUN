/**
 * HTML signal extraction for the crawler (RS-201) — pure, testable.
 *
 * Parses the technical-SEO signals from a page's HTML and measures how much the
 * rendered text differs from the raw HTML text (a large diff means content is
 * JS-injected and may not be seen by non-rendering crawlers). The live fetch /
 * headless render (Crawlee + Playwright) stays external; this is the analysis.
 */

export interface HtmlSignals {
  title: string | null;
  canonical: string | null;
  metaRobotsNoindex: boolean;
  nosnippet: boolean;
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag);
  return m ? m[1]! : null;
}

export function extractHtmlSignals(html: string): HtmlSignals {
  const title = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").trim() || null;

  // canonical <link>
  let canonical: string | null = null;
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of linkTags) {
    if (/rel\s*=\s*["']?canonical/i.test(tag)) {
      canonical = attr(tag, "href");
      break;
    }
  }

  // meta robots (name=robots or a bot-specific name)
  let robotsContent = "";
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    if (/name\s*=\s*["']?(robots|googlebot)/i.test(tag)) {
      robotsContent += " " + (attr(tag, "content") ?? "").toLowerCase();
    }
  }
  const metaRobotsNoindex = /\bnoindex\b/.test(robotsContent);
  const nosnippet = /\bnosnippet\b/.test(robotsContent) || /\bdata-nosnippet\b/i.test(html);

  return { title, canonical, metaRobotsNoindex, nosnippet };
}

/** Strip scripts/styles/tags to visible-ish text, lowercased token set. */
function textTokens(html: string): Set<string> {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .toLowerCase();
  return new Set((text.match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 1));
}

/**
 * Percentage (0–100) of rendered text content not present in the raw HTML — a
 * proxy for JS-injected content. 0 means raw already contains the rendered text.
 */
export function renderedVsRawDiff(raw: string, rendered: string): number {
  const rawTokens = textTokens(raw);
  const renderedTokens = textTokens(rendered);
  if (renderedTokens.size === 0) return 0;
  let missing = 0;
  for (const t of renderedTokens) if (!rawTokens.has(t)) missing++;
  return Math.round((missing / renderedTokens.size) * 1000) / 10;
}
