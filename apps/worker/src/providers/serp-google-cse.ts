import { normalizeHost } from "@rootspun/core";
import type { WorkerEnv } from "../env.js";
import { ProviderNotConfiguredError, type SerpProvider, type SerpResult } from "./types.js";

/**
 * Google Custom Search (Programmable Search Engine) adapter — a free-tier
 * compatible SERP source (100 queries/day) for demos and small checks. It uses
 * the official JSON API (no scraping, NFR-10). It returns organic-style results
 * only; AI Overview / AI Mode blocks are not exposed by this API.
 *
 * Setup (free): create a Programmable Search Engine (cse.google.com, "search the
 * entire web"), get its ID, and a Google API key with Custom Search API enabled.
 * Set GOOGLE_CSE_ID and GOOGLE_CSE_KEY.
 */
export function googleCseProvider(_env: WorkerEnv): SerpProvider {
  return {
    name: "google_cse",
    async run({ prompt, language }): Promise<SerpResult> {
      const key = process.env.GOOGLE_CSE_KEY;
      const cx = process.env.GOOGLE_CSE_ID;
      if (!key || !cx) throw new ProviderNotConfiguredError("google_cse");

      const url = new URL("https://www.googleapis.com/customsearch/v1");
      url.searchParams.set("key", key);
      url.searchParams.set("cx", cx);
      url.searchParams.set("q", prompt);
      url.searchParams.set("num", "10");
      if (language) url.searchParams.set("hl", language);

      const res = await fetch(url);
      if (!res.ok) throw new Error(`google_cse ${res.status}: ${await res.text()}`);
      const body = (await res.json()) as { items?: { link?: string; displayLink?: string }[] };

      const organic = (body.items ?? [])
        .filter((it) => it.link)
        .map((it, i) => ({
          url: it.link!,
          host: normalizeHost(it.displayLink ?? it.link!),
          rank: i + 1,
        }));

      return {
        organic,
        aiOverviewPresent: false,
        aiModePresent: false,
        aiCitations: [],
        // Custom Search free tier is free; paid tier is $5/1000 queries.
        costUsd: 0.005,
      };
    },
  };
}
