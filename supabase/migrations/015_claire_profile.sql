-- Claire's title, departments and manager. Run after 014.
--
-- 008 and 009 set these for the current team, but Claire hadn't signed in yet,
-- so she had no profile to update and showed up with no title. She has now.
-- Title is set to Development Director; departments and manager are only
-- filled in if still empty, so anything Mary Kate already set is kept.

update public.profiles
  set title = 'Development Director',
      departments = case when departments = '{}' then '{development,finance,accounting}' else departments end,
      manager_id = coalesce(manager_id, (select id from public.profiles where role = 'executive_director' order by created_at limit 1))
  where lower(email) = 'claire@boxunited.org';
