import "server-only";
import type { SerpResult } from "@rootspun/core";

/** Whether a free Google Custom Search key is configured for live rank checks. */
export function serpConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_ID);
}

/**
 * Fetch the top organic results for a query from Google Programmable Search
 * (official JSON API, free tier — no scraping, NFR-10). Returns positioned
 * results for the keyword engine, or an error string.
 */
export async function googleCseSearch(
  query: string,
  language = "en",
): Promise<{ results: SerpResult[] } | { error: string }> {
  const key = process.env.GOOGLE_CSE_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!key || !cx) return { error: "Google Custom Search key not configured" };

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", key);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", "10");
  if (language) url.searchParams.set("hl", language);

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { error: `Google CSE ${res.status}` };
    const body = (await res.json()) as { items?: { link?: string }[] };
    const results = (body.items ?? [])
      .filter((it) => it.link)
      .map((it, i) => ({ url: it.link!, position: i + 1 }));
    return { results };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "SERP request failed" };
  }
}
