import { normalizeHost } from "@rootspun/core";
import type { WorkerEnv } from "../env.js";
import { ProviderNotConfiguredError, type SerpProvider, type SerpResult } from "./types.js";

/**
 * DataForSEO SERP adapter (RS-103). Collects Google organic results plus
 * AI Overview / AI Mode blocks via the licensed API (NFR-10 — no scraping).
 *
 * NOTE: the exact response shape should be validated against the live API before
 * production use; parsing here is defensive (optional chaining throughout).
 */

// Minimal country → DataForSEO location_name map; extend as needed.
const LOCATION: Record<string, string> = {
  ZA: "South Africa",
  US: "United States",
  GB: "United Kingdom",
  AU: "Australia",
  CA: "Canada",
};

interface DfsItem {
  type?: string;
  rank_absolute?: number;
  url?: string;
  domain?: string;
  items?: { url?: string; domain?: string }[];
  references?: { url?: string; domain?: string }[];
}

export function dataForSeoProvider(_env: WorkerEnv): SerpProvider {
  return {
    name: "dataforseo",
    async run({ prompt, country, language }): Promise<SerpResult> {
      const login = process.env.DATAFORSEO_LOGIN;
      const password = process.env.DATAFORSEO_PASSWORD;
      if (!login || !password) throw new ProviderNotConfiguredError("dataforseo");

      const auth = Buffer.from(`${login}:${password}`).toString("base64");
      const res = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify([
          {
            keyword: prompt,
            location_name: LOCATION[country] ?? "United States",
            language_code: language || "en",
            device: "desktop",
          },
        ]),
      });
      if (!res.ok) throw new Error(`dataforseo ${res.status}: ${await res.text()}`);

      const body = (await res.json()) as {
        tasks?: { cost?: number; result?: { items?: DfsItem[] }[] }[];
      };
      const task = body.tasks?.[0];
      const items = task?.result?.[0]?.items ?? [];

      const organic = items
        .filter((i) => i.type === "organic" && i.url)
        .map((i) => ({ url: i.url!, host: normalizeHost(i.domain ?? i.url!), rank: i.rank_absolute ?? 0 }));

      const aiOverview = items.find((i) => i.type === "ai_overview");
      const aiMode = items.find((i) => i.type === "ai_mode");
      const refs = [...(aiOverview?.references ?? []), ...(aiMode?.references ?? [])];
      const aiCitations = refs
        .filter((r) => r.url)
        .map((r, idx) => ({ url: r.url!, host: normalizeHost(r.domain ?? r.url!), rank: idx + 1 }));

      return {
        organic,
        aiOverviewPresent: Boolean(aiOverview),
        aiModePresent: Boolean(aiMode),
        aiCitations,
        costUsd: task?.cost ?? 0,
      };
    },
  };
}
