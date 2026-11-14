-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ SECURITY FIX — client_viewer scoping (RS-308, NFR-03)                       ║
-- ║                                                                            ║
-- ║ The uniform "agency members access" policy is PERMISSIVE, and the earlier  ║
-- ║ "client viewer scoped clients" policy was also permissive — Postgres ORs   ║
-- ║ permissive policies, so a client_viewer (an agency member) could read      ║
-- ║ EVERY client and all prompt/run/cost data in the agency. We fix this with  ║
-- ║ RESTRICTIVE policies, which AND with the permissive ones.                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Remove the ineffective permissive policy.
drop policy if exists "client viewer scoped clients" on public.clients;

-- Returns the client a user is scoped to as a client_viewer of the given agency,
-- or NULL when the user is not a client_viewer there (i.e. a full agency member).
create or replace function public.viewer_client_id(p_agency uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select client_id
  from public.memberships
  where user_id = auth.uid()
    and agency_id = p_agency
    and role = 'client_viewer'
  limit 1;
$$;

-- ── Tables a client_viewer may see, scoped to their own client ────────────────
-- clients is keyed by id; the rest by client_id.
create policy "viewer scoped" on public.clients as restrictive
  using (public.viewer_client_id(agency_id) is null or id = public.viewer_client_id(agency_id))
  with check (public.viewer_client_id(agency_id) is null or id = public.viewer_client_id(agency_id));

do $$
declare t text;
begin
  foreach t in array array['scores_daily','fixes','reports']
  loop
    execute format(
      'create policy "viewer scoped" on public.%I as restrictive '
      || 'using (public.viewer_client_id(agency_id) is null '
      || '       or client_id = public.viewer_client_id(agency_id)) '
      || 'with check (public.viewer_client_id(agency_id) is null '
      || '       or client_id = public.viewer_client_id(agency_id));', t);
  end loop;
end $$;

-- ── Tables a client_viewer must NOT see at all (prompts, costs, other data) ────
-- A non-viewer yields NULL (allowed); a viewer yields non-NULL (denied).
do $$
declare t text;
begin
  foreach t in array array[
    'domains','competitors','brand_terms','prompts','runs','mentions','citations',
    'integrations','gsc_daily','usage_events','crawls','pages','cwv_metrics',
    'crawler_access','causes','alerts','fix_outcomes','api_keys','subscriptions'
  ]
  loop
    execute format(
      'create policy "viewer no access" on public.%I as restrictive '
      || 'using (public.viewer_client_id(agency_id) is null) '
      || 'with check (public.viewer_client_id(agency_id) is null);', t);
  end loop;
end $$;
