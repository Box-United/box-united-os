import type { Department, MetricKey } from '../types/database'

// The team's key metrics. `department` decides whose Scorecard each one shows on
// (the full set is always on the Team Board).
export interface MetricConfig {
  label: string
  department: Department
  format: (v: number) => string
}

export const METRIC_CONFIG: Record<MetricKey, MetricConfig> = {
  schools: { label: 'Schools', department: 'program', format: v => v.toLocaleString() },
  dollars_raised: {
    label: 'Raised',
    department: 'development',
    format: v => v >= 10000 ? '$' + Math.round(v / 1000).toLocaleString() + 'K' : '$' + v.toLocaleString(),
  },
  students: { label: 'Girls served', department: 'program', format: v => v.toLocaleString() },
}

export const METRIC_ORDER: MetricKey[] = ['schools', 'dollars_raised', 'students']
