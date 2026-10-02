-- Reporting lines and more departments. Run after 008.
--
-- Departments are now program, development (fundraising), operations,
-- marketing, finance and accounting. Sets the current team's reporting lines
-- and departments: Alexandra and Claire report to Mary Kate (the ED);
-- program staff will report to Alexandra.

-- ============================================================
-- Departments
-- ============================================================
alter table public.profiles drop constraint if exists profiles_departments_valid;
alter table public.profiles add constraint profiles_departments_valid
  check (departments <@ array['program', 'development', 'operations', 'marketing', 'finance', 'accounting']::text[]);

alter table public.annual_goals drop constraint if exists annual_goals_department_check;
alter table public.annual_goals add constraint annual_goals_department_check
  check (department in ('program', 'development', 'operations', 'marketing', 'finance', 'accounting'));

alter table public.kpi_areas drop constraint if exists kpi_areas_department_check;
alter table public.kpi_areas add constraint kpi_areas_department_check
  check (department in ('program', 'development', 'operations', 'marketing', 'finance', 'accounting'));

update public.kpi_areas set department = 'marketing'
  where department is null and name ~* '^\s*marketing';
update public.kpi_areas set department = 'finance'
  where department is null and name ~* '^\s*(finance|financials?)\y';
update public.kpi_areas set department = 'accounting'
  where department is null and name ~* '^\s*accounting';

-- ============================================================
-- Current team: Alexandra and Claire report to Mary Kate (the ED);
-- program staff will report to Alexandra.
-- ============================================================
update public.profiles
  set title = coalesce(title, 'Executive Director'),
      departments = '{marketing,finance,accounting}'
  where role = 'executive_director';

update public.profiles
  set title = coalesce(title, 'Chief Operating Officer'),
      departments = '{program,operations,accounting}',
      manager_id = coalesce(manager_id, (select id from public.profiles where role = 'executive_director' order by created_at limit 1))
  where lower(email) = 'alexandra@boxunited.org';

update public.profiles
  set title = coalesce(title, 'Development Director'),
      departments = '{development,finance,accounting}',
      manager_id = coalesce(manager_id, (select id from public.profiles where role = 'executive_director' order by created_at limit 1))
  where lower(email) = 'claire@boxunited.org';
