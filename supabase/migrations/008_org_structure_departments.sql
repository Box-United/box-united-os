-- Reporting lines, departments and department tags.
--
-- Reporting lines (profiles.manager_id; no manager = reports to the executive
-- director) decide visibility: a person's manager and the ED can see and edit
-- their work, check-ins and reviews. Each person also has a job title and the
-- departments they work in (program, development, operations). Key metrics,
-- team annual goals and KPI areas carry a department tag, so each person's
-- Scorecard shows only their own areas plus those of the people who report to
-- them. The ED sees everything. Untagged team goals are for the whole team.
--
-- End-of-week check-ins become visible only to the person, their manager and
-- the executive director (the same people who can see performance reviews).

-- ============================================================
-- Profiles: title + departments
-- ============================================================
alter table public.profiles add column if not exists title text;
alter table public.profiles add column if not exists departments text[] not null default '{}';

alter table public.profiles drop constraint if exists profiles_departments_valid;
alter table public.profiles add constraint profiles_departments_valid
  check (departments <@ array['program', 'development', 'operations']::text[]);

-- Only the ED can change role, manager or departments (departments decide what
-- shows on each person's Scorecard). People can still edit their own title.
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_exec()
     and (new.role is distinct from old.role
          or new.manager_id is distinct from old.manager_id
          or new.departments is distinct from old.departments) then
    raise exception 'Only the executive director can change roles, managers or departments';
  end if;
  return new;
end;
$$;

-- ============================================================
-- Department tags on team annual goals and KPI areas (null = whole team)
-- ============================================================
alter table public.annual_goals add column if not exists department text
  check (department in ('program', 'development', 'operations'));
alter table public.kpi_areas add column if not exists department text
  check (department in ('program', 'development', 'operations'));

-- Existing KPI areas were usually named after their department
update public.kpi_areas set department = 'program'
  where department is null and name ~* '^\s*programs?\y';
update public.kpi_areas set department = 'development'
  where department is null and name ~* '^\s*(development|fundrais)';
update public.kpi_areas set department = 'operations'
  where department is null and name ~* '^\s*(operations?|ops)\y';

-- ============================================================
-- Starting titles and departments for the current team (only where unset)
-- ============================================================
update public.profiles set title = 'Executive Director'
  where role = 'executive_director' and title is null;
update public.profiles set title = 'Chief Operating Officer', departments = '{operations}'
  where lower(email) = 'alexandra@boxunited.org' and title is null;
update public.profiles set title = 'Development Director', departments = '{development}'
  where lower(email) = 'claire@boxunited.org' and title is null;

-- ============================================================
-- End-of-week check-ins: the person, their manager and the ED only
-- ============================================================
drop policy if exists "eow_read" on public.eow_submissions;
create policy "eow_read" on public.eow_submissions for select to authenticated
  using (auth.uid() = user_id or public.can_review(user_id));
