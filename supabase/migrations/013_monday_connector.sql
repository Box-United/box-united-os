-- Monday connector. Run after 012.
--
-- Tasks can now also be tied to a personal annual goal or a team annual goal
-- (besides a KPI or rock). Tasks synced from someone's Monday board only go on
-- the Team Board when their "Team" box is ticked; tasks linked to a rock, KPI
-- or goal still show on the person's dashboard.
--
-- monday_items remembers which item on the shared "Box United OS · Rocks, KPIs
-- & Goals" Monday board stands for which rock / KPI / goal. Only the
-- monday-sync edge function (service role) writes it.

alter table public.team_tasks add column if not exists goal_id uuid references public.individual_goals(id) on delete set null;
alter table public.team_tasks add column if not exists team_goal_id uuid references public.annual_goals(id) on delete set null;
alter table public.team_tasks add column if not exists on_team_board boolean not null default true;

create table if not exists public.monday_items (
  os_kind         text not null check (os_kind in ('rock', 'kpi', 'goal', 'team_goal')),
  os_id           uuid not null,
  monday_item_id  text not null unique,
  synced_hash     text,
  primary key (os_kind, os_id)
);
alter table public.monday_items enable row level security;
drop policy if exists "monday_items_read" on public.monday_items;
create policy "monday_items_read" on public.monday_items for select to authenticated using (true);

alter table public.monday_connections add column if not exists last_synced_at timestamptz;
