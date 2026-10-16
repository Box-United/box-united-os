-- Dorothy's 30/60/90 day plan, Oct 21 to Dec 31, 2026. Run after 020.
--
-- Adds to Dorothy's dashboard, as set by Alexandra:
--   * a personal goal for 2026
--   * 3 rocks for Q4 2026 that support it, and 2 for Q1 2027 (which show from January)
--   * KPIs under each Q4 rock, in three areas: Attendance, Coaches, New schools
--   * dated tasks for each Q4 rock, and undated ones for the Q1 rocks
--   * repeating tasks: the Monday email update to coaches, training reminders
--     until Dec 14, and Fighter of the Month (last Wednesday of each month)
-- Everything is in the Program department and on her dashboard only, not the
-- Team Board. The repeating tasks appear the next time anyone opens the OS.
--
-- Nothing happens if Dorothy or Alexandra has no profile. Anything already
-- there with the same name is skipped, so running it again adds nothing new.
-- Changes after that are made in the app.

do $$
declare
  dot  uuid := (select id from public.profiles where lower(email) = 'dorothy@boxunited.org');
  alex uuid := (select id from public.profiles where lower(email) = 'alexandra@boxunited.org');
  goal_title text := 'By Dec 31, attendance, training and payment tracking run on their own at every active site, and coach support requests handled by the COO are down 50% or more';
  goal uuid;
  r_attendance uuid; r_coaches uuid; r_schools uuid; r_equipment uuid; r_report uuid;
  a_attendance uuid; a_coaches uuid; a_schools uuid;
