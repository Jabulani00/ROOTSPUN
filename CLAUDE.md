# Rootspun — notes for Claude / contributors

## What this is
White-label agency SaaS measuring Google organic + AI-answer visibility, with a
"Why Engine" that explains losses against Google's documentation. Full spec:
`docs/Rootspun-by-XP-Project-Specification.md`. Stories use IDs `RS-PNN`.

## Golden rules (non-negotiable)
- **RLS everywhere.** Every tenant table has `agency_id` and the standard policy
  (`using (public.is_agency_member(agency_id))`). New tables need a migration +
  RLS + a cross-tenant test proving agency A can't read agency B.
- **service_role only in the worker.** Never import it into `apps/web` client code.
- **Pure logic lives in `packages/core`** and must stay dependency-free and
  unit-tested (≥70% coverage; NFR-12). Scoring + Why Engine are here.
- **Every outside API call logs cost** into `usage_events` (NFR-09).
- **3 runs per engine** (NFR-07); results are shown as a share + confidence, never
  a single yes/no.
- **Official APIs / licensed SERP only** — no scraping of Google or chat apps (NFR-10).
- TypeScript strict; generated Supabase types in `packages/db`; migrations in VCS.

## Conventions
- Monorepo managed by pnpm + Turborepo. Packages are `@rootspun/*`.
- Use workspace deps via `workspace:*`.
- Run `pnpm --filter @rootspun/core test` after touching scoring or the Why Engine.

## Build order (follow the phases)
Phase 0 foundation + Phase 1/2 core scoring & Why Engine are done. The `apps/web`
app shell, auth (live hosted Supabase), dashboards, Technical crawl, Keywords
view and the free `/audit` page are built and running.

The SEO/AEO analysis suite (crawl, on-page, AEO, internal links, readability,
schema, keyword rank, and the unified "how to rank higher" strategy engine) lives
in `packages/core` and is documented in `docs/seo-aeo-engine.md` — read that
before touching scoring/analysis. Live AI-answer and SERP runs still need the
user's API keys (LLM keys, licensed SERP, or the free Google CSE key); crawling,
technical SEO and AEO analysis need none.
