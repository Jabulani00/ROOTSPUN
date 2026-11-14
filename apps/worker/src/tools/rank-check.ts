/**
 * Standalone keyword rank-checker (RS-103 demo).
 *
 * Checks where a domain ranks in Google organic results for a set of keywords,
 * using whichever licensed SERP provider is configured (SERP_PROVIDER + its keys)
 * — DataForSEO, or the free-tier Google Custom Search (SERP_PROVIDER=google_cse
 * with GOOGLE_CSE_KEY / GOOGLE_CSE_ID). No scraping (NFR-10).
 *
 * Usage:
 *   pnpm --filter worker rank-check -- --domain lifechangingjourney.co.za \
 *     --keywords "life coaching south africa, personal growth coach" --country ZA
 */
import { normalizeHost } from "@rootspun/core";
import type { WorkerEnv } from "../env.js";
import { getSerpProvider } from "../providers/index.js";

interface Args {
  domain: string;
  keywords: string[];
  country: string;
  language: string;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const domain = get("domain");
  const keywords = (get("keywords") ?? "").split(",").map((k) => k.trim()).filter(Boolean);
  if (!domain || keywords.length === 0) {
    throw new Error('Usage: rank-check --domain <host> --keywords "k1, k2" [--country ZA] [--language en]');
  }
  return { domain: normalizeHost(domain), keywords, country: get("country") ?? "ZA", language: get("language") ?? "en" };
}

/** Rank of the domain in a list of organic results, or null if not found. */
function rankOf(organic: { host: string; rank: number }[], domain: string): number | null {
  const hit = organic.find((o) => o.host === domain || o.host.endsWith(`.${domain}`));
  return hit ? hit.rank : null;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  // The rank check only needs a SERP provider — not the full worker env — so the
  // tool runs with just a provider key set (no Supabase required).
  const serp = (process.env.SERP_PROVIDER as WorkerEnv["SERP_PROVIDER"]) ?? "google_cse";
  const provider = getSerpProvider({ SERP_PROVIDER: serp } as WorkerEnv);

  // eslint-disable-next-line no-console
  console.log(`\nRank check for ${args.domain} (${provider.name}, ${args.country})\n`);
  // eslint-disable-next-line no-console
  console.log("Rank  Keyword");
  // eslint-disable-next-line no-console
  console.log("----  -------");

  let found = 0;
  for (const keyword of args.keywords) {
    try {
      const result = await provider.run({ prompt: keyword, country: args.country, language: args.language });
      const rank = rankOf(result.organic, args.domain);
      if (rank) found++;
      const label = rank ? `#${rank}`.padEnd(4) : " — ".padEnd(4);
      // eslint-disable-next-line no-console
      console.log(`${label}  ${keyword}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(`err   ${keyword}  (${err instanceof Error ? err.message : String(err)})`);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`\nRanking for ${found}/${args.keywords.length} keywords in the top results.\n`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
