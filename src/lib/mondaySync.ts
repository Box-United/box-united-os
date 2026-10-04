import { supabase } from './supabase'

let timer: number | undefined

// Ask the monday-sync function to refresh the shared Rocks, KPIs & Goals board.
// Called after rocks, KPIs or goals change; batched so a burst of edits is one sync.
// Failures are ignored: Monday is a mirror, the OS stays the source of truth.
export function requestMondaySync() {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    supabase.functions.invoke('monday-sync', { body: { action: 'sync_os' } }).catch(() => null)
  }, 3000)
}
