-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Team invites (FR-01)                                                       ║
-- ║ Owners/admins invite by email with a role; the invitee accepts via a token ║
-- ║ link. accept_invite (SECURITY DEFINER) creates the membership so a brand-   ║
-- ║ new user (not yet a member) can join without tripping RLS.                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create type public.invite_status as enum ('pending', 'accepted', 'revoked');

create table public.invites (
  id         uuid primary key default gen_random_uuid(),
  agency_id  uuid not null references public.agencies (id) on delete cascade,
  email      text not null,
  role       public.app_role not null default 'analyst',
  token      text not null unique,
  status     public.invite_status not null default 'pending',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days'
);
create index invites_agency_idx on public.invites (agency_id, status);

alter table public.invites enable row level security;

-- Agency members can see their agency's invites; owners/admins manage them.
create policy "members read invites" on public.invites
  for select using (public.is_agency_member(agency_id));
create policy "admins manage invites" on public.invites
  for all using (public.has_agency_role(agency_id, array['owner','admin']::public.app_role[]))
  with check (public.has_agency_role(agency_id, array['owner','admin']::public.app_role[]));

-- Accept an invite by token: create the membership for the current user and mark
-- the invite accepted. Returns the agency id, or raises if invalid/expired.
create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites;
begin
  select * into v_invite from public.invites
  where token = p_token and status = 'pending' and expires_at > now();
  if not found then
    raise exception 'invite not found or expired';
  end if;

  insert into public.memberships (agency_id, user_id, role)
  values (v_invite.agency_id, auth.uid(), v_invite.role)
  on conflict (agency_id, user_id) do update set role = excluded.role;

  update public.invites set status = 'accepted' where id = v_invite.id;
  return v_invite.agency_id;
end;
$$;

revoke all on function public.accept_invite(text) from public;
grant execute on function public.accept_invite(text) to authenticated;
