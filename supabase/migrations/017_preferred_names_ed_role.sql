-- What people go by, and reporting to the Executive Director as a role.
-- Run after 016, then paste the updated monday-sync function into Supabase.
--
-- profiles.preferred_name is the name the OS shows for someone ("Mary Kate"
-- rather than "Mary"). The executive director can set it for anyone.
--
-- Anyone who reported to the executive director by name now reports to the
-- role. An empty manager already means "reports to the executive director",
-- so whoever holds the role sees and reviews the same people.

alter table public.profiles add column if not exists preferred_name text;

update public.profiles set preferred_name = 'Mary Kate'
  where lower(email) = 'marykate@boxunited.org' and preferred_name is null;

update public.profiles set manager_id = null
  where manager_id in (select id from public.profiles where role = 'executive_director');
