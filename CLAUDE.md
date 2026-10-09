# Box United OS: notes for Claude

- The live site's Supabase project is `vjrbavvfjghxwbwozddl`. Migrations are run
  by hand in its SQL editor, and `supabase/functions/monday-sync/index.ts` is
  pasted into its Edge Functions.
- New migrations (`supabase/migrations/NNN_*.sql`) and edge function changes go
  to `main` as soon as they're written, so the team always finds them on GitHub.
  They don't run on their own, and pushes that only touch `supabase/` or
  Markdown don't redeploy the site.
- App changes (`src/`) publish when they reach `main` (GitHub Pages), so they go
  there only when the team asks for them to go live.
- Write migrations so the live app keeps working before and after they run, and
  so running one twice is safe. Say in the migration's header what to run after.
