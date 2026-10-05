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

// Mirror a task added or changed in the OS onto its owner's Monday board (if connected)
export function pushTaskToMonday(taskId: string) {
  supabase.functions.invoke('monday-sync', { body: { action: 'push_task', task_id: taskId } }).catch(() => null)
}

// A deleted task's Monday item gets archived
export function removeTaskFromMonday(mondayItemId: string) {
  supabase.functions.invoke('monday-sync', { body: { action: 'remove_task', monday_item_id: mondayItemId } }).catch(() => null)
}
