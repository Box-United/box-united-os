-- Individual annual goals (per person, on their dashboard) and performance reviews.
--
-- Reviews: the person writes a self-review; their reviewer (their manager, or the
-- executive director) writes comments that stay hidden from the person until shared.
-- Visible only to the person, their manager and the executive director.

-- ============================================================
-- Individual annual goals
-- ============================================================
create table if not exists public.individual_goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  year        integer not null,
  title       text not null,
  status      text not null default 'not-started'
                check (status in ('not-started', 'in-progress', 'on-track', 'off-track', 'done')),
  sort_order  integer not null default 0,
  created_at  timestamptz default now()
);

alter table public.individual_goals enable row level security;
create policy "individual_goals_read"   on public.individual_goals for select to authenticated using (true);
create policy "individual_goals_insert" on public.individual_goals for insert to authenticated with check (public.can_edit(user_id));
create policy "individual_goals_update" on public.individual_goals for update to authenticated using (public.can_edit(user_id));
create policy "individual_goals_delete" on public.individual_goals for delete to authenticated using (public.can_edit(user_id));
create index if not exists individual_goals_user_year on public.individual_goals (user_id, year);

-- ============================================================
-- Who may review whom: the person's manager, or the executive director (not yourself)
-- ============================================================
create or replace function public.can_review(employee uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and auth.uid() <> employee and (
    exists (select 1 from public.profiles where id = employee and manager_id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'executive_director')
  );
$$;
revoke execute on function public.can_review(uuid) from public, anon;
grant  execute on function public.can_review(uuid) to authenticated;

-- ============================================================
-- Reviews (one per person per year per period)
-- ============================================================
create table if not exists public.performance_reviews (
  id                   uuid primary key default gen_random_uuid(),
  employee_id          uuid not null references public.profiles(id) on delete cascade,
  year                 integer not null,
  period               text not null check (period in ('mid_year', 'end_of_year')),
  reviewer_id          uuid references public.profiles(id) on delete set null,
  self_submitted_at    timestamptz,
  shared_at            timestamptz,
  employee_signed_at   timestamptz,
  reviewer_signed_at   timestamptz,
  snapshot             jsonb,   -- goals / KPIs / rocks as they stood when shared
  created_at           timestamptz default now(),
  unique (employee_id, year, period)
);

-- Self-review: written by the person
create table if not exists public.review_self (
  review_id   uuid primary key references public.performance_reviews(id) on delete cascade,
  answers     jsonb not null default '{}'::jsonb,   -- wins, challenges, growth, development, support
  items       jsonb not null default '{}'::jsonb,   -- { "<kind>:<id>": "comment" }
  updated_at  timestamptz default now()
);

-- Reviewer comments: hidden from the person until shared
create table if not exists public.review_manager (
  review_id   uuid primary key references public.performance_reviews(id) on delete cascade,
  answers     jsonb not null default '{}'::jsonb,   -- responses + overall summary
  items       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz default now()
);

alter table public.performance_reviews enable row level security;
alter table public.review_self         enable row level security;
alter table public.review_manager      enable row level security;

-- helpers keyed by review id
create or replace function public.review_employee(rid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select employee_id from public.performance_reviews where id = rid;
$$;

create or replace function public.review_is_locked(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select employee_signed_at is not null and reviewer_signed_at is not null
  from public.performance_reviews where id = rid;
$$;

create or replace function public.review_is_shared(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select shared_at is not null from public.performance_reviews where id = rid;
$$;

create or replace function public.review_self_submitted(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select self_submitted_at is not null from public.performance_reviews where id = rid;
$$;

revoke execute on function public.review_employee(uuid), public.review_is_locked(uuid),
  public.review_is_shared(uuid), public.review_self_submitted(uuid) from public, anon;
grant execute on function public.review_employee(uuid), public.review_is_locked(uuid),
  public.review_is_shared(uuid), public.review_self_submitted(uuid) to authenticated;

-- performance_reviews: the person, their reviewer(s)
create policy "reviews_read" on public.performance_reviews for select to authenticated
  using (auth.uid() = employee_id or public.can_review(employee_id));
create policy "reviews_insert" on public.performance_reviews for insert to authenticated
  with check (auth.uid() = employee_id or public.can_review(employee_id));
create policy "reviews_update" on public.performance_reviews for update to authenticated
  using (auth.uid() = employee_id or public.can_review(employee_id));

-- Status stamps can only move in the right order and by the right person
create or replace function public.guard_review_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_emp boolean := auth.uid() = new.employee_id;
  is_rev boolean := public.can_review(new.employee_id);
begin
  if auth.uid() is null then return new; end if;
  if old.employee_signed_at is not null and old.reviewer_signed_at is not null then
    raise exception 'This review is signed and locked';
  end if;
  if new.self_submitted_at is distinct from old.self_submitted_at and not is_emp then
    raise exception 'Only the person can submit their self-review';
  end if;
  if (new.shared_at is distinct from old.shared_at or new.snapshot is distinct from old.snapshot
      or new.reviewer_signed_at is distinct from old.reviewer_signed_at
      or new.reviewer_id is distinct from old.reviewer_id) and not is_rev then
    raise exception 'Only the reviewer can share or sign as reviewer';
  end if;
  if new.employee_signed_at is distinct from old.employee_signed_at then
    if not is_emp then raise exception 'Only the person can sign their own review'; end if;
    if new.shared_at is null then raise exception 'The review has to be shared before signing'; end if;
  end if;
  if new.reviewer_signed_at is distinct from old.reviewer_signed_at and new.shared_at is null then
    raise exception 'Share the review before signing';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_review_status() from public, anon, authenticated;

drop trigger if exists performance_reviews_guard on public.performance_reviews;
create trigger performance_reviews_guard
  before update on public.performance_reviews
  for each row execute procedure public.guard_review_status();

-- review_self: the person writes (until submitted or locked); reviewer reads once submitted
create policy "review_self_read" on public.review_self for select to authenticated
  using (auth.uid() = public.review_employee(review_id)
         or (public.can_review(public.review_employee(review_id)) and public.review_self_submitted(review_id)));
create policy "review_self_insert" on public.review_self for insert to authenticated
  with check (auth.uid() = public.review_employee(review_id));
create policy "review_self_update" on public.review_self for update to authenticated
  using (auth.uid() = public.review_employee(review_id) and not coalesce(public.review_is_locked(review_id), false));

-- review_manager: reviewer writes (until locked); the person reads only once shared
create policy "review_manager_read" on public.review_manager for select to authenticated
  using (public.can_review(public.review_employee(review_id))
         or (auth.uid() = public.review_employee(review_id) and public.review_is_shared(review_id)));
create policy "review_manager_insert" on public.review_manager for insert to authenticated
  with check (public.can_review(public.review_employee(review_id)));
create policy "review_manager_update" on public.review_manager for update to authenticated
  using (public.can_review(public.review_employee(review_id)) and not coalesce(public.review_is_locked(review_id), false));

create index if not exists performance_reviews_emp on public.performance_reviews (employee_id, year);
