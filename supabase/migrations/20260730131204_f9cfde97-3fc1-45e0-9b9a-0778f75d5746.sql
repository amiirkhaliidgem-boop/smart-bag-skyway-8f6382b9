create or replace function public.system_db_facts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'realtime_tables', (
      select count(*) from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public'
    ),
    'public_tables', (
      select count(*) from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
    ),
    'server_version', current_setting('server_version', true)
  )
$$;

revoke all on function public.system_db_facts() from public, anon, authenticated;
grant execute on function public.system_db_facts() to service_role;

update public.integrations
set enabled = false,
    status = 'not_configured',
    last_error = ''
where secrets_ciphertext is null;