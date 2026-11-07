-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Phase 0 — Foundation (RS-002)                                              ║
-- ║ Agencies, memberships, roles, and the multi-tenant RLS backbone.           ║
-- ║ NFR-01: RLS on every table keyed on agency_id.                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create extension if not exists "pgcrypto";

-- ── Enums ──────────────────────────────────────────────────────────────────
create type public.app_role as enum ('owner', 'admin', 'analyst', 'client_viewer');
create type public.agency_plan as enum ('trial', 'starter', 'growth', 'scale');

-- ── Core tenant tables ───────────────────────────────────────────────────────
create table public.agencies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  plan          public.agency_plan not null default 'trial',
  branding      jsonb not null default '{}'::jsonb,
  custom_domain text unique,
  created_at    timestamptz not null default now()
);

create table public.memberships (
  id         uuid primary key default gen_random_uuid(),
  agency_id  uuid not null references public.agencies (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.app_role not null default 'analyst',
  -- client_viewer rows are scoped to a single client (set in the clients migration via FK-less uuid)
  client_id  uuid,
  created_at timestamptz not null default now(),
  unique (agency_id, user_id)
);

create index memberships_user_idx on public.memberships (user_id);
create index memberships_agency_idx on public.memberships (agency_id);

-- ── Membership helpers (SECURITY DEFINER to avoid recursive RLS) ──────────────
-- Returns the agency ids the current user belongs to. Used by every RLS policy.
create or replace function public.current_agency_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select agency_id from public.memberships where user_id = auth.uid();
$$;

create or replace function public.is_agency_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and agency_id = target
  );
$$;

-- Role check within an agency (for write policies / UI gating, FR-01).
create or replace function public.has_agency_role(target uuid, roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and agency_id = target and role = any (roles)
  );
$$;

-- ── Enable RLS ────────────────────────────────────────────────────────────────
alter table public.agencies enable row level security;
alter table public.memberships enable row level security;

-- Agencies: a member can read their own agency; owners/admins can update it.
create policy "members read own agency" on public.agencies
  for select using (public.is_agency_member(id));

create policy "owners update own agency" on public.agencies
  for update using (public.has_agency_role(id, array['owner','admin']::public.app_role[]))
  with check (public.has_agency_role(id, array['owner','admin']::public.app_role[]));

-- Memberships: a user sees membership rows for agencies they belong to.
create policy "read memberships in own agencies" on public.memberships
  for select using (public.is_agency_member(agency_id));

-- Only owners/admins manage memberships (invites, role changes).
create policy "owners manage memberships" on public.memberships
  for all using (public.has_agency_role(agency_id, array['owner','admin']::public.app_role[]))
  with check (public.has_agency_role(agency_id, array['owner','admin']::public.app_role[]));

-- A newly signed-up user may create the agency they own, then their own membership.
create policy "authenticated create agency" on public.agencies
  for insert to authenticated with check (true);

create policy "self insert first membership" on public.memberships
  for insert to authenticated with check (user_id = auth.uid());
