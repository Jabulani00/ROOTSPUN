# ADR 0001 — Core architecture

**Status:** accepted · **Date:** 2026-11-07

## Context
Rootspun is multi-tenant agency SaaS with heavy, costly background work (prompt
runs across AI engines, SERP collection, crawling, Google syncs). It must isolate
every agency's data and grow 10× without a rewrite (NFR-05).

## Decisions

1. **Supabase as the backbone.** Postgres + RLS for multi-tenancy, Auth for
   sign-in/invites, Storage for reports/logs, Queues (pgmq) + pg_cron for jobs,
   Vault for secrets. Avoids running our own DB/auth/queue/scheduler.

2. **RLS is the security boundary, not the app layer.** The web app only reads and
   writes through Supabase with the user's session. Every tenant table carries
   `agency_id` and the same policy. `service_role` is confined to the worker.
   Rationale: a single, auditable rule; no "forgot the WHERE agency_id" class of bug.

3. **Pure core in `packages/core`.** Scoring (UVS, share of voice) and the Why
   Engine are pure functions with no I/O, so they're fast to unit-test to the
   NFR-12 coverage bar and reusable by both web and worker.

4. **Rules library in `packages/rules`.** Google's guidance is data (JSON), mirrored
   into a `google_rules` table and watched for changes (RS-204). The Why Engine
   emits a `ruleId`; the worker joins it to the library so advice stays current.

5. **Worker pulls from Queues.** All slow/costly work runs in the Node worker on
   Fly.io/Railway: pgmq consumer with 3× retry + dead-letter (NFR-06). pg_cron
   enqueues scheduled jobs; the web app enqueues on-demand ("run now").

6. **Provider adapters.** One adapter per outside API (SERP, each LLM, Google data)
   behind a stable interface so providers can be swapped — mitigates the risk that a
   SERP provider lacks reliable AI Mode data.

## Consequences
- Security reviews focus on the RLS policy template and the service_role boundary.
- Scoring changes are cheap and safe to verify (pure + tested).
- Swapping a SERP/LLM provider is an adapter change, not a rewrite.
