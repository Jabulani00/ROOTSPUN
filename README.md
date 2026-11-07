# Rootspun by XP

White-label SaaS that SEO agencies rent to measure each client's visibility in
Google's organic results **and** in AI answers (AI Overviews, AI Mode, ChatGPT,
Gemini, Perplexity; Claude & Copilot later), explain *why* it moved, and turn
that into fixes grounded in Google's own documentation.

Built on Supabase (Postgres + RLS, Auth, Storage, Queues, Cron). See
[`docs/Rootspun-by-XP-Project-Specification.md`](docs/Rootspun-by-XP-Project-Specification.md)
for the full spec.

## Monorepo layout

```
apps/
  web/      Next.js agency app + client portal
  worker/   Node.js job runner (prompt runs, crawls, syncs, Why Engine, PDFs)
packages/
  core/     Scoring formulas + Why Engine (pure, unit-tested)   ✅ built
  rules/    Google rules library (JSON + loaders)               ✅ built
  db/        Generated Supabase types + typed query helpers
  ui/        Shared shadcn/ui components + charts
  config/    eslint / tsconfig / tailwind presets               ✅ built
supabase/
  migrations/  SQL schema + RLS policies                        ✅ built
  seed.sql     Engines + Google rules reference data            ✅ built
```

## Prerequisites

Node.js ≥ 20, pnpm 9, Docker Desktop (local Supabase), Supabase CLI, Git.

## Getting started

```bash
pnpm install
cp .env.example .env            # fill in keys
supabase start                  # local Postgres, Auth, Storage on :54321
supabase db reset               # apply migrations + seed
pnpm db:types                   # generate packages/db/src/types.ts
pnpm dev                        # web on :3000, worker watch
```

## Common scripts

| Command | What it does |
| --- | --- |
| `pnpm test` | Unit tests (Vitest) across packages |
| `pnpm test:e2e` | Playwright end-to-end tests |
| `pnpm lint` / `pnpm typecheck` | Lint / TypeScript strict checks |
| `pnpm --filter @rootspun/core test` | Scoring + Why Engine tests (coverage-gated) |
| `pnpm db:reset` | Recreate the local DB from migrations + seed |

## Status

Phase 0 foundation + the Phase 1/2 scoring and Why Engine core are in place.
The scoring and Why Engine packages ship with **99%+ unit-test coverage**
(NFR-12 requires 70%). See the spec's phase tables for the full roadmap.

## Security model (NFR-01/02)

The browser only ever talks to Supabase with the signed-in user's session, so
Row Level Security guards every query. The `service_role` key is used **only**
in the worker. Every tenant table carries `agency_id` and is protected by the
standard RLS policy (`is_agency_member(agency_id)`).

# ROOTSPUN
