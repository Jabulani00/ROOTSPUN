/**
 * Live technical-SEO site crawler (RS-201/203 demo). Fetches a real site, parses
 * its robots.txt (per bot), crawls up to N internal pages, and reports on-page
 * SEO issues. Uses only official HTTP fetches (no scraping of Google/AI apps) and
 * respects robots.txt for Googlebot. No API keys or Supabase required.
 *
 *   pnpm --filter worker crawl-site -- --domain lifechangingjourney.co.za --max 8
 */
import { analyzePage, collectSitemapUrls, isPathAllowed, pageIssues, type SeoIssue } from "@rootspun/core";

const UA = "RootspunBot/1.0 (+https://rootspun.app; technical SEO audit)";
const BOTS = ["Googlebot", "Google-Extended", "GPTBot", "PerplexityBot", "ClaudeBot", "Bingbot"];

interface Args {
  domain: string;
  max: number;
}
function parseArgs(argv: string[]): Args {
  const get = (n: string) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const raw = get("domain");
  if (!raw) throw new Error("Usage: crawl-site --domain <host> [--max 8]");
  const domain = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
  return { domain, max: Number(get("max") ?? 8) };
}

async function fetchText(url: string, timeoutMs = 15000, accept: "html" | "xml" = "html") {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": UA,
        accept: accept === "xml" ? "application/xml,text/xml,*/*" : "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: ctl.signal,
    });
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    const ok = accept === "xml" ? !/(image|font|octet-stream|pdf|zip)/.test(ct) : ct.includes("html");
    const text = ok ? await res.text() : "";
    return { status: res.status, text, finalUrl: res.url || url };
  } catch (e) {
    return { status: 0, text: "", finalUrl: url, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

function log(s = "") {
  // eslint-disable-next-line no-console
  console.log(s);
}

async function main() {
  const { domain, max } = parseArgs(process.argv.slice(2));
  const origin = `https://${domain}`;

  log(`\n🔎 Rootspun technical SEO crawl — ${domain}\n${"=".repeat(44)}`);

  // ── robots.txt per bot ──────────────────────────────────────────────────
  const robots = await fetchText(`${origin}/robots.txt`);
  const robotsTxt = robots.status === 200 ? robots.text : "";
  log(`\nrobots.txt: ${robots.status === 200 ? "found" : `not found (HTTP ${robots.status})`}`);
  log("Crawler access to /:");
  for (const bot of BOTS) {
    const ok = isPathAllowed(robotsTxt, bot, "/");
    log(`  ${ok ? "✓ allowed" : "✗ BLOCKED"}  ${bot}`);
  }

  // ── sitemap (seed the crawl from it, like the app crawler) ────────────────
  const host = domain.replace(/^www\./, "");
  const seededUrls = await collectSitemapUrls(
    origin,
    host,
    robotsTxt,
    async (u) => {
      const r = await fetchText(u, 15000, "xml");
      return { status: r.status, text: r.text };
    },
    { limit: max * 6 },
  );
  const sitemapFound = seededUrls !== null;
  const seeded = seededUrls ?? [];
  log(`\nsitemap: ${sitemapFound ? `found (${seeded.length} same-host page URLs)` : "not found"}`);

  // ── crawl ───────────────────────────────────────────────────────────────
  const queue: string[] = [`${origin}/`, ...seeded];
  const visited = new Set<string>();
  const results: { url: string; status: number; issues: SeoIssue[]; title: string | null; words: number }[] = [];

  while (queue.length > 0 && results.length < max) {
    const url = queue.shift()!;
    let path = "/";
    try {
      path = new URL(url).pathname;
    } catch {
      continue;
    }
    if (visited.has(path)) continue;
    visited.add(path);

    if (!isPathAllowed(robotsTxt, "Googlebot", path)) {
      results.push({ url, status: -1, issues: [], title: "(blocked by robots.txt)", words: 0 });
      continue;
    }

    const { status, text, finalUrl } = await fetchText(url);
    if (status !== 200 || !text) {
      results.push({ url, status, issues: [], title: null, words: 0 });
      continue;
    }

    const analysis = analyzePage(text, finalUrl);
    results.push({ url: finalUrl, status, issues: pageIssues(analysis), title: analysis.title, words: analysis.wordCount });

    for (const link of analysis.internalLinks) {
      try {
        const abs = new URL(link, finalUrl);
        if (abs.host.replace(/^www\./, "") !== domain.replace(/^www\./, "")) continue;
        if (!visited.has(abs.pathname) && queue.length < max * 4) queue.push(abs.toString());
      } catch {
        /* skip bad url */
      }
    }
  }

  // ── report ──────────────────────────────────────────────────────────────
  const broken = results.filter((r) => r.status === 0 || r.status >= 400).length;
  log(`\nCrawled ${results.length} page(s)${broken > 0 ? ` — ⚠ ${broken} broken (HTTP ≥400 or unreachable)` : ""}:\n`);
  for (const r of results) {
    const high = r.issues.filter((i) => i.severity === "high").length;
    const med = r.issues.filter((i) => i.severity === "medium").length;
    const tag = r.status === 200 ? `${high}H ${med}M issues` : r.status === -1 ? "blocked" : `HTTP ${r.status}`;
    log(`  [${tag}] ${new URL(r.url).pathname}  ${r.title ? `— ${r.title.slice(0, 60)}` : ""}`);
  }

  // Aggregate issues.
  const counts = new Map<string, { severity: string; message: string; n: number }>();
  for (const r of results) {
    for (const i of r.issues) {
      const e = counts.get(i.code) ?? { severity: i.severity, message: i.message, n: 0 };
      e.n++;
      counts.set(i.code, e);
    }
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1].n - a[1].n);
  if (sorted.length > 0) {
    log(`\nTop technical SEO findings:`);
    for (const [code, e] of sorted.slice(0, 12)) {
      log(`  ${e.severity.toUpperCase().padEnd(6)} ${String(e.n).padStart(2)}×  ${e.message}  (${code})`);
    }
  } else {
    log("\nNo on-page issues detected on the crawled pages. 🎉");
  }
  log("");
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
