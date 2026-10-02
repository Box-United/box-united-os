-- Department goals are managed by that department's lead (or the executive
-- director): only they can add, edit, re-tag or delete a goal tagged to their
-- department. Whole-team goals (no department) stay open to everyone, and
-- their creator can delete them. Run after 010 (uses public.leads_department).

drop policy if exists "annual_goals_insert" on public.annual_goals;
drop policy if exists "annual_goals_update" on public.annual_goals;
drop policy if exists "annual_goals_delete" on public.annual_goals;

create policy "annual_goals_insert" on public.annual_goals for insert to authenticated
  with check (
    auth.uid() = created_by
    and (department is null or public.is_exec() or public.leads_department(department))
  );

create policy "annual_goals_update" on public.annual_goals for update to authenticated
  using (department is null or public.is_exec() or public.leads_department(department))
  with check (department is null or public.is_exec() or public.leads_department(department));

create policy "annual_goals_delete" on public.annual_goals for delete to authenticated
  using (
    public.is_exec()
    or (department is null and auth.uid() = created_by)
    or (department is not null and public.leads_department(department))
  );
