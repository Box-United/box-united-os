import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { requestMondaySync } from '../lib/mondaySync'
import type { Rock, RockStatus } from '../types/database'
import { parentPatch } from '../lib/goalLinks'

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

  // `parent` is the goal it supports ("team_goal:<id>" / "goal:<id>"), if any
  async function addRock(ownerId: string, title: string, parent = '') {
    setError(null)
    const { data, error } = await supabase
      .from('rocks')
      // links only sent when chosen, so rocks still save before migration 014
      .insert({ user_id: ownerId, title, status: 'on-track', quarter, ...(parent ? parentPatch(parent, false) : {}) })
      .select('*')
      .single()
    if (error) setError(error.message.includes('Maximum 3') ? 'The database still limits rocks to 3 a quarter. Run migration 012 to lift it.' : error.message)
    else if (data) {
      setRocks(r => [...r, data as Rock])
      requestMondaySync()
    }
  }

  const updateRockStatus = (id: string, status: RockStatus) => updateRock(id, { status })
  const setRockGoal = (id: string, parent: string) => updateRock(id, parentPatch(parent, false))

  async function updateRock(id: string, patch: Partial<Pick<Rock, 'status' | 'team_goal_id' | 'goal_id'>>) {
    const before = rocks
    setRocks(r => r.map(rock => rock.id === id ? { ...rock, ...patch } : rock))
    const res = await supabase.from('rocks').update(patch).eq('id', id).select('id')
    if (res.error || !res.data?.length) {
      setRocks(before)
      setError(res.error ? "Couldn't save. Check your connection and try again." : "Couldn't save: you don't have permission to edit this rock.")
    } else {
      setError(null)
      requestMondaySync()
    }
  }

  async function deleteRock(id: string) {
    const before = rocks
    setRocks(r => r.filter(rock => rock.id !== id))
    const res = await supabase.from('rocks').delete().eq('id', id).select('id')
    if (res.error || !res.data?.length) {
      setRocks(before)
      setError(res.error ? "Couldn't delete. Check your connection and try again." : "Couldn't delete: you don't have permission to edit this rock.")
    } else {
      setError(null)
      requestMondaySync()
    }
  }

  return { rocks, loading, error, addRock, updateRockStatus, setRockGoal, deleteRock, refetch: fetchRocks }
}
