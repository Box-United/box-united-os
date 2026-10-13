-- Tasks get departments and the goals' status list.
-- Run after 017. Nothing to paste: the monday-sync function keeps working as is.
--
-- 1. Tasks can be tagged with a department, like team goals. A repeating
--    task's department goes on each task it makes.
-- 2. Tasks use Not started / On track / Off track / Done, like goals, rocks
--    and KPIs. To do becomes Not started; In progress becomes On track.
--    Whatever still writes the old values (the app before this update, the
--    Monday sync, repeating tasks) keeps working: "todo" means not done, so a
--    task that's On track or Off track keeps its status, and one that was
--    Done goes back to Not started.
--
-- Safe to run more than once.

-- ============================================================
-- 1. Departments
-- ============================================================
alter table public.team_tasks      add column if not exists department text;
alter table public.recurring_tasks add column if not exists department text;

alter table public.team_tasks drop constraint if exists team_tasks_department_valid;
alter table public.team_tasks add constraint team_tasks_department_valid
  check (department in ('program', 'development', 'operations', 'marketing', 'finance', 'accounting'));
alter table public.recurring_tasks drop constraint if exists recurring_tasks_department_valid;
alter table public.recurring_tasks add constraint recurring_tasks_department_valid
  check (department in ('program', 'development', 'operations', 'marketing', 'finance', 'accounting'));

-- ============================================================
-- 2. One status list
-- ============================================================
-- Old values become new ones as each task is written (before the status check runs)
create or replace function public.team_task_defaults()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'todo' then
    new.status := case
      when tg_op = 'UPDATE' and old.status in ('not-started', 'on-track', 'off-track') then old.status
      else 'not-started'
    end;
  elsif new.status = 'in-progress' then
    new.status := 'on-track';
  end if;

  if tg_op = 'INSERT' and new.department is null and new.recurring_id is not null then
    select department into new.department from recurring_tasks where id = new.recurring_id;
  end if;
  return new;
end;
$$;

drop trigger if exists team_tasks_defaults on public.team_tasks;
create trigger team_tasks_defaults
  before insert or update of status on public.team_tasks
  for each row execute procedure public.team_task_defaults();

-- Drop the old status check, whatever it was named
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where contype = 'c' and conrelid = 'public.team_tasks'::regclass
      and pg_get_constraintdef(oid) ~ '\mstatus\M'
  loop
    execute format('alter table public.team_tasks drop constraint %I', c.conname);
  end loop;
end $$;

update public.team_tasks set status = 'not-started' where status = 'todo';
update public.team_tasks set status = 'on-track'    where status = 'in-progress';

alter table public.team_tasks add constraint team_tasks_status_valid
  check (status in ('not-started', 'on-track', 'off-track', 'done'));
alter table public.team_tasks alter column status set default 'not-started';
