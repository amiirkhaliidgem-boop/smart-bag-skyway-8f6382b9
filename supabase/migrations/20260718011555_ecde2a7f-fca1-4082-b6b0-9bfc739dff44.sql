
-- 1) Lock down the SECURITY DEFINER helper: only service_role may execute it.
revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role) to service_role;

-- 2) Replace "always true" write policies with signed-in checks; deletes require admin via user_roles.
-- baggage_cases
drop policy if exists "staff insert cases"  on public.baggage_cases;
drop policy if exists "staff update cases"  on public.baggage_cases;
drop policy if exists "staff delete cases"  on public.baggage_cases;
create policy "staff insert cases" on public.baggage_cases
  for insert to authenticated with check (auth.uid() is not null);
create policy "staff update cases" on public.baggage_cases
  for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "admin delete cases" on public.baggage_cases
  for delete to authenticated
  using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'));

-- deliveries
drop policy if exists "staff insert deliveries" on public.deliveries;
drop policy if exists "staff update deliveries" on public.deliveries;
drop policy if exists "staff delete deliveries" on public.deliveries;
create policy "staff insert deliveries" on public.deliveries
  for insert to authenticated with check (auth.uid() is not null);
create policy "staff update deliveries" on public.deliveries
  for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "admin delete deliveries" on public.deliveries
  for delete to authenticated
  using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'));

-- workflow_events
drop policy if exists "staff insert workflow" on public.workflow_events;
create policy "staff insert workflow" on public.workflow_events
  for insert to authenticated with check (auth.uid() is not null);

-- timeline_entries
drop policy if exists "staff insert timeline" on public.timeline_entries;
create policy "staff insert timeline" on public.timeline_entries
  for insert to authenticated with check (auth.uid() is not null);

-- audit_log
drop policy if exists "staff insert audit" on public.audit_log;
create policy "staff insert audit" on public.audit_log
  for insert to authenticated with check (auth.uid() is not null);

-- notifications
drop policy if exists "staff insert notifications" on public.notifications;
drop policy if exists "staff update notifications" on public.notifications;
create policy "staff insert notifications" on public.notifications
  for insert to authenticated with check (auth.uid() is not null);
create policy "staff update notifications" on public.notifications
  for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);

-- driver_assignments_history
drop policy if exists "staff insert driver hist" on public.driver_assignments_history;
drop policy if exists "staff update driver hist" on public.driver_assignments_history;
create policy "staff insert driver hist" on public.driver_assignments_history
  for insert to authenticated with check (auth.uid() is not null);
create policy "staff update driver hist" on public.driver_assignments_history
  for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
