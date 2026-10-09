import { supabase } from './supabase'
import { pushTasksToMonday } from './mondaySync'

interface Rolled { kpis_copied: number; moved_tasks: string[]; new_tasks: string[] }

// Copies KPIs whose quarter (or year) has ended into the next one, and makes any
// recurring tasks that have come due (public.roll_forward, migration 016). Safe
// to run any number of times. Moved and new tasks are then mirrored onto Monday.
// Returns the new tasks' ids.
export async function rollForward(): Promise<string[]> {
  const { data, error } = await supabase.rpc('roll_forward')
  if (error || !data) return []
  const r = data as Rolled
  const ids = [...(r.moved_tasks ?? []), ...(r.new_tasks ?? [])]
  if (ids.length || r.kpis_copied) void pushTasksToMonday(ids, r.kpis_copied > 0)
  return r.new_tasks ?? []
}
