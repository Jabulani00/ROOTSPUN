-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Phase 3 & 4 — Fix Studio, proof loop, API, billing                         ║
-- ║ fixes, fix_outcomes, api_keys, subscriptions (+ standard agency RLS).       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create type public.fix_kind as enum ('dev', 'content', 'pr');
create type public.fix_status as enum ('open', 'in_progress', 'shipped');
create type public.billing_provider as enum ('paystack', 'stripe');

create table public.fixes (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references public.agencies (id) on delete cascade,
  client_id    uuid not null references public.clients (id) on delete cascade,
  cause_id     uuid references public.causes (id) on delete set null,
  title        text not null,
  kind         public.fix_kind not null default 'dev',
  brief        jsonb not null default '{}'::jsonb,
  external_ref text,                       -- Jira/Asana link (RS-306)
  status       public.fix_status not null default 'open',
  shipped_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index fixes_client_idx on public.fixes (client_id, status);

create table public.fix_outcomes (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies (id) on delete cascade,
  fix_id      uuid not null references public.fixes (id) on delete cascade,
  metric      text not null,              -- uvs | citations | gsc_clicks
  before      numeric,
  after       numeric,
  window_days integer not null default 14
);

create table public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references public.agencies (id) on delete cascade,
  hash         text not null,             -- store only a hash of the key (NFR-01/02)
  scopes       text[] not null default '{}',
  last_used_at timestamptz,
  created_at   timestamptz not null default now()
);

create table public.subscriptions (
  agency_id   uuid primary key references public.agencies (id) on delete cascade,
  provider    public.billing_provider not null,
  plan        public.agency_plan not null default 'starter',
  status      text not null default 'active',
  period_end  timestamptz
);

-- Standard agency RLS.
do $$
declare t text;
begin
  foreach t in array array['fixes','fix_outcomes','api_keys','subscriptions']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'create policy "agency members access" on public.%I for all '
      || 'using (public.is_agency_member(agency_id)) '
      || 'with check (public.is_agency_member(agency_id));', t);
  end loop;
end $$;
