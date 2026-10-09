import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { RecurringTask, TeamTask } from '../types/database'
import { pushTaskToMonday, removeTaskFromMonday } from '../lib/mondaySync'
import { rollForward } from '../lib/rollForward'

export type NewTeamTask = Pick<TeamTask, 'title' | 'assigned_to' | 'due_date' | 'description' | 'kpi_id' | 'rock_id' | 'assigned_in_meeting'>
  & Partial<Pick<TeamTask, 'goal_id' | 'team_goal_id' | 'on_team_board'>>

export type NewRecurringTask = Omit<RecurringTask, 'id' | 'made_count' | 'last_date' | 'created_at'>

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
    const { data, error } = await supabase
      .from('team_tasks')
      .insert({ ...task, created_by: createdBy, status: 'todo' })
      .select('*')
      .single()
    if (error) {
      setError(error.message)
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
    const { data, error } = await supabase.from('team_tasks').update(patch).eq('id', id).select('*')
    if (error || !data?.length) {
      setTasks(before)
      setError(error?.message ?? "You can't edit this task. Only its creator, owner or the owner's manager can.")
      return
    }
    // pick up trigger-set fields (completed_at, archived_month)
    setTasks(t => t.map(task => task.id === id ? (data[0] as TeamTask) : task))
    pushTaskToMonday(id)
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
      setError(error.message.includes('recurring_tasks') ? 'Repeating tasks need the latest database update (migration 016).' : error.message)
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

  return { tasks, recurring, loading, error, setError, addTeamTask, addRecurring, updateTask, deleteTeamTask, deleteSeries, refetch: fetchAll }
}
