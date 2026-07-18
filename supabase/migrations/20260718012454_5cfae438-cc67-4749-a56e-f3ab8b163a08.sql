
-- Drop the earlier normalized tables and their triggers/policies.
drop table if exists public.driver_assignments_history cascade;
drop table if exists public.notifications cascade;
drop table if exists public.audit_log cascade;
drop table if exists public.timeline_entries cascade;
drop table if exists public.workflow_events cascade;
drop table if exists public.deliveries cascade;
drop table if exists public.baggage_cases cascade;

-- Single-row app state: the store's snapshot, upserted on every emit,
-- broadcast to every signed-in client via realtime.
create table if not exists public.app_state (
  id text primary key default 'global',
  payload jsonb not null default '{}'::jsonb,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

grant select, insert, update on public.app_state to authenticated;
grant all on public.app_state to service_role;

alter table public.app_state enable row level security;

create policy "staff read app_state"
  on public.app_state for select to authenticated
  using (auth.uid() is not null);

create policy "staff upsert app_state"
  on public.app_state for insert to authenticated
  with check (auth.uid() is not null);

create policy "staff update app_state"
  on public.app_state for update to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- Seed the singleton row (idempotent).
insert into public.app_state (id, payload, version) values ('global', '{}'::jsonb, 0)
on conflict (id) do nothing;

-- Realtime broadcast.
do $$ begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if found then
    begin execute 'alter publication supabase_realtime add table public.app_state'; exception when others then null; end;
  end if;
end $$;

alter table public.app_state replica identity full;
