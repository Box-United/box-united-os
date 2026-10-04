import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { requestMondaySync } from '../lib/mondaySync'
import type { Department, Kpi, KpiArea } from '../types/database'
import { parentPatch } from '../lib/goalLinks'

// KPI areas + KPIs; pass userId to limit to one person.
export function useKpis(userId?: string) {
  const [areas, setAreas] = useState<KpiArea[]>([])
  const [kpis, setKpis] = useState<Kpi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Rows back from a write; zero rows means the database refused it (e.g. no permission)
  function failed(res: { error: unknown; data: unknown[] | null }, msg = "Couldn't save. Check your connection and try again.") {
    if (res.error || !res.data?.length) {
      setError(res.error ? msg : "Couldn't save: you don't have permission to edit this.")
      return true
    }
    setError(null)
    requestMondaySync()
    return false
  }

  useEffect(() => {
    fetchAll()
  }, [userId])

  async function fetchAll() {
    setLoading(true)
    let a = supabase.from('kpi_areas').select('*').order('sort_order').order('created_at')
    let k = supabase.from('kpis').select('*').order('sort_order').order('created_at')
    if (userId) {
      a = a.eq('user_id', userId)
      k = k.eq('user_id', userId)
    }
    const [areasRes, kpisRes] = await Promise.all([a, k])
    setAreas((areasRes.data as KpiArea[]) ?? [])
    setKpis((kpisRes.data as Kpi[]) ?? [])
    setLoading(false)
  }

  async function addArea(ownerId: string, name: string, mondayUrl: string | null, department: Department | null = null) {
    const res = await supabase
      .from('kpi_areas')
      // department only sent when tagged, so untagged areas still save before migration 008
      .insert({ user_id: ownerId, name, monday_url: mondayUrl, sort_order: areas.length, ...(department ? { department } : {}) })
      .select('*')
    if (failed(res)) return null
    const area = res.data![0] as KpiArea
    setAreas(a => [...a, area])
    return area
  }

  async function updateArea(id: string, patch: Partial<Pick<KpiArea, 'name' | 'monday_url' | 'department'>>) {
    const before = areas
    setAreas(a => a.map(x => x.id === id ? { ...x, ...patch } : x))
    if (failed(await supabase.from('kpi_areas').update(patch).eq('id', id).select('id'))) setAreas(before)
  }

  async function deleteArea(id: string) {
    const [beforeA, beforeK] = [areas, kpis]
    setAreas(a => a.filter(x => x.id !== id))
    setKpis(k => k.filter(x => x.area_id !== id))
    if (failed(await supabase.from('kpi_areas').delete().eq('id', id).select('id'))) {
      setAreas(beforeA)
      setKpis(beforeK)
    }
  }

  // `parent` is the goal or rock it supports ("team_goal:<id>" / "goal:<id>" / "rock:<id>"), if any
  async function addKpi(area: KpiArea, title: string, target: number | null, parent = '') {
    const res = await supabase
      .from('kpis')
      .insert({
        area_id: area.id,
        user_id: area.user_id,
        title,
        target,
        current: target != null ? 0 : null,
        status: 'on-track',
        sort_order: kpis.filter(k => k.area_id === area.id).length,
        // links only sent when chosen, so KPIs still save before migration 014
        ...(parent ? parentPatch(parent, true) : {}),
      })
      .select('*')
    if (!failed(res)) setKpis(k => [...k, res.data![0] as Kpi])
  }

  async function updateKpi(id: string, patch: Partial<Pick<Kpi, 'title' | 'target' | 'current' | 'status' | 'team_goal_id' | 'goal_id' | 'rock_id'>>, editorId: string) {
    const full = { ...patch, updated_by: editorId, updated_at: new Date().toISOString() }
    const before = kpis
    setKpis(k => k.map(x => x.id === id ? { ...x, ...full } : x))
    if (failed(await supabase.from('kpis').update(full).eq('id', id).select('id'))) setKpis(before)
  }

  async function deleteKpi(id: string) {
    const before = kpis
    setKpis(k => k.filter(x => x.id !== id))
    if (failed(await supabase.from('kpis').delete().eq('id', id).select('id'))) setKpis(before)
  }

  return { areas, kpis, loading, error, clearError: () => setError(null), addArea, updateArea, deleteArea, addKpi, updateKpi, deleteKpi, refetch: fetchAll }
}
