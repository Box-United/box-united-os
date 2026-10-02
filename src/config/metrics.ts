import type { KeyMetric, MetricUnit } from '../types/database'

// Used until migration 010 adds the key_metrics table
export const BUILT_IN_METRICS: KeyMetric[] = [
  { key: 'schools', label: 'Schools', department: 'program', unit: 'number', sort_order: 0, created_by: null, created_at: '' },
  { key: 'dollars_raised', label: 'Raised', department: 'development', unit: 'currency', sort_order: 1, created_by: null, created_at: '' },
  { key: 'students', label: 'Girls served', department: 'program', unit: 'number', sort_order: 2, created_by: null, created_at: '' },
]

export const UNITS: { id: MetricUnit; label: string }[] = [
  { id: 'number', label: 'Number' },
  { id: 'currency', label: 'Dollars' },
  { id: 'percent', label: 'Percent' },
]

// Drop trailing zeros: 1.50 → "1.5", 2.00 → "2"
const trim = (n: number, digits: number) => String(Number(n.toFixed(digits)))

// $950 · $12K · $312K · $1M · $1.25M
function money(v: number) {
  const a = Math.abs(v)
  if (a >= 1_000_000) return '$' + trim(v / 1_000_000, 2) + 'M'
  if (a >= 10_000) return '$' + trim(v / 1000, 1) + 'K'
  return '$' + v.toLocaleString()
}

export function formatMetric(unit: MetricUnit, v: number) {
  if (unit === 'currency') return money(v)
  if (unit === 'percent') return trim(v, 1) + '%'
  if (Math.abs(v) >= 1_000_000) return trim(v / 1_000_000, 2) + 'M'
  return v.toLocaleString()
}
