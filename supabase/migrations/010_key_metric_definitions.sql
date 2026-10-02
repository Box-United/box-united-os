-- Key metrics become a list the team can add to. Run after 009.
--
-- Each key metric belongs to one department. Only that department's lead, or
-- the executive director, can add or remove a metric. You lead a department
-- when it's one of your departments and the person you report to isn't in it
-- (e.g. Alexandra leads Program; program staff who report to her don't).
-- Anyone can still update the numbers, which happens together each month.

-- True when the signed-in user leads `dept`
create or replace function public.leads_department(dept text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and dept = any(me.departments)
      and not exists (
        select 1 from public.profiles m
        where m.id = coalesce(me.manager_id,
          (select id from public.profiles where role = 'executive_director' and id <> me.id order by created_at limit 1))
          and dept = any(m.departments)
      )
  );
$$;
revoke execute on function public.leads_department(text) from public, anon;
grant  execute on function public.leads_department(text) to authenticated;

create table if not exists public.key_metrics (
  key         text primary key default gen_random_uuid()::text,
  label       text not null,
  department  text not null
                check (department in ('program', 'development', 'operations', 'marketing', 'finance', 'accounting')),
  unit        text not null default 'number' check (unit in ('number', 'currency', 'percent')),
  sort_order  integer not null default 0,
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz default now()
);

alter table public.key_metrics enable row level security;
drop policy if exists "key_metrics_read"   on public.key_metrics;
drop policy if exists "key_metrics_insert" on public.key_metrics;
drop policy if exists "key_metrics_update" on public.key_metrics;
drop policy if exists "key_metrics_delete" on public.key_metrics;
create policy "key_metrics_read" on public.key_metrics for select to authenticated using (true);
create policy "key_metrics_insert" on public.key_metrics for insert to authenticated
  with check (public.is_exec() or public.leads_department(department));
create policy "key_metrics_update" on public.key_metrics for update to authenticated
  using (public.is_exec() or public.leads_department(department))
  with check (public.is_exec() or public.leads_department(department));
create policy "key_metrics_delete" on public.key_metrics for delete to authenticated
  using (public.is_exec() or public.leads_department(department));

-- The three metrics the team already tracks
insert into public.key_metrics (key, label, department, unit, sort_order, created_by) values
  ('schools', 'Schools', 'program', 'number', 0, null),
  ('dollars_raised', 'Raised', 'development', 'currency', 1, null),
  ('students', 'Girls served', 'program', 'number', 2, null)
on conflict (key) do nothing;

-- Values can now be stored for any metric on the list
alter table public.scorecard_metrics drop constraint if exists scorecard_metrics_metric_key_check;
