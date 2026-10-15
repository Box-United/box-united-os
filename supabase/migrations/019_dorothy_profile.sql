-- Dorothy Billings: Program Manager on the Programs team, reporting to Alexandra.
-- Run after 018, once her account exists.
--
-- A profile is made when someone's account is created, which is normally their
-- first Google sign-in. To set Dorothy up before she starts, create her account
-- first: Supabase → Authentication → Users → Add user → Create new user, email
-- dorothy@boxunited.org, Auto Confirm User on. The password is never used; when
-- she signs in with Google, Supabase joins that sign-in to this account.
--
-- Then run this file. With her manager set, Alexandra can add her KPIs, goals,
-- rocks and tasks from her dashboard. Each value is only filled in if still
-- empty, so anything changed later in the app is kept. Before her account
-- exists this changes nothing, and it is safe to run again.

update public.profiles
  set full_name = coalesce(nullif(trim(full_name), ''), 'Dorothy Billings'),
      title = coalesce(nullif(trim(title), ''), 'Program Manager'),
      departments = case when departments = '{}' then '{program}' else departments end,
      manager_id = coalesce(manager_id, (select id from public.profiles where lower(email) = 'alexandra@boxunited.org'))
  where lower(email) = 'dorothy@boxunited.org';
