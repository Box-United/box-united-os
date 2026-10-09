-- Quarterly KPIs, one status list, recurring tasks, a record of deleted tasks
-- and key metric reordering. Run after 015, then paste the updated monday-sync
-- function into Supabase.
--
-- 1. Goals, rocks and KPIs all use Not started / On track / Off track / Done.
--    "In progress" becomes On track. New rocks and KPIs start as Not started;
--    existing rocks keep their status.
-- 2. Every KPI belongs to a year; quarterly KPIs also belong to a quarter.
--    Existing KPIs become this year's annual KPIs. When a quarter (or year)
--    ends, its KPIs are copied into the next one with counts back at 0, and
--    open tasks move to the copy. public.roll_forward() does this the first
--    time anyone opens the OS in the new period. KPIs added to a period that's
--    already over (backfilling history) are never copied forward.
-- 3. Recurring tasks: a weekly or monthly schedule makes its own tasks. The
--    next one always shows; missed ones stay until they're done or deleted.
-- 4. Deleted tasks are copied into public.deleted_team_tasks, so there's a record.
-- 5. Department leads can move their key metric cards (public.move_key_metric).
--
-- Dates follow Central time (America/Chicago).

create or replace function public.os_today()
returns date language sql stable set search_path = public as $$
  select (now() at time zone 'America/Chicago')::date;
$$;

-- ============================================================
-- 1. One status list
-- ============================================================
update public.kpis             set status = 'on-track' where status = 'in-progress';
update public.individual_goals set status = 'on-track' where status = 'in-progress';
update public.annual_goals     set status = 'on-track' where status = 'in-progress';

-- Drop the old status checks, whatever they were named
do $$
declare c record;
begin
  for c in
    select conrelid::regclass as tbl, conname from pg_constraint
    where contype = 'c'
      and conrelid in ('public.rocks'::regclass, 'public.kpis'::regclass, 'public.annual_goals'::regclass, 'public.individual_goals'::regclass)
      and pg_get_constraintdef(oid) ~ '\mstatus\M'
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;

alter table public.rocks            add constraint rocks_status_valid            check (status in ('not-started', 'on-track', 'off-track', 'done'));
alter table public.kpis             add constraint kpis_status_valid             check (status in ('not-started', 'on-track', 'off-track', 'done'));
alter table public.annual_goals     add constraint annual_goals_status_valid     check (status in ('not-started', 'on-track', 'off-track', 'done'));
alter table public.individual_goals add constraint individual_goals_status_valid check (status in ('not-started', 'on-track', 'off-track', 'done'));
alter table public.rocks alter column status set default 'not-started';
alter table public.kpis  alter column status set default 'not-started';

-- ============================================================
-- 2. Quarterly and annual KPIs
-- ============================================================
alter table public.kpis add column if not exists year integer;
alter table public.kpis add column if not exists quarter integer;           -- empty = annual
alter table public.kpis add column if not exists copied_from uuid references public.kpis(id) on delete set null;
alter table public.kpis add column if not exists rolled_over boolean not null default false;
update public.kpis set year = extract(year from public.os_today())::int where year is null;
alter table public.kpis alter column year set not null;
alter table public.kpis alter column year set default extract(year from public.os_today())::int;
alter table public.kpis drop constraint if exists kpis_quarter_valid;
alter table public.kpis add constraint kpis_quarter_valid check (quarter between 1 and 4);
create unique index if not exists kpis_copied_from on public.kpis (copied_from);
create index if not exists kpis_period on public.kpis (year, quarter);

-- True once a KPI's quarter (or, for an annual KPI, its year) has ended
create or replace function public.kpi_period_over(y integer, q integer)
returns boolean language sql stable set search_path = public as $$
  select case
    when q is null then y < extract(year from public.os_today())
    else y * 4 + q < extract(year from public.os_today()) * 4 + extract(quarter from public.os_today())
  end;
$$;

-- KPIs added to (or moved into) a period that's already over are history and
-- never copied forward. Copies made by roll_forward carry on to the present.
create or replace function public.kpi_mark_past()
returns trigger language plpgsql set search_path = public as $$
begin
  if (tg_op = 'INSERT' and new.copied_from is null)
     or (tg_op = 'UPDATE' and (new.year, new.quarter) is distinct from (old.year, old.quarter)) then
    new.rolled_over := public.kpi_period_over(new.year, new.quarter);
  end if;
  return new;
end;
$$;

drop trigger if exists kpis_mark_past on public.kpis;
create trigger kpis_mark_past
  before insert or update on public.kpis
  for each row execute procedure public.kpi_mark_past();

