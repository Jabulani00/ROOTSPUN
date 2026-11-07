-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ RS-406 — free public AI-visibility audit (lead generation)                 ║
-- ║ Not tenant data: captured pre-signup. RLS is enabled with no public        ║
-- ║ policies, so only the service role (the API route) may read/write.          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create table public.audit_requests (
  id          uuid primary key default gen_random_uuid(),
  domain      text not null,
  competitors text[] not null default '{}',
  email       text not null,
  ip          text,
  status      text not null default 'queued',  -- queued | running | done | abuse_blocked
  result      jsonb,
  created_at  timestamptz not null default now()
);

create index audit_requests_ip_idx on public.audit_requests (ip, created_at desc);

alter table public.audit_requests enable row level security;
-- No policies: anon/authenticated clients cannot read or write directly; the
-- public /api/public/audit route uses the service role with app-layer limits.
