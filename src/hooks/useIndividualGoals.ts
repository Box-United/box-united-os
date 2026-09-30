import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { IndividualGoal } from '../types/database'

// A person's own annual goals (separate from the team goals on the Scorecard).
export function useIndividualGoals(userId: string, year: number) {
  const [goals, setGoals] = useState<IndividualGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    fetchGoals()
  }, [userId, year])

  async function fetchGoals() {
    setLoading(true)
    const { data } = await supabase
      .from('individual_goals')
      .select('*')
      .eq('user_id', userId)
      .eq('year', year)
      .order('sort_order')
      .order('created_at')
    setGoals((data as IndividualGoal[]) ?? [])
    setLoading(false)
  }

  function failed(res: { error: unknown; data: unknown[] | null }) {
    if (res.error || !res.data?.length) {
      setError(res.error ? "Couldn't save. Check your connection and try again." : "Couldn't save: you don't have permission to edit these goals.")
      return true
    }
    setError(null)
    return false
  }

  async function addGoal(title: string) {
    const res = await supabase
      .from('individual_goals')
      .insert({ user_id: userId, year, title, status: 'not-started', sort_order: goals.length })
      .select('*')
    if (!failed(res)) setGoals(g => [...g, res.data![0] as IndividualGoal])
  }

  async function updateGoal(id: string, patch: Partial<Pick<IndividualGoal, 'title' | 'status'>>) {
    const before = goals
    setGoals(g => g.map(x => x.id === id ? { ...x, ...patch } : x))
    if (failed(await supabase.from('individual_goals').update(patch).eq('id', id).select('id'))) setGoals(before)
  }

  async function deleteGoal(id: string) {
    const before = goals
    setGoals(g => g.filter(x => x.id !== id))
    if (failed(await supabase.from('individual_goals').delete().eq('id', id).select('id'))) setGoals(before)
  }

  return { goals, loading, error, clearError: () => setError(null), addGoal, updateGoal, deleteGoal, refetch: fetchGoals }
}
