import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { goalDataChanged } from '../lib/linkEvents'
import type { AnnualGoal, Department, GoalStatus } from '../types/database'

export function useAnnualGoals(year: number, loggedInUserId: string) {
  const [goals, setGoals] = useState<AnnualGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function failed(res: { error: unknown; data: unknown[] | null }) {
    if (res.error || !res.data?.length) {
      setError(res.error ? "Couldn't save. Check your connection and try again." : "Couldn't save: you don't have permission to edit this goal.")
      return true
    }
    setError(null)
    goalDataChanged()
    return false
  }

  useEffect(() => {
    fetchGoals()
  }, [year])

  async function fetchGoals() {
    setLoading(true)
    const { data } = await supabase
      .from('annual_goals')
      .select('*, owner:profiles!owner_id(*), creator:profiles!created_by(*)')
      .eq('year', year)
      .order('created_at', { ascending: true })
    setGoals((data as AnnualGoal[]) ?? [])
    setLoading(false)
  }

  async function addGoal(title: string, description?: string, ownerId?: string, department?: Department | null) {
    const { data, error } = await supabase
      .from('annual_goals')
      .insert({
        title,
        description: description ?? null,
        status: 'not-started' as GoalStatus,
        year,
        owner_id: ownerId ?? null,
        created_by: loggedInUserId,
        // only sent when tagged, so untagged goals still save before migration 008
        ...(department ? { department } : {}),
      })
      .select('*, owner:profiles!owner_id(*), creator:profiles!created_by(*)')
      .single()
    if (error || !data) {
      setError("Couldn't save the goal. Check your connection and try again.")
      return null
    }
    setError(null)
    goalDataChanged()
    setGoals(g => [...g, data as AnnualGoal])
    return data as AnnualGoal
  }

  async function updateGoalStatus(id: string, status: GoalStatus) {
    const before = goals
    setGoals(g => g.map(goal => goal.id === id ? { ...goal, status } : goal))
    if (failed(await supabase.from('annual_goals').update({ status }).eq('id', id).select('id'))) setGoals(before)
  }

  async function updateGoal(id: string, updates: { title?: string; description?: string | null; owner_id?: string | null; department?: Department | null; metric_key?: string | null }) {
    const before = goals
    setGoals(g => g.map(goal => goal.id === id ? { ...goal, ...updates } : goal))
    if (failed(await supabase.from('annual_goals').update(updates).eq('id', id).select('id'))) setGoals(before)
  }

  async function deleteGoal(id: string) {
    const before = goals
    setGoals(g => g.filter(goal => goal.id !== id))
    if (failed(await supabase.from('annual_goals').delete().eq('id', id).select('id'))) setGoals(before)
  }

  return { goals, loading, error, addGoal, updateGoalStatus, updateGoal, deleteGoal, refetch: fetchGoals }
}
