import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Kpi, KpiArea } from '../types/database'

// KPI areas + KPIs; pass userId to limit to one person.
export function useKpis(userId?: string) {
  const [areas, setAreas] = useState<KpiArea[]>([])
  const [kpis, setKpis] = useState<Kpi[]>([])
  const [loading, setLoading] = useState(true)

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

  async function addArea(ownerId: string, name: string, mondayUrl: string | null) {
    const { data } = await supabase
      .from('kpi_areas')
      .insert({ user_id: ownerId, name, monday_url: mondayUrl, sort_order: areas.length })
      .select('*')
      .single()
    if (data) setAreas(a => [...a, data as KpiArea])
  }

  async function updateArea(id: string, patch: Partial<Pick<KpiArea, 'name' | 'monday_url'>>) {
    setAreas(a => a.map(x => x.id === id ? { ...x, ...patch } : x))
    await supabase.from('kpi_areas').update(patch).eq('id', id)
  }

  async function deleteArea(id: string) {
    setAreas(a => a.filter(x => x.id !== id))
    setKpis(k => k.filter(x => x.area_id !== id))
    await supabase.from('kpi_areas').delete().eq('id', id)
  }

  async function addKpi(area: KpiArea, title: string, target: number | null) {
    const { data } = await supabase
      .from('kpis')
      .insert({
        area_id: area.id,
        user_id: area.user_id,
        title,
        target,
        current: target != null ? 0 : null,
        status: 'on-track',
        sort_order: kpis.filter(k => k.area_id === area.id).length,
      })
      .select('*')
      .single()
    if (data) setKpis(k => [...k, data as Kpi])
  }

  async function updateKpi(id: string, patch: Partial<Pick<Kpi, 'title' | 'target' | 'current' | 'status'>>, editorId: string) {
    const full = { ...patch, updated_by: editorId, updated_at: new Date().toISOString() }
    setKpis(k => k.map(x => x.id === id ? { ...x, ...full } : x))
    await supabase.from('kpis').update(full).eq('id', id)
  }

  async function deleteKpi(id: string) {
    setKpis(k => k.filter(x => x.id !== id))
    await supabase.from('kpis').delete().eq('id', id)
  }

  return { areas, kpis, loading, addArea, updateArea, deleteArea, addKpi, updateKpi, deleteKpi, refetch: fetchAll }
}
