
-- =========================================================================
-- Roles
-- =========================================================================
do $$ begin
  create type public.app_role as enum ('admin','dispatcher','coordinator','agent','driver','viewer');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create policy "users read own roles"
  on public.user_roles for select to authenticated
  using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

-- =========================================================================
-- updated_at helper
-- =========================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- =========================================================================
-- baggage_cases  (Lost & Found)
-- =========================================================================
create table if not exists public.baggage_cases (
  id uuid primary key default gen_random_uuid(),
  bag_id text not null unique,             -- human PIR/case id, e.g. "PIR-000123"
  pir_number text not null,
  lf_status text not null default 'Open',
  incomplete boolean not null default false,

  passenger_first_name text,
  passenger_last_name text,
  passenger_mobile text,
  passenger_email text,
  preferred_language text default 'en',
  priority text not null default 'Normal',

  airline text,
  flight_number text,
  flight_date date,
  origin text,
  destination text,

  bag_tags text[] not null default '{}',
  bag_description text,
  number_of_bags integer not null default 1,

  delivery_method text default 'Home Delivery',
  delivery_address text,
  delivery_notes text,

  handover_delivery_id uuid,               -- set when handed to Delivery
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.baggage_cases to authenticated;
grant all on public.baggage_cases to service_role;
alter table public.baggage_cases enable row level security;

create policy "staff read cases"    on public.baggage_cases for select to authenticated using (true);
create policy "staff insert cases"  on public.baggage_cases for insert to authenticated with check (true);
create policy "staff update cases"  on public.baggage_cases for update to authenticated using (true) with check (true);
create policy "staff delete cases"  on public.baggage_cases for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create trigger baggage_cases_updated_at
  before update on public.baggage_cases
  for each row execute function public.set_updated_at();

create index if not exists baggage_cases_lf_status_idx on public.baggage_cases(lf_status);
create index if not exists baggage_cases_created_at_idx on public.baggage_cases(created_at desc);

-- =========================================================================
-- deliveries
-- =========================================================================
create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  delivery_id text not null unique,        -- human id, e.g. "DEL-000123"
  case_id uuid not null references public.baggage_cases(id) on delete restrict,
  stage text not null default 'Ready for Delivery',
  priority text not null default 'Normal',

  passenger_name text not null,
  mobile text not null,
  address text not null,
  method text not null default 'Home Delivery',
  notes text,

  driver text,
  driver_assigned_at timestamptz,
  driver_accepted_at timestamptz,
  trip_started_at timestamptz,
  delivered_at timestamptz,

  otp_code text,                           -- 4-digit; single source of truth
  otp_issued_at timestamptz,
  otp_verified boolean not null default false,

  tracking_token text not null unique,     -- passenger portal token
  pir_number text not null,
  bag_tag text,
  airline text,
  flight_number text,

  fail_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.deliveries to authenticated;
grant all on public.deliveries to service_role;
alter table public.deliveries enable row level security;

create policy "staff read deliveries"   on public.deliveries for select to authenticated using (true);
create policy "staff insert deliveries" on public.deliveries for insert to authenticated with check (true);
create policy "staff update deliveries" on public.deliveries for update to authenticated using (true) with check (true);
create policy "staff delete deliveries" on public.deliveries for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create trigger deliveries_updated_at
  before update on public.deliveries
  for each row execute function public.set_updated_at();

create index if not exists deliveries_stage_idx on public.deliveries(stage);
create index if not exists deliveries_driver_idx on public.deliveries(driver);
create index if not exists deliveries_case_idx on public.deliveries(case_id);
create index if not exists deliveries_token_idx on public.deliveries(tracking_token);

alter table public.baggage_cases
  add constraint baggage_cases_handover_fk
  foreign key (handover_delivery_id) references public.deliveries(id) on delete set null
  deferrable initially deferred;

-- =========================================================================
-- workflow_events  (Workflow Engine ledger — append only)
-- =========================================================================
create table if not exists public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.baggage_cases(id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor text,
  role text,
  reason text,
  created_at timestamptz not null default now()
);

grant select, insert on public.workflow_events to authenticated;
grant all on public.workflow_events to service_role;
alter table public.workflow_events enable row level security;

create policy "staff read workflow"   on public.workflow_events for select to authenticated using (true);
create policy "staff insert workflow" on public.workflow_events for insert to authenticated with check (true);

create index if not exists workflow_events_case_idx     on public.workflow_events(case_id, created_at desc);
create index if not exists workflow_events_delivery_idx on public.workflow_events(delivery_id, created_at desc);

-- =========================================================================
-- timeline_entries
-- =========================================================================
create table if not exists public.timeline_entries (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.baggage_cases(id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete cascade,
  kind text not null,           -- 'status','note','notification','driver','otp'
  message text not null,
  actor text,
  role text,
  created_at timestamptz not null default now()
);

grant select, insert on public.timeline_entries to authenticated;
grant all on public.timeline_entries to service_role;
alter table public.timeline_entries enable row level security;

create policy "staff read timeline"   on public.timeline_entries for select to authenticated using (true);
create policy "staff insert timeline" on public.timeline_entries for insert to authenticated with check (true);

create index if not exists timeline_case_idx     on public.timeline_entries(case_id, created_at desc);
create index if not exists timeline_delivery_idx on public.timeline_entries(delivery_id, created_at desc);

-- =========================================================================
-- audit_log
-- =========================================================================
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor text,
  role text,
  action text not null,
  target_type text not null,   -- 'case' | 'delivery' | 'notification' | ...
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant select, insert on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;

create policy "staff read audit"   on public.audit_log for select to authenticated using (true);
create policy "staff insert audit" on public.audit_log for insert to authenticated with check (true);

create index if not exists audit_log_created_idx on public.audit_log(created_at desc);

-- =========================================================================
-- notifications
-- =========================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.baggage_cases(id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete cascade,
  channel text not null,       -- sms | whatsapp | email | push
  locale text not null default 'en',
  template_key text,
  subject text,
  body text not null,
  status text not null default 'Queued', -- Queued | Sent | Failed
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

grant select, insert, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;

create policy "staff read notifications"   on public.notifications for select to authenticated using (true);
create policy "staff insert notifications" on public.notifications for insert to authenticated with check (true);
create policy "staff update notifications" on public.notifications for update to authenticated using (true) with check (true);

create index if not exists notifications_case_idx     on public.notifications(case_id, created_at desc);
create index if not exists notifications_delivery_idx on public.notifications(delivery_id, created_at desc);

-- =========================================================================
-- driver_assignments_history
-- =========================================================================
create table if not exists public.driver_assignments_history (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  driver text not null,
  assigned_by text,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  reason text
);

grant select, insert, update on public.driver_assignments_history to authenticated;
grant all on public.driver_assignments_history to service_role;
alter table public.driver_assignments_history enable row level security;

create policy "staff read driver hist"   on public.driver_assignments_history for select to authenticated using (true);
create policy "staff insert driver hist" on public.driver_assignments_history for insert to authenticated with check (true);
create policy "staff update driver hist" on public.driver_assignments_history for update to authenticated using (true) with check (true);

create index if not exists driver_hist_delivery_idx on public.driver_assignments_history(delivery_id, assigned_at desc);

-- =========================================================================
-- Realtime
-- =========================================================================
do $$ begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if found then
    execute 'alter publication supabase_realtime add table public.baggage_cases';
    execute 'alter publication supabase_realtime add table public.deliveries';
    execute 'alter publication supabase_realtime add table public.workflow_events';
    execute 'alter publication supabase_realtime add table public.timeline_entries';
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
exception when others then null; end $$;

-- =========================================================================
-- Seed (idempotent)
-- =========================================================================
insert into public.baggage_cases (bag_id, pir_number, lf_status, passenger_first_name, passenger_last_name, passenger_mobile, passenger_email, airline, flight_number, flight_date, origin, destination, bag_tags, bag_description, number_of_bags, delivery_method, delivery_address, priority)
values
  ('PIR-000101','PIR-000101','Open','Sara','Ahmed','+201001234567','sara@example.com','EGYPTAIR','MS777','2026-07-17','CAI','JFK', array['MS12345678'], 'Black hardshell, medium', 1, 'Home Delivery','12 Nile Corniche, Cairo, Egypt','Normal'),
  ('PIR-000102','PIR-000102','Under Investigation','Omar','Hassan','+201009876543','omar@example.com','EGYPTAIR','MS999','2026-07-16','LHR','CAI', array['MS87654321'], 'Blue soft duffel', 1, 'Home Delivery','25 Zamalek St, Cairo','High'),
  ('PIR-000103','PIR-000103','Ready for Delivery','Layla','Youssef','+201234567890','layla@example.com','QATAR AIRWAYS','QR1301','2026-07-17','DOH','CAI', array['QR55501122'], 'Silver hardshell, large', 1, 'Home Delivery','7 Maadi Rd, Cairo','VIP')
on conflict (bag_id) do nothing;
