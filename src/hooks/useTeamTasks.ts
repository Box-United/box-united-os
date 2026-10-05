import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TeamTask } from '../types/database'
import { pushTaskToMonday, removeTaskFromMonday } from '../lib/mondaySync'

export type NewTeamTask = Pick<TeamTask, 'title' | 'assigned_to' | 'due_date' | 'description' | 'kpi_id' | 'rock_id' | 'assigned_in_meeting'>
  & Partial<Pick<TeamTask, 'goal_id' | 'team_goal_id' | 'on_team_board'>>

export function useTeamTasks() {
  const [tasks, setTasks] = useState<TeamTask[]>([])
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

  // Move every completed, not-yet-archived task into the month it was completed.
  async function archiveCompleted() {
    const done = tasks.filter(t => t.status === 'done' && !t.archived_month)
    for (const t of done) {
      const month = (t.completed_at ?? new Date().toISOString()).slice(0, 7)
      await supabase.from('team_tasks').update({ archived_month: month }).eq('id', t.id)
    }
    await fetchAll()
    return done.length
  }

  return { tasks, loading, error, setError, addTeamTask, updateTask, deleteTeamTask, archiveCompleted, refetch: fetchAll }
}
