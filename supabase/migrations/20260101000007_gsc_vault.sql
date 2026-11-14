-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ RS-107 / NFR-02 — Search Console OAuth token storage in Supabase Vault      ║
-- ║ The web OAuth callback calls connect_gsc_integration (membership-checked,   ║
-- ║ SECURITY DEFINER) to encrypt the refresh token in Vault and record the      ║
-- ║ integration. The worker reads it back via gsc_refresh_token (service role). ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Store a GSC refresh token in Vault and record the integration. Returns the id.
create or replace function public.connect_gsc_integration(p_client_id uuid, p_refresh_token text)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_agency uuid;
  v_secret uuid;
  v_integration uuid;
begin
  select agency_id into v_agency from public.clients where id = p_client_id;
  if v_agency is null then
    raise exception 'client not found';
  end if;
  if not public.is_agency_member(v_agency) then
    raise exception 'not authorized';
  end if;

  v_secret := vault.create_secret(p_refresh_token, 'gsc_refresh_' || p_client_id::text);

  insert into public.integrations (agency_id, client_id, provider, vault_secret_id, status)
  values (v_agency, p_client_id, 'gsc', v_secret, 'connected')
  returning id into v_integration;

  return v_integration;
end;
$$;

revoke all on function public.connect_gsc_integration(uuid, text) from public;
grant execute on function public.connect_gsc_integration(uuid, text) to authenticated;

-- Read a connected integration's decrypted refresh token. Service-role only
-- (no grant to authenticated); the worker calls this to refresh access tokens.
create or replace function public.gsc_refresh_token(p_integration_id uuid)
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select ds.decrypted_secret
  from public.integrations i
  join vault.decrypted_secrets ds on ds.id = i.vault_secret_id
  where i.id = p_integration_id and i.provider = 'gsc';
$$;

revoke all on function public.gsc_refresh_token(uuid) from public;
revoke all on function public.gsc_refresh_token(uuid) from authenticated;
