-- Dorothy Billings has left Box United, and Alexis Uribe takes over as Program
-- Manager. Run after 022.
--
-- Dorothy's account moves to alexis@boxunited.org and is renamed Alexis Uribe,
-- so Alexis gets everything on it: the 30/60/90 day plan, goals, rocks, KPIs,
-- tasks and repeating tasks, manager and departments. Nothing needs creating
-- first: when Alexis signs in with Google as alexis@boxunited.org, Supabase
-- joins that sign-in to this account.
--
-- Dorothy can't get in any more. Her Google sign-in is taken off the account,
-- every session on it is signed out, and her photo, "goes by" name and Google
-- details are cleared.
--
-- Any "Dorothy" in the OS (task titles and notes, notifications, check-ins
-- and so on) becomes "Alexis", "Dorothy Billings" becomes "Alexis Uribe", and
-- dorothy@boxunited.org becomes alexis@boxunited.org. A "Dorothy" followed by
-- another capitalised word, like a school named after someone, is left as it
-- is. Each change is listed in the results.
--
-- If Alexis has already signed in, there are two accounts and this stops
-- without changing anything. Check the new account's dashboard is empty, delete
-- it (Supabase → Authentication → Users → alexis@boxunited.org → Delete user),
-- then run this again.
--
-- Safe to run again: once the account has moved, it only renames any "Dorothy"
-- added since. Nothing to run after this.

do $$
declare
  acct  uuid := (select id from auth.users where lower(email) = 'dorothy@boxunited.org');
  taken uuid := (select id from auth.users where lower(email) = 'alexis@boxunited.org');
  -- %1$s is the text being renamed
  swap  constant text := $f$regexp_replace(regexp_replace(regexp_replace(%1$s,
            'dorothy@boxunited\.org', 'alexis@boxunited.org', 'gi'),
            'Dorothy Billings', 'Alexis Uribe', 'g'),
            '\mDorothy\M(?! [A-Z])', 'Alexis', 'g')$f$;
  col   record;
  val   text;
  n     integer;
begin
  -- ---------- move the account ----------
  if acct is not null and taken is not null then
    raise exception 'alexis@boxunited.org already has its own account, so nothing was changed. Delete that account (Authentication → Users), then run this again.';
  end if;

  if acct is not null then
    update auth.users
      set email = 'alexis@boxunited.org',
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          raw_user_meta_data = jsonb_build_object('full_name', 'Alexis Uribe'),
          raw_app_meta_data = coalesce(raw_app_meta_data, '{}') || '{"provider": "email", "providers": ["email"]}'
      where id = acct;

    -- Dorothy's Google sign-in goes. Alexis's Google sign-in is joined to the
    -- account through its email login, so that moves to Alexis's address.
    delete from auth.identities where user_id = acct and provider <> 'email';
    update auth.identities
      set identity_data = identity_data || jsonb_build_object('email', 'alexis@boxunited.org')
      where user_id = acct and provider = 'email';
    insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
    select acct::text, acct,
           jsonb_build_object('sub', acct::text, 'email', 'alexis@boxunited.org', 'email_verified', true, 'phone_verified', false),
           'email', now(), now()
    where not exists (select 1 from auth.identities where user_id = acct and provider = 'email');

    -- signed out everywhere
    delete from auth.refresh_tokens where user_id = acct::text;
    delete from auth.sessions where user_id = acct;

    update public.profiles
      set email = 'alexis@boxunited.org',
          full_name = 'Alexis Uribe',
          preferred_name = null,
          avatar_url = null
      where id = acct;

    raise notice 'Dorothy''s account is now Alexis Uribe''s, at alexis@boxunited.org';
  elsif taken is null then
    raise notice 'There''s no account for dorothy@ or alexis@boxunited.org, so there was no account to move. Once Alexis has one, run 019 and 021 to set it up.';
  end if;

  -- ---------- "Dorothy" anywhere in the OS becomes "Alexis" ----------
  for col in
    select c.table_name, c.column_name, c.data_type
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
      and c.data_type in ('text', 'character varying', 'jsonb')
      and c.is_generated = 'NEVER'
  loop
    val := format(swap, quote_ident(col.column_name) || '::text');
    execute format('update public.%I set %I = %s where %s is distinct from %I::text',
                   col.table_name, col.column_name,
                   case when col.data_type = 'jsonb' then val || '::jsonb' else val end,
                   val, col.column_name);
    get diagnostics n = row_count;
    if n > 0 then
      raise notice 'Renamed Dorothy to Alexis in % row(s) of %.%', n, col.table_name, col.column_name;
    end if;
  end loop;
end $$;
