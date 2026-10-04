-- Rocks are no longer capped at 3 per person per quarter. The aim is to stay
-- under 6; the app shows a nudge past that instead of blocking.

drop trigger if exists enforce_max_rocks on public.rocks;
drop function if exists public.check_max_rocks();
