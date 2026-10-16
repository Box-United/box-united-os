-- Claire moves from Finance to Marketing. Run after 019.
--
-- Her departments go from development, finance, accounting to development,
-- marketing, accounting, so her Scorecard and dashboard show marketing key
-- metrics and team goals instead of finance ones. Her own KPIs, goals and
-- tasks are unchanged. Any other departments she has are kept, and it is safe
-- to run again.

update public.profiles
  set departments = case
        when 'marketing' = any(departments) then array_remove(departments, 'finance')
        when 'finance' = any(departments) then array_replace(departments, 'finance', 'marketing')
        else departments || '{marketing}'
      end
  where lower(email) = 'claire@boxunited.org';
