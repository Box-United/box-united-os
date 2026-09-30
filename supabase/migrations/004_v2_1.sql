-- Box United OS v2.1
-- Decision Log + Team Meeting removed; KPIs, metric history, EOW status,
-- notifications, Monday connections; manager-aware permissions.

-- ============================================================
-- Remove Decision Log and Team Meeting topics
-- ============================================================
drop table if exists public.decisions;
drop table if exists public.meeting_topics;

-- ============================================================
-- Profiles: manager relationship + role
-- role = 'executive_director' can edit everything
-- ============================================================
alter table public.profiles add column if not exists manager_id uuid references public.profiles(id) on delete set null;

-- True when the signed-in user may edit items owned by owner_id:
-- the owner, the owner's manager, or the executive director.
create or replace function public.can_edit(owner_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    auth.uid() = owner_id
    or exists (select 1 from public.profiles where id = owner_id and manager_id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'executive_director')
  );
$$;

create or replace function public.is_exec()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'executive_director');
$$;

-- Profiles: people update their own row; the ED can update anyone's
drop policy if exists "profiles_write" on public.profiles;
drop policy if exists "profiles_own_update" on public.profiles;
create policy "profiles_own_update" on public.profiles for update to authenticated
  using (auth.uid() = id or public.is_exec());

-- Only the ED can change role or manager (blocks self-promotion)
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_exec()
     and (new.role is distinct from old.role or new.manager_id is distinct from old.manager_id) then
    raise exception 'Only the executive director can change roles or managers';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute procedure public.guard_profile_privileges();

-- ============================================================
-- Rocks: owner + manager + ED can write
-- ============================================================
drop policy if exists "rocks_own_write"  on public.rocks;
drop policy if exists "rocks_own_insert" on public.rocks;
drop policy if exists "rocks_own_update" on public.rocks;
drop policy if exists "rocks_own_delete" on public.rocks;
create policy "rocks_insert" on public.rocks for insert to authenticated with check (public.can_edit(user_id));
create policy "rocks_update" on public.rocks for update to authenticated using (public.can_edit(user_id));
create policy "rocks_delete" on public.rocks for delete to authenticated using (public.can_edit(user_id));

-- ============================================================
-- KPI areas (one per program area per person, each linked to a Monday board)
-- ============================================================
create table if not exists public.kpi_areas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  monday_url  text,
  sort_order  integer not null default 0,
  created_at  timestamptz default now()
);

create table if not exists public.kpis (
  id          uuid primary key default gen_random_uuid(),
  area_id     uuid not null references public.kpi_areas(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  target      numeric,
  current     numeric,
  status      text not null default 'on-track'
                check (status in ('not-started', 'in-progress', 'on-track', 'off-track', 'done')),
  sort_order  integer not null default 0,
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz default now(),
  created_at  timestamptz default now()
);

alter table public.kpi_areas enable row level security;
alter table public.kpis      enable row level security;

create policy "kpi_areas_read"   on public.kpi_areas for select to authenticated using (true);
create policy "kpi_areas_insert" on public.kpi_areas for insert to authenticated with check (public.can_edit(user_id));
create policy "kpi_areas_update" on public.kpi_areas for update to authenticated using (public.can_edit(user_id));
create policy "kpi_areas_delete" on public.kpi_areas for delete to authenticated using (public.can_edit(user_id));

create policy "kpis_read"   on public.kpis for select to authenticated using (true);
create policy "kpis_insert" on public.kpis for insert to authenticated with check (public.can_edit(user_id));
create policy "kpis_update" on public.kpis for update to authenticated using (public.can_edit(user_id));
create policy "kpis_delete" on public.kpis for delete to authenticated using (public.can_edit(user_id));

create index if not exists kpi_areas_user on public.kpi_areas (user_id);
create index if not exists kpis_area      on public.kpis (area_id);
create index if not exists kpis_user      on public.kpis (user_id);

-- ============================================================
-- Team tasks: KPI / rock link, meeting flag, Monday source, monthly archive
-- ============================================================
alter table public.team_tasks add column if not exists kpi_id              uuid references public.kpis(id)  on delete set null;
alter table public.team_tasks add column if not exists rock_id             uuid references public.rocks(id) on delete set null;
alter table public.team_tasks add column if not exists assigned_in_meeting boolean not null default false;
alter table public.team_tasks add column if not exists source              text not null default 'manual' check (source in ('manual', 'monday'));
alter table public.team_tasks add column if not exists monday_item_id      text unique;
alter table public.team_tasks add column if not exists completed_at        timestamptz;
alter table public.team_tasks add column if not exists archived_month      text;  -- 'YYYY-MM' once archived
alter table public.team_tasks add column if not exists needs_discussion    boolean not null default false;

-- Stamp completed_at whenever status moves to / from done
create or replace function public.stamp_team_task_completed()
returns trigger language plpgsql as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
    new.archived_month := null;
  end if;
  return new;
end;
$$;

drop trigger if exists team_tasks_completed on public.team_tasks;
create trigger team_tasks_completed
  before insert or update of status on public.team_tasks
  for each row execute procedure public.stamp_team_task_completed();

-- Anyone can add a task and assign any owner; edits limited to creator, owner + managers
drop policy if exists "team_tasks_update" on public.team_tasks;
drop policy if exists "team_tasks_delete" on public.team_tasks;
create policy "team_tasks_update" on public.team_tasks for update to authenticated
  using (auth.uid() = created_by or (assigned_to is not null and public.can_edit(assigned_to)));
create policy "team_tasks_delete" on public.team_tasks for delete to authenticated
  using (auth.uid() = created_by or (assigned_to is not null and public.can_edit(assigned_to)));

create index if not exists team_tasks_due     on public.team_tasks (due_date);
create index if not exists team_tasks_archive on public.team_tasks (archived_month);

-- ============================================================
-- Notifications
-- ============================================================
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  actor_id    uuid references public.profiles(id) on delete set null,
  task_id     uuid references public.team_tasks(id) on delete cascade,
  kind        text not null default 'task_assigned',
  message     text not null,
  read_at     timestamptz,
  created_at  timestamptz default now()
);

