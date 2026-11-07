-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Phase 2 — Tech Lab & Why Engine v1                                         ║
-- ║ Crawls, Core Web Vitals, crawler access, Google rules, causes, alerts.     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create type public.cwv_source as enum ('crux', 'psi');
create type public.cause_status as enum ('new', 'accepted', 'dismissed');
create type public.cause_confidence as enum ('high', 'medium', 'low');

create table public.crawls (
  id         uuid primary key default gen_random_uuid(),
  agency_id  uuid not null references public.agencies (id) on delete cascade,
  client_id  uuid not null references public.clients (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  page_count integer not null default 0,
  status     text not null default 'running'
);

create table public.pages (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies (id) on delete cascade,
  crawl_id      uuid not null references public.crawls (id) on delete cascade,
  url           text not null,
  status        integer,
  canonical     text,
  robots        text,
  nosnippet     boolean not null default false,
  rendered_diff numeric(5,2),          -- % difference raw vs rendered text
  template      text
);
create index pages_crawl_idx on public.pages (crawl_id);

create table public.cwv_metrics (
  id        uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  template  text not null,
  lcp_ms    integer,
  inp_ms    integer,
  cls       numeric(4,3),
  source    public.cwv_source not null,
  date      date not null default current_date
);

create table public.crawler_access (
  id         uuid primary key default gen_random_uuid(),
  agency_id  uuid not null references public.agencies (id) on delete cascade,
  client_id  uuid not null references public.clients (id) on delete cascade,
  bot        text not null,            -- googlebot, google-extended, gptbot, perplexitybot, …
  allowed    boolean not null,
  blocked_by text,                     -- robots | cdn | null
  checked_at timestamptz not null default now()
);

-- Google rules library mirror (seeded from packages/rules; watched for changes, RS-204).
create table public.google_rules (
  id              text primary key,    -- matches packages/rules ids, e.g. rule.cwv.poor
  title           text not null,
  url             text not null,
  summary         text not null,
  checksum        text,
  last_changed_at timestamptz
);
alter table public.google_rules enable row level security;
create policy "google rules readable by all" on public.google_rules
  for select to authenticated using (true);

create table public.causes (
  id         uuid primary key default gen_random_uuid(),
  agency_id  uuid not null references public.agencies (id) on delete cascade,
  client_id  uuid not null references public.clients (id) on delete cascade,
  prompt_id  uuid references public.prompts (id) on delete cascade,
  engine_id  smallint references public.engines (id),
  type       text not null,
  evidence   jsonb not null default '{}'::jsonb,
  rule_id    text references public.google_rules (id),
  confidence public.cause_confidence not null default 'low',
  impact     numeric(14,2) not null default 0,  -- search volume × lost visibility
  status     public.cause_status not null default 'new',
  created_at timestamptz not null default now()
);
create index causes_client_impact_idx on public.causes (client_id, impact desc);

create table public.alerts (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies (id) on delete cascade,
  client_id     uuid not null references public.clients (id) on delete cascade,
  kind          text not null default 'score_drop',
  threshold     numeric(5,2) not null default -5,  -- points week on week
  last_fired_at timestamptz
);

-- Standard agency RLS for the tenant tables above.
do $$
declare t text;
begin
  foreach t in array array[
    'crawls','pages','cwv_metrics','crawler_access','causes','alerts'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'create policy "agency members access" on public.%I for all '
      || 'using (public.is_agency_member(agency_id)) '
      || 'with check (public.is_agency_member(agency_id));', t);
  end loop;
end $$;