-- ============================================================
-- 3. Recurring tasks
-- ============================================================
create table if not exists public.recurring_tasks (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  assigned_to    uuid not null references public.profiles(id) on delete cascade,
  created_by     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kpi_id         uuid references public.kpis(id) on delete set null,
  rock_id        uuid references public.rocks(id) on delete set null,
  goal_id        uuid references public.individual_goals(id) on delete set null,
  team_goal_id   uuid references public.annual_goals(id) on delete set null,
  on_team_board  boolean not null default false,
  frequency      text not null check (frequency in ('weekly', 'monthly')),
  every_weeks    integer not null default 1 check (every_weeks between 1 and 4),
  weekdays       integer[] not null check (weekdays <@ array[1, 2, 3, 4, 5, 6, 7] and cardinality(weekdays) > 0),  -- 1 = Monday
  month_week     integer check (month_week in (1, 2, 3, 4, -1)),                                                    -- -1 = last
  starts_on      date not null,
  ends_on        date,                                                                                               -- ends on this date
  max_count      integer check (max_count > 0),                                                                      -- ends after this many
  made_count     integer not null default 0,
  last_date      date,                                                                                               -- latest one made
  created_at     timestamptz default now(),
  constraint recurring_monthly_week check (frequency = 'weekly' or month_week is not null)
);

alter table public.recurring_tasks enable row level security;
drop policy if exists "recurring_tasks_read"   on public.recurring_tasks;
drop policy if exists "recurring_tasks_insert" on public.recurring_tasks;
drop policy if exists "recurring_tasks_update" on public.recurring_tasks;
drop policy if exists "recurring_tasks_delete" on public.recurring_tasks;
create policy "recurring_tasks_read" on public.recurring_tasks for select to authenticated using (true);
create policy "recurring_tasks_insert" on public.recurring_tasks for insert to authenticated with check (auth.uid() = created_by);
create policy "recurring_tasks_update" on public.recurring_tasks for update to authenticated
  using (auth.uid() = created_by or public.can_edit(assigned_to));
create policy "recurring_tasks_delete" on public.recurring_tasks for delete to authenticated
  using (auth.uid() = created_by or public.can_edit(assigned_to));

alter table public.team_tasks add column if not exists recurring_id uuid references public.recurring_tasks(id) on delete set null;
create unique index if not exists team_tasks_recurring_date on public.team_tasks (recurring_id, due_date);

-- Whether a recurring task falls on day d
create or replace function public.recurs_on(r public.recurring_tasks, d date)
returns boolean language sql immutable as $$
  select extract(isodow from d)::int = any(r.weekdays)
    and case r.frequency
      -- every N weeks, counting from the week it starts
      when 'weekly' then ((d - (r.starts_on - (extract(isodow from r.starts_on)::int - 1))) / 7) % r.every_weeks = 0
      -- the 1st–4th (or last) of that weekday in the month
      else case
        when r.month_week = -1 then extract(month from d + 7) <> extract(month from d)
        else (extract(day from d)::int - 1) / 7 + 1 = r.month_week
      end
    end;
$$;

-- Recurring tasks don't send "added to your board" notifications
create or replace function public.notify_task_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor uuid := auth.uid();
  actor_name text;
  owner_manager uuid;
begin
  if new.assigned_to is null or actor is null or new.assigned_to = actor or new.assigned_in_meeting or new.recurring_id is not null then
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

-- ============================================================
-- Copy ended KPIs forward and make recurring tasks. The OS calls this when it
-- opens; running it again does nothing new. Returns what changed so the OS can
-- update Monday.
-- ============================================================
create or replace function public.roll_forward()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  today date := public.os_today();
  k public.kpis;
  r public.recurring_tasks;
  new_id uuid;
  ny integer;
  nq integer;
  d date;
  kpis_copied integer := 0;
  moved uuid[] := '{}';
  made uuid[] := '{}';