alter table public.notifications enable row level security;
create policy "notifications_own_read"   on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "notifications_own_update" on public.notifications for update to authenticated using (auth.uid() = user_id);
create policy "notifications_own_delete" on public.notifications for delete to authenticated using (auth.uid() = user_id);
create index if not exists notifications_user on public.notifications (user_id, read_at);

-- Notify the owner when a task lands on their board from someone who is not
-- them or their manager, and it was not assigned in a meeting.
create or replace function public.notify_task_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor uuid := auth.uid();
  actor_name text;
  owner_manager uuid;
begin
  if new.assigned_to is null or actor is null or new.assigned_to = actor or new.assigned_in_meeting then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.assigned_to is not distinct from new.assigned_to then
    return new;
  end if;

  select manager_id into owner_manager from profiles where id = new.assigned_to;
  if owner_manager = actor or exists (select 1 from profiles where id = actor and role = 'executive_director') then
    return new;
  end if;

  select coalesce(split_part(full_name, ' ', 1), email) into actor_name from profiles where id = actor;
  insert into notifications (user_id, actor_id, task_id, message)
  values (
    new.assigned_to, actor, new.id,
    actor_name || ' added "' || new.title || '" to your board'
      || coalesce(' (due ' || to_char(new.due_date, 'Mon DD') || ')', '')
      || '. It wasn''t assigned in a meeting.'
  );
  return new;
end;
$$;

drop trigger if exists team_tasks_notify on public.team_tasks;
create trigger team_tasks_notify
  after insert or update of assigned_to on public.team_tasks
  for each row execute procedure public.notify_task_assignment();

-- ============================================================
-- Metric history (every edit is kept)
-- ============================================================
create table if not exists public.metric_history (
  id          uuid primary key default gen_random_uuid(),
  year        integer not null,
  metric_key  text not null,
  actual      numeric,
  target      numeric,
  edited_by   uuid references public.profiles(id) on delete set null,
  edited_at   timestamptz default now()
);

alter table public.metric_history enable row level security;
create policy "metric_history_read" on public.metric_history for select to authenticated using (true);
create index if not exists metric_history_key on public.metric_history (year, metric_key, edited_at desc);

create or replace function public.log_metric_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.actual is not distinct from new.actual and old.target is not distinct from new.target then
    return new;
  end if;
  insert into metric_history (year, metric_key, actual, target, edited_by)
  values (new.year, new.metric_key, new.actual, new.target, coalesce(new.updated_by, auth.uid()));
  return new;
end;
$$;

drop trigger if exists scorecard_metrics_history on public.scorecard_metrics;
create trigger scorecard_metrics_history
  after insert or update on public.scorecard_metrics
  for each row execute procedure public.log_metric_history();

-- ============================================================
-- End-of-week status
-- ============================================================
create table if not exists public.eow_submissions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  week_of       date not null,  -- Monday of the week
  answers       jsonb not null default '{}'::jsonb,
  submitted_at  timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (user_id, week_of)
);

alter table public.eow_submissions enable row level security;
create policy "eow_read"   on public.eow_submissions for select to authenticated using (true);
create policy "eow_insert" on public.eow_submissions for insert to authenticated with check (auth.uid() = user_id);
-- editable by the author until the Sunday night that ends that week
create policy "eow_update" on public.eow_submissions for update to authenticated
  using (auth.uid() = user_id and current_date <= week_of + 6);
create index if not exists eow_week on public.eow_submissions (week_of desc);

-- ============================================================
-- Monday connections (one board per person)
-- ============================================================
create table if not exists public.monday_connections (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  board_id     text not null,
  board_name   text,
  board_url    text,
  column_map   jsonb not null default '{}'::jsonb,  -- { owner, due, kpi, team }
  webhook_ids  jsonb not null default '[]'::jsonb,
  from_template boolean not null default false,
  created_at   timestamptz default now()
);

alter table public.monday_connections enable row level security;
create policy "monday_read" on public.monday_connections for select to authenticated using (true);
create policy "monday_own"  on public.monday_connections for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
