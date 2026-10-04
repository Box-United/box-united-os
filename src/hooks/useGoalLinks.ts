import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { currentQuarter, quarterLabel } from '../lib/team'
import type { AnnualGoal, IndividualGoal, Kpi, Rock } from '../types/database'

export interface SupportOptions {
  teamGoals: Pick<AnnualGoal, 'id' | 'title'>[]
  goals: Pick<IndividualGoal, 'id' | 'title'>[]
  rocks: Pick<Rock, 'id' | 'title' | 'quarter'>[]
  label: (value: string) => string | null
}

// What a person's rocks and KPIs can support: this year's team goals, their own
// goals for the year, and (for KPIs) their rocks this quarter.
export function useSupportOptions(ownerId: string): SupportOptions {
  const [teamGoals, setTeamGoals] = useState<SupportOptions['teamGoals']>([])
  const [goals, setGoals] = useState<SupportOptions['goals']>([])
  const [rocks, setRocks] = useState<SupportOptions['rocks']>([])

  useEffect(() => {
    if (!ownerId) return
    const { q, year } = currentQuarter()
    Promise.all([
      supabase.from('annual_goals').select('id, title').eq('year', year).order('created_at'),
      supabase.from('individual_goals').select('id, title').eq('user_id', ownerId).eq('year', year).order('sort_order'),
      supabase.from('rocks').select('id, title, quarter').eq('user_id', ownerId).eq('quarter', quarterLabel(q, year)).order('created_at'),
    ]).then(([t, g, r]) => {
      setTeamGoals(t.data ?? [])
      setGoals(g.data ?? [])
      setRocks(r.data ?? [])
    })
  }, [ownerId])

  function label(value: string) {
    const [kind, id] = value.split(':')
    const list = kind === 'team_goal' ? teamGoals : kind === 'goal' ? goals : kind === 'rock' ? rocks : []
    return list.find(x => x.id === id)?.title ?? null
  }

  return { teamGoals, goals, rocks, label }
}

export interface GoalChildren {
  rocks: Rock[]
  kpis: Kpi[]
}

// Rocks and KPIs that sit under the given goals (KPIs under those rocks too).
// `kind` is which goal table the ids belong to. Empty until migration 014.
export function useGoalChildren(kind: 'team' | 'personal', goalIds: string[], refreshKey = 0) {
  const field = kind === 'team' ? 'team_goal_id' : 'goal_id'
  const key = [...goalIds].sort().join(',')
  const [children, setChildren] = useState<GoalChildren>({ rocks: [], kpis: [] })

  useEffect(() => {
    const ids = key ? key.split(',') : []
    async function load() {
      if (!ids.length) {
        setChildren({ rocks: [], kpis: [] })
        return
      }
      const [r, k] = await Promise.all([
        supabase.from('rocks').select('*').in(field, ids).order('quarter').order('created_at'),
        supabase.from('kpis').select('*').in(field, ids).order('created_at'),
      ])
      const rocks = (r.data as Rock[]) ?? []
      let kpis = (k.data as Kpi[]) ?? []
      if (rocks.length) {
        const viaRock = await supabase.from('kpis').select('*').in('rock_id', rocks.map(x => x.id)).order('created_at')
        kpis = [...kpis, ...((viaRock.data as Kpi[]) ?? [])]
      }
      setChildren({ rocks, kpis })
    }
    void load()
  }, [field, key, refreshKey])

  // Everything under one goal: its rocks, its own KPIs, and the KPIs under those rocks
  function under(goalId: string) {
    const rocks = children.rocks.filter(r => r[field] === goalId)
    const rockIds = new Set(rocks.map(r => r.id))
    const kpis = children.kpis.filter(k => k[field] === goalId || (k.rock_id && rockIds.has(k.rock_id)))
    return { rocks, kpis }
  }

  return { ...children, under }
}
