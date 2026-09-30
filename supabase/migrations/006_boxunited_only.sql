-- Only @boxunited.org accounts can exist. Blocks sign-up (and email changes) for any
-- other address, so an outside Google account can't get in and read team data.

create or replace function public.enforce_boxunited_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is null or lower(new.email) not like '%@boxunited.org' then
    raise exception 'Only @boxunited.org accounts can sign in to Box United OS'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_boxunited_email() from public, anon, authenticated;

drop trigger if exists enforce_boxunited_email on auth.users;
create trigger enforce_boxunited_email
  before insert or update of email on auth.users
  for each row execute procedure public.enforce_boxunited_email();
