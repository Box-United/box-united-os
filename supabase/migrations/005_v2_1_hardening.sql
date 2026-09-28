-- Box United OS v2.1 hardening (Supabase security advisor)
-- Trigger functions are never called directly; permission helpers are for signed-in users only.

alter function public.stamp_team_task_completed() set search_path = public;
alter function public.check_max_rocks() set search_path = public;
alter function public.handle_new_user() set search_path = public;

revoke execute on function public.guard_profile_privileges() from public, anon, authenticated;
revoke execute on function public.notify_task_assignment()   from public, anon, authenticated;
revoke execute on function public.log_metric_history()       from public, anon, authenticated;
revoke execute on function public.handle_new_user()          from public, anon, authenticated;

-- used inside RLS policies, so signed-in users keep execute
revoke execute on function public.can_edit(uuid) from public, anon;
revoke execute on function public.is_exec()      from public, anon;
grant  execute on function public.can_edit(uuid) to authenticated;
grant  execute on function public.is_exec()      to authenticated;
