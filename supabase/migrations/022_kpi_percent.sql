-- Percent KPIs. Run after 021.
--
-- A KPI is now counted in a number (the default) or a percent. The OS shows a
-- percent KPI as "65% · target 80%", with its bar running from 0 to 100% and
-- a mark at the target, instead of "65/80". Copies made when a quarter or
-- year ends keep the KPI's unit.
--
-- Dorothy's KPIs whose names end in "(%)" become percent KPIs and lose the
-- "(%)", since the OS now shows it. Safe to run again.

alter table public.kpis add column if not exists unit text not null default 'number';
alter table public.kpis drop constraint if exists kpis_unit_valid;
alter table public.kpis add constraint kpis_unit_valid check (unit in ('number', 'percent'));

-- public.roll_forward() copies KPIs without naming a unit; take it from the
-- KPI being copied
create or replace function public.kpi_copy_unit()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.copied_from is not null then
    select unit into new.unit from kpis where id = new.copied_from;
    new.unit := coalesce(new.unit, 'number');
  end if;
  return new;
end;
$$;

drop trigger if exists kpis_copy_unit on public.kpis;
create trigger kpis_copy_unit
  before insert on public.kpis
  for each row execute procedure public.kpi_copy_unit();

update public.kpis
  set unit = 'percent',
      title = regexp_replace(title, '\s*\(%\)\s*$', '')
  where title ~ '\(%\)\s*$'
    and user_id = (select id from public.profiles where lower(email) = 'dorothy@boxunited.org');
