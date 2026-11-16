# SEO / AEO engine — developer reference

All of this is **pure, dependency-free logic in `packages/core`** (unit-tested,
browser-safe). The crawler (`apps/web/lib/crawl.ts`) and the public audit API
(`apps/web/app/api/public/audit/instant`) feed HTML/crawl data into it; the
Technical view and the free `/audit` page render the results. No scraping and no
API keys are needed for any of this (NFR-10) — it works off plain `fetch`.

## Core modules (`packages/core/src`)

| Module | Entry points | What it does |
| --- | --- | --- |
| `seo/analyze.ts` | `analyzePage(html,url)`, `pageIssues(a)`, `isExpectedNoindexPath` | Per-page signals: title, meta description, canonical, noindex/nosnippet, h1/h2, word count, images missing alt, JSON-LD, OpenGraph, hreflang, internal links, **viewport (mobile)**, **html lang**. `pageIssues` ranks them high/medium/low. Cart/checkout/account pages aren't flagged for expected noindex. |
| `seo/aeo.ts` | `analyzeAeo(html)`, `aeoSignals` | Answer-engine readiness 0–100: concise lead answer, question-style headings, FAQ/HowTo schema, lists/tables, definitional opener, author/date. Returns score + ranked recommendations. |
| `seo/onpage.ts` | `auditOnPage(records)` | Site-wide: duplicate titles/descriptions, canonical problems (off-site / canonicalised-away / missing). |
| `seo/links.ts` | `analyzeInternalLinks(pages)` | Internal link graph: inbound/outbound counts, **orphan pages**, weakly-linked pages, top hubs. |
| `seo/readability.ts` | `readability(text)`, `readabilityFromHtml(html)` | Flesch Reading Ease + Flesch–Kincaid grade + verdict. Crawler flags pages with Flesch < 45 on 150+ words. |
| `seo/schema.ts` | `detectSchemaTypes(html)`, `auditSchema(html,opts)` | Which schema.org `@type`s a page declares, and which high-value types are missing. |
| `keywords/rank.ts` | `analyzeKeyword(input)`, `rankKeywords(inputs)` | Keyword position, bucket (top3/page1/page2/beyond/not-ranking), competitors above, featured-snippet + **striking-distance quick-win** flags, volume-weighted 0–100 opportunity, portfolio summary. |
| `strategy/strategy.ts` | `buildStrategy(input)` | **"How to rank higher"** — fuses on-page issues, AEO, technical (indexing, crawler access, CWV), duplicates/canonical and keyword rank into one total score (0–100, A–F) with classic/AEO/technical breakdown and a ranked action plan (impact × effort, indexing blockers forced to the top). |
| `why/rules.ts` | `diagnose(ctx)` (via `why/diagnose.ts`) | Why Engine causes (RS-205): not_indexed, crawl_blocked, snippet_blocked, slow_template, competitor_cited, no_answering_page, **weak_answer_structure** (AI engines, low AEO). Each has evidence, confidence and a `packages/rules` link. |
| `extract/extract.ts` | `extractAnswer`, `extractUrlsFromText` | AI-answer mentions + citations; with `autoDiscoverUrls` it recovers inline citations (markdown/bare URLs) that engines don't list separately. |

## How it's wired

- **Crawler** (`apps/web/lib/crawl.ts`): fetches robots.txt + sitemap (follows
  sitemap-index, parses XML), BFS-crawls same-host pages respecting Googlebot
  robots, and per page runs `analyzePage`/`pageIssues`, `analyzeAeo` (stored as
  `pages.aeo_score`, median on `crawls.aeo_score`), readability, schema types and
  orphan detection. Returns `aeoScore`, `schemaTypes`, `crawlerAccess`.
- **Technical view** (`clients/[id]/technical`): builds `buildStrategy` from the
  stored crawl and renders the "How to rank higher" card, plus the per-page AEO
  column and aggregated issues.
- **Free audit** (`/audit` → `/api/public/audit/instant`): no-login, runs the
  same crawl + strategy and returns score, breakdown, crawler access, schema
  types and top fixes (RS-406). In-process per-IP rate limit.

## Adding a new check

1. Add the signal + a `SeoIssue` (or AEO recommendation) in the relevant
   `packages/core` module, with a unit test.
2. If it has a fix, add a `RECIPE` entry (code → area/effort/how) in
   `strategy/strategy.ts` so it appears in the action plan.
3. Issues flow automatically through the crawler → Technical view → audit; no UI
   change needed unless you want a dedicated display.

Run `pnpm --filter @rootspun/core test` after touching any of this.
