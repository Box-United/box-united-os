import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Department, KeyMetric, MetricUnit } from '../types/database'
import { BUILT_IN_METRICS } from '../config/metrics'

const fetchDefs = () => supabase.from('key_metrics').select('*').order('sort_order').order('created_at')

// The list of key metrics (what's tracked), not their values
export function useKeyMetrics() {
  const [defs, setDefs] = useState<KeyMetric[]>(BUILT_IN_METRICS)
  // false until migration 010 adds the table
  const [editable, setEditable] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDefs().then(({ data, error }) => {
      if (error) return
      setDefs((data as KeyMetric[]) ?? [])
      setEditable(true)
    })
  }, [])

  async function addMetric(label: string, department: Department, unit: MetricUnit) {
    setError(null)
    const { data, error } = await supabase
      .from('key_metrics')
      .insert({ label, department, unit, sort_order: defs.length })
      .select('*')
    if (error || !data?.length) {
      setError(error?.code === '42501' || !data?.length
        ? "Couldn't add it: only the department's lead or the executive director can add its key metrics."
        : "Couldn't add the metric. Check your connection and try again.")
      return false
    }
    setDefs(d => [...d, data[0] as KeyMetric])
    return true
  }

  async function removeMetric(key: string) {
    const before = defs
    setDefs(d => d.filter(m => m.key !== key))
    const { data, error } = await supabase.from('key_metrics').delete().eq('key', key).select('key')
    if (error || !data?.length) {
      setDefs(before)
      setError("Couldn't remove it: only the department's lead or the executive director can.")
    }
  }

  return { defs, editable, error, addMetric, removeMetric }
}
