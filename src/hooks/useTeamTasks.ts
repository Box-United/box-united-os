import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { RecurringTask, TeamTask } from '../types/database'
import { pushTaskToMonday, removeTaskFromMonday } from '../lib/mondaySync'
import { rollForward } from '../lib/rollForward'

export type NewTeamTask = Pick<TeamTask, 'title' | 'assigned_to' | 'due_date' | 'description' | 'kpi_id' | 'rock_id' | 'assigned_in_meeting'>
  & Partial<Pick<TeamTask, 'goal_id' | 'team_goal_id' | 'on_team_board' | 'department'>>

export type NewRecurringTask = Omit<RecurringTask, 'id' | 'made_count' | 'last_date' | 'created_at'>

// Before migration 018 tasks have no department and only take todo / in-progress / done
const LEGACY_STATUS: Record<string, string> = { 'not-started': 'todo', 'on-track': 'in-progress' }
function saveError(e: { code?: string; message: string }) {
  return e.code === '23514' || e.message.includes('department')
    ? 'Task departments and statuses need the latest database update (migration 018).'
    : e.message
}

export function useTeamTasks() {
  const [tasks, setTasks] = useState<TeamTask[]>([])
  // Repeating schedules, so tasks they made can say how they repeat
  const [recurring, setRecurring] = useState<RecurringTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const { data } = await supabase
      .from('team_tasks')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
    setTasks((data as TeamTask[]) ?? [])
    setLoading(false)
    // empty until migration 016
    const rules = await supabase.from('recurring_tasks').select('*')
    setRecurring((rules.data as RecurringTask[]) ?? [])
  }

  async function addTeamTask(task: NewTeamTask, createdBy: string) {
    setError(null)
    // Status starts at the column default (Not started)
    const { data, error } = await supabase
      .from('team_tasks')
      .insert({ ...task, created_by: createdBy })
      .select('*')
      .single()
    if (error) {
      setError(saveError(error))
      return false
    }
    setTasks(t => [...t, data as TeamTask])
    pushTaskToMonday((data as TeamTask).id)
    return true
  }

  async function updateTask(id: string, patch: Partial<TeamTask>) {
    setError(null)
    const before = tasks
    setTasks(t => t.map(task => task.id === id ? { ...task, ...patch } : task))
    const save = (p: Partial<TeamTask>) => supabase.from('team_tasks').update(p).eq('id', id).select('*')
    let { data, error } = await save(patch)
    if (error?.code === '23514' && patch.status && LEGACY_STATUS[patch.status]) {
      ({ data, error } = await save({ ...patch, status: LEGACY_STATUS[patch.status] as TeamTask['status'] }))
    }
    if (error || !data?.length) {
      setTasks(before)
      setError(error ? saveError(error) : "You can't edit this task. Only its creator, owner or the owner's manager can.")
      return
    }
    // pick up trigger-set fields (completed_at, archived_month)
    setTasks(t => t.map(task => task.id === id ? (data[0] as TeamTask) : task))
    pushTaskToMonday(id)
  }

  // A repeating task is renamed from here on: its schedule and every open one
  // (finished ones keep the name they were done under)
  async function renameTask(id: string, title: string) {
    const ruleId = tasks.find(t => t.id === id)?.recurring_id
    if (!ruleId) return updateTask(id, { title })
    setError(null)
    const before = tasks
    const ids = tasks.filter(t => t.recurring_id === ruleId && (t.status !== 'done' || t.id === id)).map(t => t.id)
    setTasks(t => t.map(task => ids.includes(task.id) ? { ...task, title } : task))
    const rule = await supabase.from('recurring_tasks').update({ title }).eq('id', ruleId).select('id')
    const renamed = await supabase.from('team_tasks').update({ title }).in('id', ids).select('id')
    if (rule.error || !rule.data?.length || renamed.error || !renamed.data?.length) {
      setTasks(before)
      setError("You can't rename this task. Only its creator, owner or the owner's manager can.")
      await fetchAll()
      return
    }
    setRecurring(r => r.map(x => x.id === ruleId ? { ...x, title } : x))
    for (const taskId of ids) pushTaskToMonday(taskId)
  }

  async function deleteTeamTask(id: string) {
    const before = tasks
    const mondayItemId = tasks.find(t => t.id === id)?.monday_item_id
    setTasks(t => t.filter(task => task.id !== id))
    const { data, error } = await supabase.from('team_tasks').delete().eq('id', id).select('id')
    if (error || !data?.length) {
      setTasks(before)
      setError("You can't delete this task. Only its creator, owner or the owner's manager can.")
    } else if (mondayItemId) {
      removeTaskFromMonday(mondayItemId)
    }
  }

  // Set up a repeating task; the OS makes the first one (and each one after) itself
  async function addRecurring(rule: NewRecurringTask) {
    setError(null)
    const { error } = await supabase.from('recurring_tasks').insert(rule)
    if (error) {
      const noTable = error.message.includes('recurring_tasks') && !error.message.includes('department')
      setError(noTable ? 'Repeating tasks need the latest database update (migration 016).' : saveError(error))
      return false
    }
    await rollForward()
    await fetchAll()
    return true
  }

  // Stop a repeating task: its open tasks go too; finished ones stay as a record
  async function deleteSeries(recurringId: string) {
    setError(null)
    const before = tasks
    const open = tasks.filter(t => t.recurring_id === recurringId && t.status !== 'done')
    setTasks(t => t.filter(task => !open.some(o => o.id === task.id)))
    const del = await supabase.from('team_tasks').delete().eq('recurring_id', recurringId).neq('status', 'done').select('id')
    const rule = await supabase.from('recurring_tasks').delete().eq('id', recurringId).select('id')
    if (del.error || rule.error || !rule.data?.length) {
      setTasks(before)
      setError("You can't stop this repeating task. Only its creator, owner or the owner's manager can.")
      await fetchAll()
      return
    }
    setRecurring(r => r.filter(x => x.id !== recurringId))
    for (const t of open) if (t.monday_item_id) removeTaskFromMonday(t.monday_item_id)
  }

  return { tasks, recurring, loading, error, setError, addTeamTask, addRecurring, updateTask, renameTask, deleteTeamTask, deleteSeries, refetch: fetchAll }
}
