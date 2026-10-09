import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { goalDataChanged } from '../lib/linkEvents'
import type { Department, Kpi, KpiArea } from '../types/database'
import { parentPatch } from '../lib/goalLinks'
import { currentQuarter } from '../lib/team'

// The quarter being looked at. Annual KPIs for its year show alongside that
// quarter's quarterly KPIs.
export interface KpiPeriod { year: number; q: number }

export function currentPeriod(): KpiPeriod {
  const { q, year } = currentQuarter()
  return { year, q }
}

// Before migration 016 KPIs have no year; treat them as this year's annual KPIs
const yearOf = (k: Kpi) => k.year ?? new Date().getFullYear()

export function inPeriod(k: Kpi, p: KpiPeriod) {
  return yearOf(k) === p.year && (k.quarter == null || k.quarter === p.q)
}

// Where a KPI counts: "Q2 2026" for a quarterly KPI, "2026" for an annual one
export function kpiPeriodLabel(k: Pick<Kpi, 'year' | 'quarter'>) {
  return k.quarter ? `Q${k.quarter} ${k.year}` : String(k.year)
}

// KPI areas + KPIs; pass userId to limit to one person. `kpis` is just the
// given period's (the current quarter unless you pass one, or null for all);
// `allKpis` has every period.
export function useKpis(userId?: string, period: KpiPeriod | null = currentPeriod()) {
  const [areas, setAreas] = useState<KpiArea[]>([])
  const [allKpis, setKpis] = useState<Kpi[]>([])
  const [py, pq] = [period?.year, period?.q]
  const kpis = useMemo(() => (py != null && pq != null ? allKpis.filter(k => inPeriod(k, { year: py, q: pq })) : allKpis), [allKpis, py, pq])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Rows back from a write; zero rows means the database refused it (e.g. no permission)
  function failed(res: { error: unknown; data: unknown[] | null }, msg = "Couldn't save. Check your connection and try again.") {
    if (res.error || !res.data?.length) {
      setError(res.error ? msg : "Couldn't save: you don't have permission to edit this.")
      return true
    }
    setError(null)
    goalDataChanged()
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
    const [beforeA, beforeK] = [areas, allKpis]
    setAreas(a => a.filter(x => x.id !== id))
    setKpis(k => k.filter(x => x.area_id !== id))
    if (failed(await supabase.from('kpi_areas').delete().eq('id', id).select('id'))) {
      setAreas(beforeA)
      setKpis(beforeK)
    }
  }

  // `parent` is the goal or rock it supports ("team_goal:<id>" / "goal:<id>" / "rock:<id>"), if any.
  // `when` is the year, plus the quarter for a KPI that resets every quarter.
  async function addKpi(area: KpiArea, title: string, target: number | null, when: { year: number; quarter: number | null }, parent = '') {
    const res = await supabase
      .from('kpis')
      .insert({
        area_id: area.id,
        user_id: area.user_id,
        title,
        target,
        current: target != null ? 0 : null,
        status: 'not-started',
        sort_order: allKpis.filter(k => k.area_id === area.id).length,
        year: when.year,
        quarter: when.quarter,
        // links only sent when chosen, so KPIs still save before migration 014
        ...(parent ? parentPatch(parent, true) : {}),
      })
      .select('*')
    if (!failed(res)) setKpis(k => [...k, res.data![0] as Kpi])
  }

  // Start a quarter from another quarter's KPIs (same KPIs and targets, counts at 0).
  // Used to fill in past quarters; the OS copies each quarter forward on its own.
  async function copyKpis(from: Kpi[], to: { year: number; quarter: number | null }) {
    const res = await supabase
      .from('kpis')
      .insert(from.map(k => ({
        area_id: k.area_id,
        user_id: k.user_id,
        title: k.title,
        target: k.target,
        current: k.target != null ? 0 : null,
        status: 'not-started',
        sort_order: k.sort_order,
        year: to.year,
        quarter: to.quarter,
      })))
      .select('*')
    if (!failed(res)) setKpis(k => [...k, ...(res.data as Kpi[])])
  }

  async function updateKpi(id: string, patch: Partial<Pick<Kpi, 'title' | 'target' | 'current' | 'status' | 'team_goal_id' | 'goal_id' | 'rock_id' | 'year' | 'quarter'>>, editorId: string) {
    const full = { ...patch, updated_by: editorId, updated_at: new Date().toISOString() }
    const before = allKpis
    setKpis(k => k.map(x => x.id === id ? { ...x, ...full } : x))
    if (failed(await supabase.from('kpis').update(full).eq('id', id).select('id'))) setKpis(before)
  }

  async function deleteKpi(id: string) {
    const before = allKpis
    setKpis(k => k.filter(x => x.id !== id))
    if (failed(await supabase.from('kpis').delete().eq('id', id).select('id'))) setKpis(before)
  }

  return { areas, kpis, allKpis, loading, error, clearError: () => setError(null), addArea, updateArea, deleteArea, addKpi, copyKpis, updateKpi, deleteKpi, refetch: fetchAll }
}
