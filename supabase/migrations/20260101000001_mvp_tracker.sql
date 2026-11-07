-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Phase 1 — MVP tracker                                                      ║
-- ║ Clients, prompts, engines, runs, extraction, scores, GSC, usage, reports.  ║
-- ║ Every tenant table carries agency_id and gets the standard RLS policy.     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create type public.prompt_intent as enum ('informational', 'commercial', 'transactional', 'navigational');
create type public.brand_term_type as enum ('brand', 'product', 'person');
create type public.sentiment as enum ('positive', 'neutral', 'negative');
create type public.usage_kind as enum ('prompt_run', 'page_crawl');
create type public.integration_provider as enum ('gsc', 'ga4');

-- ── Clients & their world ──────────────────────────────────────────────────
create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  agency_id  uuid not null references public.agencies (id) on delete cascade,
  name       text not null,
  country    text not null default 'ZA',
  language   text not null default 'en',
  created_at timestamptz not null default now()
);

create table public.domains (
  id         uuid primary key default gen_random_uuid(),
  agency_id  uuid not null references public.agencies (id) on delete cascade,
  client_id  uuid not null references public.clients (id) on delete cascade,
  host       text not null,
  is_primary boolean not null default false,
  unique (client_id, host)
);

create table public.competitors (
  id        uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  name      text not null,
  host      text not null
);

create table public.brand_terms (
  id        uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  term      text not null,
  type      public.brand_term_type not null default 'brand'
);

create table public.prompts (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies (id) on delete cascade,
  client_id     uuid not null references public.clients (id) on delete cascade,
  text          text not null,
  topic         text,
  intent        public.prompt_intent,
  priority      boolean not null default false,
  search_volume integer not null default 0,
  created_at    timestamptz not null default now()
);
create index prompts_client_idx on public.prompts (client_id);

-- Engines are global reference data (not tenant-scoped) — read-only to all.
create table public.engines (
  id   smallint primary key generated always as identity,
  code text not null unique
);

-- ── Runs & extraction (time-series; partition candidates at scale, NFR-05) ────
create table public.runs (
  id         uuid primary key default gen_random_uuid(),
  agency_id  uuid not null references public.agencies (id) on delete cascade,
  prompt_id  uuid not null references public.prompts (id) on delete cascade,
  engine_id  smallint not null references public.engines (id),
  run_at     timestamptz not null default now(),
  sample_no  smallint not null default 1,          -- 1..3 (NFR-07)
  raw_ref    text,                                  -- storage path to raw answer/SERP
  cost_usd   numeric(10,5) not null default 0
);
create index runs_prompt_idx on public.runs (prompt_id, run_at desc);

create table public.mentions (
  id        uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  run_id    uuid not null references public.runs (id) on delete cascade,
  entity    text not null,          -- 'client' or a competitor id/name
  position  smallint,
  sentiment public.sentiment
);

create table public.citations (
  id        uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  run_id    uuid not null references public.runs (id) on delete cascade,
  url       text not null,
  host      text not null,
  is_client boolean not null default false,
  rank      smallint
);

create table public.scores_daily (
  id             uuid primary key default gen_random_uuid(),
  agency_id      uuid not null references public.agencies (id) on delete cascade,
  client_id      uuid not null references public.clients (id) on delete cascade,
  engine_id      smallint references public.engines (id),
  topic          text,
  date           date not null,
  uvs            numeric(5,2) not null,
  share_of_voice numeric(5,2) not null default 0,
  confidence     text not null default 'low',
  unique (client_id, engine_id, topic, date)
);
create index scores_daily_client_date_idx on public.scores_daily (client_id, date desc);

-- ── Integrations & synced data ───────────────────────────────────────────────
create table public.integrations (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references public.agencies (id) on delete cascade,
  client_id       uuid references public.clients (id) on delete cascade,
  provider        public.integration_provider not null,
  vault_secret_id uuid,                              -- NFR-02: token lives in Vault
  status          text not null default 'pending',
  created_at      timestamptz not null default now()
);

create table public.gsc_daily (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete cascade,
  date        date not null,
  query       text,
  page        text,
  clicks      integer not null default 0,
  impressions integer not null default 0,
  position    numeric(6,2)
);
create index gsc_daily_client_date_idx on public.gsc_daily (client_id, date desc);

create table public.usage_events (
  id        uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  kind      public.usage_kind not null,
  qty       integer not null default 1,
  cost_usd  numeric(10,5) not null default 0,
  at        timestamptz not null default now()
);
create index usage_events_agency_at_idx on public.usage_events (agency_id, at desc);

create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references public.agencies (id) on delete cascade,
  client_id    uuid not null references public.clients (id) on delete cascade,
  period       text not null,
  storage_path text,
  created_by   uuid references auth.users (id),
  created_at   timestamptz not null default now()
);

-- ── Standard RLS: a user accesses a row only within their agency ──────────────
do $$
declare t text;
begin
  foreach t in array array[
    'clients','domains','competitors','brand_terms','prompts','runs',
    'mentions','citations','scores_daily','integrations','gsc_daily',
    'usage_events','reports'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'create policy "agency members access" on public.%I for all '
      || 'using (public.is_agency_member(agency_id)) '
      || 'with check (public.is_agency_member(agency_id));', t);
  end loop;
end $$;

-- Engines: global read-only reference data.
alter table public.engines enable row level security;
create policy "engines readable by all" on public.engines
  for select to authenticated using (true);

-- client_viewer restriction: viewers only see their mapped client (RS-308).
-- Layered on top of the agency policy for the read-heavy tables.
create policy "client viewer scoped clients" on public.clients
  for select using (
    public.is_agency_member(agency_id)
    and (
      not public.has_agency_role(agency_id, array['client_viewer']::public.app_role[])
      or id in (select client_id from public.memberships where user_id = auth.uid())
    )
  );
