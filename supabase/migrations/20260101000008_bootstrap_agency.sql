-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ First-login agency bootstrap (RS-001/003)                                  ║
-- ║ Creating an agency + the owner membership from the client hits an RLS       ║
-- ║ chicken-and-egg: you can't SELECT the agency you just inserted because you  ║
-- ║ are not yet a member. This SECURITY DEFINER function does both atomically   ║
-- ║ and returns the id, so a new user lands in a working agency on first login. ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create or replace function public.bootstrap_agency(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- Idempotent: if the user already belongs to an agency, return it.
  select agency_id into v_id from public.memberships where user_id = auth.uid() limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.agencies (name)
  values (coalesce(nullif(trim(p_name), ''), 'My agency'))
  returning id into v_id;

  insert into public.memberships (agency_id, user_id, role)
  values (v_id, auth.uid(), 'owner');

  return v_id;
end;
$$;

revoke all on function public.bootstrap_agency(text) from public;
grant execute on function public.bootstrap_agency(text) to authenticated;
