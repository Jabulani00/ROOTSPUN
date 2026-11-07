-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Supabase Queues (pgmq) + a membership-checked enqueue path for the web app ║
-- ║ The browser session never holds the service key; it calls this SECURITY    ║
-- ║ DEFINER function, which verifies agency membership before enqueuing.        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create extension if not exists pgmq;

select pgmq.create('rootspun_jobs');
select pgmq.create('rootspun_jobs_dlq');

/**
 * RS-* "run now": fan out a fresh collection for every prompt of a client, then
 * a scoring job. Authorised by agency membership (not the service role), so it
 * is safe to call from the user's session via supabase.rpc().
 */
create or replace function public.request_client_refresh(p_client_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pgmq
as $$
declare
  v_agency uuid;
  v_prompt record;
  v_count integer := 0;
begin
  select agency_id into v_agency from public.clients where id = p_client_id;
  if v_agency is null then
    raise exception 'client not found';
  end if;
  if not public.is_agency_member(v_agency) then
    raise exception 'not authorized';
  end if;

  for v_prompt in
    select id, text from public.prompts where client_id = p_client_id
  loop
    perform pgmq.send('rootspun_jobs', jsonb_build_object(
      'type', 'serp_run',
      'agencyId', v_agency,
      'clientId', p_client_id,
      'promptId', v_prompt.id,
      'prompt', v_prompt.text
    ));
    v_count := v_count + 1;
  end loop;

  perform pgmq.send('rootspun_jobs', jsonb_build_object(
    'type', 'score',
    'clientId', p_client_id,
    'date', to_char(current_date, 'YYYY-MM-DD')
  ));

  return v_count;
end;
$$;

revoke all on function public.request_client_refresh(uuid) from public;
grant execute on function public.request_client_refresh(uuid) to authenticated;