begin
  if dot is null or alex is null then
    raise notice 'Dorothy or Alexandra has no profile yet, so nothing was added';
    return;
  end if;

  -- ---------- personal goal ----------
  select id into goal from public.individual_goals where user_id = dot and year = 2026 and title = goal_title;
  if goal is null then
    insert into public.individual_goals (user_id, year, title, status, sort_order)
    values (dot, 2026, goal_title, 'not-started', (select count(*) from public.individual_goals where user_id = dot and year = 2026))
    returning id into goal;
  end if;

  -- ---------- rocks ----------
  insert into public.rocks (user_id, title, status, quarter, goal_id)
  select dot, v.title, 'not-started', v.quarter, v.goal
  from (values
    ('Fall attendance logged and reconciled by Nov 30, with systems documented and handed off', 'Q4 2026', goal),
    ('Every coach trained, paid and supported: training and Safe Sport complete, paid by Nov 27, COO escalations down 50%', 'Q4 2026', goal),
    ('Every newly signed school onboarded and visited before spring', 'Q4 2026', goal),
    ('Equipment inventory documented for every site, ready for Spring 2027', 'Q1 2027', null),
    ('Final Fall 2026 report and grant data delivered', 'Q1 2027', null)
  ) as v(title, quarter, goal)
  where not exists (select 1 from public.rocks r where r.user_id = dot and r.quarter = v.quarter and r.title = v.title);

  select id into r_attendance from public.rocks where user_id = dot and quarter = 'Q4 2026' and title like 'Fall attendance logged and reconciled%';
  select id into r_coaches    from public.rocks where user_id = dot and quarter = 'Q4 2026' and title like 'Every coach trained, paid and supported%';
  select id into r_schools    from public.rocks where user_id = dot and quarter = 'Q4 2026' and title like 'Every newly signed school onboarded%';
  select id into r_equipment  from public.rocks where user_id = dot and quarter = 'Q1 2027' and title like 'Equipment inventory documented%';
  select id into r_report     from public.rocks where user_id = dot and quarter = 'Q1 2027' and title like 'Final Fall 2026 report%';

  -- ---------- KPI areas ----------
  insert into public.kpi_areas (user_id, name, department, sort_order)
  select dot, v.name, 'program', (select count(*) from public.kpi_areas where user_id = dot) + v.n
  from (values ('Attendance', 0), ('Coaches', 1), ('New schools', 2)) as v(name, n)
  where not exists (select 1 from public.kpi_areas a where a.user_id = dot and a.name = v.name);

  select id into a_attendance from public.kpi_areas where user_id = dot and name = 'Attendance';
  select id into a_coaches    from public.kpi_areas where user_id = dot and name = 'Coaches';
  select id into a_schools    from public.kpi_areas where user_id = dot and name = 'New schools';

  -- ---------- KPIs for Q4 2026 (no target = tracked by status alone) ----------
  insert into public.kpis (area_id, user_id, title, target, current, status, sort_order, year, quarter, rock_id, updated_by)
  select v.area, dot, v.title, v.target, case when v.target is not null then 0 end, 'not-started', v.n, 2026, 4, v.rock, alex
  from (values
    (a_attendance, r_attendance, 'Active sites submitting attendance weekly', 18, 0),
    (a_attendance, r_attendance, 'Attendance submitted within 48 hours of each session (%)', 100, 1),
    (a_attendance, r_attendance, 'Sites with pre- and post-program surveys complete (%)', 80, 2),
    (a_attendance, r_attendance, 'Jump rope and punch assessment checkpoints done at every site', 3, 3),
    (a_coaches, r_coaches, 'Active coaches fully trained with a current Safe Sport credential (%)', 100, 0),
    (a_coaches, r_coaches, 'Active coaches with a complete Ramp Vendor Portal account (%)', 100, 1),
    (a_coaches, r_coaches, 'programs@boxunited.org emails answered within 48 hours (%)', 100, 2),
    (a_coaches, r_coaches, 'Coach questions escalated to the COO: down 50% from September', null, 3),
    (a_coaches, r_coaches, 'Coach support requests: down 30% from Day 30 (Nov 20)', null, 4),
    (a_coaches, r_coaches, 'Payment holds for missing paperwork: 0', null, 5),
    (a_schools, r_schools, 'Newly signed schools with a complete onboarding checklist (%)', 100, 0),
    (a_schools, r_schools, 'Newly signed schools visited (%)', 100, 1)
  ) as v(area, rock, title, target, n)
  where not exists (select 1 from public.kpis k where k.user_id = dot and k.year = 2026 and k.quarter = 4 and k.title = v.title);

  -- ---------- tasks (Day 30 = Nov 20, Day 60 = Dec 18, Day 90 = Dec 31) ----------
  insert into public.team_tasks (created_by, assigned_to, title, description, due_date, rock_id, on_team_board, department)
  select alex, dot, v.title, v.notes, v.due::date, v.rock, false, 'program'
  from (values
    ('Pull an enrollment and attendance report from Charity Rescue', null, '2026-11-06', r_attendance),
    ('Finish onboarding on Charity Rescue, Ramp and the OS', null, '2026-11-20', r_attendance),
    ('Upload all outstanding paper permission slips', null, '2026-11-20', r_attendance),
    ('Log and reconcile all Fall 2026 attendance', null, '2026-11-30', r_attendance),
    ('Document Charity Rescue, Ramp and the OS and hand them off', null, '2026-12-31', r_attendance),
    ('Close every open data gap at season close', null, '2026-12-31', r_attendance),

    ('Audit every coach''s training status', 'Online modules, in person, and Safe Sport. Reminders then go out every Monday until everyone has finished.', '2026-10-30', r_coaches),
    ('Set up every active coach in the Ramp Vendor Portal', 'Account, payment details and tax forms.', '2026-11-20', r_coaches),
    ('Clear every coach for payment, with no holds for missing paperwork', null, '2026-11-20', r_coaches),
    ('Record the Day 30 coach support-request count', 'The baseline for "Coach support requests: down 30% from Day 30".', '2026-11-20', r_coaches),
    ('Hold an open training session for new coaches (1 of 3)', null, '2026-11-20', r_coaches),
    ('Pull a detailed attendance report for coach pay', 'Ready before Thanksgiving for the Nov 27 end-of-season payment.', '2026-11-23', r_coaches),
    ('Process end-of-season coach payments', null, '2026-11-27', r_coaches),
    ('Hold an open training session for new coaches (2 of 3)', null, '2026-12-18', r_coaches),
    ('Hold an open training session for new coaches (3 of 3)', null, '2026-12-31', r_coaches),
    ('Get the training compliance tracker reviewed and signed off', 'Ahead of the next hiring cycle.', '2026-12-31', r_coaches),
    ('Close out any open Ramp issues', null, '2026-12-31', r_coaches),

    ('Complete the onboarding checklist for each newly signed school', 'Confirmed schedule, coach assignment and contact info, training status, and an equipment plan.', '2026-12-31', r_schools),
    ('Visit each newly signed school', null, '2026-12-31', r_schools),

    ('Audit equipment at every site against enrollment', null, null, r_equipment),
    ('Finish flagged equipment reallocations', 'For example, Pirie''s overflow gear.', null, r_equipment),
    ('Document equipment inventory for every site', null, null, r_equipment),

    ('Clean attendance, survey and assessment data for reporting', null, null, r_report),
    ('Draft the preliminary Fall 2026 report with per-site breakdowns', null, null, r_report),
    ('Deliver the final Fall 2026 season report', null, null, r_report),
    ('Deliver all requested grant reporting data', null, null, r_report)
  ) as v(title, notes, due, rock)
  where not exists (select 1 from public.team_tasks t where t.assigned_to = dot and t.title = v.title);

  -- ---------- repeating tasks (1 = Monday, 3 = Wednesday) ----------
  insert into public.recurring_tasks (title, description, assigned_to, created_by, rock_id, on_team_board,
                                      frequency, weekdays, month_week, starts_on, ends_on, department)
  select v.title, v.notes, dot, alex, v.rock, false, v.frequency, v.weekdays, v.month_week, v.starts::date, v.ends::date, 'program'
  from (values
    ('Send the weekly email update to coaches', 'First thing Monday morning.', r_coaches, 'weekly', array[1], null, '2026-11-02', null),
    ('Send training reminders to coaches who haven''t finished', 'Stop repeating once every coach is done.', r_coaches, 'weekly', array[1], null, '2026-11-02', '2026-12-14'),
    ('Help pick Fighter of the Month', null, null, 'monthly', array[3], -1, '2026-10-21', null)
  ) as v(title, notes, rock, frequency, weekdays, month_week, starts, ends)
  where not exists (select 1 from public.recurring_tasks r where r.assigned_to = dot and r.title = v.title);
end $$;
