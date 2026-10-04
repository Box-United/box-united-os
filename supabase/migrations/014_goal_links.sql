-- Goals, rocks and KPIs become one chain. Run after 013.
--
--   Key metric  ←  Team annual goal  ←  Rocks  ←  KPIs  ←  Tasks
--                  Personal goal     ←  Rocks  ←  KPIs
--
-- A rock can support one goal (a team goal or one of its owner's personal
-- goals). A KPI can support one goal or one rock; many KPIs can sit under the
-- same goal or rock. A team goal can point to the key metric it moves.
-- All links are optional and clear themselves if the parent is deleted.

alter table public.rocks add column if not exists team_goal_id uuid references public.annual_goals(id) on delete set null;
alter table public.rocks add column if not exists goal_id uuid references public.individual_goals(id) on delete set null;
alter table public.rocks drop constraint if exists rocks_one_parent;
alter table public.rocks add constraint rocks_one_parent check (num_nonnulls(team_goal_id, goal_id) <= 1);

alter table public.kpis add column if not exists team_goal_id uuid references public.annual_goals(id) on delete set null;
alter table public.kpis add column if not exists goal_id uuid references public.individual_goals(id) on delete set null;
alter table public.kpis add column if not exists rock_id uuid references public.rocks(id) on delete set null;
alter table public.kpis drop constraint if exists kpis_one_parent;
alter table public.kpis add constraint kpis_one_parent check (num_nonnulls(team_goal_id, goal_id, rock_id) <= 1);

alter table public.annual_goals add column if not exists metric_key text references public.key_metrics(key) on delete set null;

create index if not exists rocks_team_goal on public.rocks (team_goal_id);
create index if not exists rocks_goal on public.rocks (goal_id);
create index if not exists kpis_team_goal on public.kpis (team_goal_id);
create index if not exists kpis_goal on public.kpis (goal_id);
create index if not exists kpis_rock on public.kpis (rock_id);