begin
  -- KPIs whose quarter or year has ended go into the next one. Repeats so a
  -- KPI catches up if nobody opened the OS for more than one period.
  for pass in 1..12 loop
    exit when not exists (select 1 from kpis where not rolled_over and public.kpi_period_over(year, quarter));
    for k in
      select * from kpis where not rolled_over and public.kpi_period_over(year, quarter)
      order by year, quarter nulls first for update skip locked
    loop
      if k.quarter is null then ny := k.year + 1; nq := null;
      elsif k.quarter = 4 then ny := k.year + 1; nq := 1;
      else ny := k.year; nq := k.quarter + 1;
      end if;

      new_id := null;
      -- Same KPI and target, count back at 0. Goal links carry over within the
      -- same year; rocks are quarterly, so a rock link doesn't.
      insert into kpis (area_id, user_id, title, target, current, status, sort_order, year, quarter, copied_from, team_goal_id, goal_id)
      values (
        k.area_id, k.user_id, k.title, k.target, case when k.target is not null then 0 end, 'not-started', k.sort_order,
        ny, nq, k.id,
        case when (select g.year from annual_goals g where g.id = k.team_goal_id) = ny then k.team_goal_id end,
        case when (select g.year from individual_goals g where g.id = k.goal_id) = ny then k.goal_id end
      )
      on conflict (copied_from) do nothing
      returning id into new_id;

      update kpis set rolled_over = true where id = k.id;

      if new_id is not null then
        kpis_copied := kpis_copied + 1;
        with m as (
          update team_tasks set kpi_id = new_id where kpi_id = k.id and status <> 'done' returning id
        )
        select moved || coalesce(array_agg(m.id), '{}') into moved from m;
        update recurring_tasks set kpi_id = new_id where kpi_id = k.id;
      end if;
    end loop;
  end loop;

  -- Recurring tasks: every one that's come due, plus the next one
  for r in
    select * from recurring_tasks where last_date is null or last_date < today
    for update skip locked
  loop
    d := coalesce(r.last_date + 1, r.starts_on);
    while d <= today + 400 loop
      exit when r.ends_on is not null and d > r.ends_on;
      exit when r.max_count is not null and r.made_count >= r.max_count;
      if public.recurs_on(r, d) then
        new_id := null;
        insert into team_tasks (title, description, assigned_to, created_by, status, due_date,
                                kpi_id, rock_id, goal_id, team_goal_id, on_team_board, recurring_id)
        values (r.title, r.description, r.assigned_to, r.created_by, 'todo', d,
                r.kpi_id, r.rock_id, r.goal_id, r.team_goal_id, r.on_team_board, r.id)
        on conflict (recurring_id, due_date) do nothing
        returning id into new_id;
        if new_id is not null then made := made || new_id; end if;
        r.made_count := r.made_count + 1;
        r.last_date := d;
        exit when d >= today;
      end if;
      d := d + 1;
    end loop;
    update recurring_tasks set made_count = r.made_count, last_date = r.last_date
      where id = r.id and last_date is distinct from r.last_date;
  end loop;

  return jsonb_build_object('kpis_copied', kpis_copied, 'moved_tasks', to_jsonb(moved), 'new_tasks', to_jsonb(made));
end;
$$;

revoke execute on function public.roll_forward() from public, anon;
grant  execute on function public.roll_forward() to authenticated;

-- ============================================================
-- 4. A record of deleted tasks
-- ============================================================
create table if not exists public.deleted_team_tasks (
  id           uuid primary key,          -- the task's id
  title        text,
  assigned_to  uuid,
  created_by   uuid,
  task         jsonb not null,            -- the whole task as it was
  deleted_by   uuid,                      -- empty when Monday or the system removed it
  deleted_at   timestamptz not null default now()
);

alter table public.deleted_team_tasks enable row level security;
drop policy if exists "deleted_team_tasks_read" on public.deleted_team_tasks;
create policy "deleted_team_tasks_read" on public.deleted_team_tasks for select to authenticated
  using (public.is_exec() or public.can_review(assigned_to));

create or replace function public.keep_deleted_task()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into deleted_team_tasks (id, title, assigned_to, created_by, task, deleted_by)
  values (old.id, old.title, old.assigned_to, old.created_by, to_jsonb(old), auth.uid())
  on conflict (id) do update set task = excluded.task, deleted_by = excluded.deleted_by, deleted_at = now();
  return old;
end;
$$;
revoke execute on function public.keep_deleted_task() from public, anon, authenticated;

drop trigger if exists team_tasks_keep_deleted on public.team_tasks;
create trigger team_tasks_keep_deleted
  after delete on public.team_tasks
  for each row execute procedure public.keep_deleted_task();

-- ============================================================
-- 5. Moving key metric cards. Leads can only edit their own department's
-- metrics, so the renumbering of everyone's cards happens here.
-- ============================================================
create or replace function public.move_key_metric(metric text, to_index integer)
returns void language plpgsql security definer set search_path = public as $$
declare
  dept text;
  keys text[];
begin
  select department into dept from key_metrics where key = metric;
  if dept is null then raise exception 'No such key metric'; end if;
  if not (public.is_exec() or public.leads_department(dept)) then
    raise exception 'Only the department''s lead or the executive director can move this metric';
  end if;
  select coalesce(array_agg(key order by sort_order, created_at), '{}') into keys from key_metrics where key <> metric;
  to_index := greatest(0, least(to_index, cardinality(keys)));
  keys := keys[1:to_index] || metric || keys[to_index + 1:];
  update key_metrics m set sort_order = x.i - 1
    from unnest(keys) with ordinality as x(k, i)
    where m.key = x.k and m.sort_order is distinct from (x.i - 1)::int;
end;
$$;

revoke execute on function public.move_key_metric(text, integer) from public, anon;
grant  execute on function public.move_key_metric(text, integer) to authenticated;
