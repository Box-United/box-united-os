import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Rock, RockStatus } from '../types/database'

// Rocks for one quarter (e.g. "Q3 2026"); pass userId to limit to one person.
export function useRocks(quarter: string, userId?: string) {
  const [rocks, setRocks] = useState<Rock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRocks()
  }, [quarter, userId])

  async function fetchRocks() {
    setLoading(true)
    let q = supabase.from('rocks').select('*').eq('quarter', quarter).order('created_at', { ascending: true })
    if (userId) q = q.eq('user_id', userId)
    const { data } = await q
    setRocks((data as Rock[]) ?? [])
    setLoading(false)
  }

  async function addRock(ownerId: string, title: string) {
    setError(null)
    const { data, error } = await supabase
      .from('rocks')
      .insert({ user_id: ownerId, title, status: 'on-track', quarter })
      .select('*')
      .single()
    if (error) setError(error.message.includes('Maximum 3') ? 'Each person can have up to 3 rocks per quarter.' : error.message)
    else if (data) setRocks(r => [...r, data as Rock])
  }

  async function updateRockStatus(id: string, status: RockStatus) {
    setRocks(r => r.map(rock => rock.id === id ? { ...rock, status } : rock))
    await supabase.from('rocks').update({ status }).eq('id', id)
  }

  async function deleteRock(id: string) {
    setRocks(r => r.filter(rock => rock.id !== id))
    await supabase.from('rocks').delete().eq('id', id)
  }

  return { rocks, loading, error, addRock, updateRockStatus, deleteRock, refetch: fetchRocks }
}
