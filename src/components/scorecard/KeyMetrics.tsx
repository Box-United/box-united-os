import { useState, useRef, type ReactNode } from 'react'
import { useScorecardMetrics } from '../../hooks/useScorecardMetrics'
import type { MetricHistory } from '../../types/database'
import type { MetricKey, ScorecardMetric } from '../../hooks/useScorecardMetrics'
import { METRIC_CONFIG } from '../../config/metrics'
import { useTeam, firstName, shortDate } from '../../lib/team'
import { SectionLabel, ProgressBar } from '../layout/PageShell'
import { DeptTag } from '../ui/DeptTag'

// ---------- metric tile ----------

interface MetricCardProps {
  metricKey: MetricKey
  metric: ScorecardMetric | undefined
  history: MetricHistory[]
  onUpdate: (key: MetricKey, field: 'actual' | 'target', value: number | null) => void
}

function MetricCard({ metricKey, metric, history, onUpdate }: MetricCardProps) {
  const { byId } = useTeam()
  const [editingField, setEditingField] = useState<'actual' | 'target' | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const config = METRIC_CONFIG[metricKey]

  const actual = metric?.actual ?? 0
  const target = metric?.target ?? 0
  const pct = target > 0 ? (actual / target) * 100 : 0
  const actuals = history.filter(h => h.actual != null)
  const last3 = actuals.slice(-3)
  const sparkMax = Math.max(...last3.map(h => h.actual!), 1)

  function startEdit(field: 'actual' | 'target') {
    setEditingField(field)
    const val = field === 'actual' ? metric?.actual : metric?.target
    setEditValue(val != null ? String(val) : '')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function commitEdit() {
    if (editingField === null) return
    const trimmed = editValue.trim().replace(/[,$]/g, '')
    const num = trimmed === '' ? null : parseFloat(trimmed)
    if (trimmed !== '' && (isNaN(num!) || num! < 0)) {
      setEditingField(null)
      return
    }
    const current = editingField === 'actual' ? metric?.actual : metric?.target
    if (num !== (current ?? null)) onUpdate(metricKey, editingField, num)
    setEditingField(null)
  }

  const input = (big: boolean) => (
    <input
      ref={inputRef}
      type="number"
      min="0"
      value={editValue}
      onChange={e => setEditValue(e.target.value)}
      onBlur={commitEdit}
      onKeyDown={e => {
        if (e.key === 'Enter') commitEdit()
        if (e.key === 'Escape') setEditingField(null)
      }}
      className={big ? 'text-3xl font-bold border-b-2 outline-none w-full bg-transparent' : 'text-xs border-b outline-none w-24 bg-transparent'}
      style={{ borderColor: '#2563EB', color: big ? '#0B1E39' : '#2563EB', fontFamily: big ? 'Archivo, sans-serif' : undefined }}
    />
  )

  return (
    <div className="card p-5 min-w-0 flex flex-col">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500">{config.label}</span>
        <span className="ml-auto"><DeptTag dept={config.department} /></span>
      </div>

      <div className="flex items-end gap-3 mt-2">
        <div className="flex-1 min-w-0">
          {editingField === 'actual' ? input(true) : (
            <button onClick={() => startEdit('actual')} title="Click to edit"
              className="text-3xl font-bold text-left hover:opacity-70 cursor-text tabular-nums"
              style={{ color: '#0B1E39', fontFamily: 'Archivo, sans-serif' }}>
              {config.format(actual)}
            </button>
          )}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-gray-400">of</span>
            {editingField === 'target' ? input(false) : (
              <button onClick={() => startEdit('target')} title="Click to set target"
                className="text-xs font-medium hover:opacity-70 cursor-text" style={{ color: '#2563EB' }}>
                {target > 0 ? config.format(target) : 'set target'}
              </button>
            )}
            <span className="text-xs text-gray-400">target</span>
          </div>
        </div>

        {/* last 3 values */}
        {last3.length > 1 && (
          <div className="flex items-end gap-1 h-9" aria-label={`Last ${last3.length} values`}>
            {last3.map((h, i) => (
              <div key={h.id} title={`${config.format(h.actual!)} · ${shortDate(h.edited_at)}`}
                className="w-2.5 rounded-sm"
                style={{ height: `${Math.max(12, (h.actual! / sparkMax) * 100)}%`, background: i === last3.length - 1 ? '#2563EB' : '#bfdbfe' }} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-4"><ProgressBar pct={pct} tone={pct >= 100 ? 'green' : 'blue'} /></div>

      <div className="flex items-center justify-between mt-2 text-[11px] text-gray-400">
        <span>
          {metric?.updated_by
            ? `Updated by ${firstName(byId(metric.updated_by))} · ${shortDate(metric.updated_at)}`
            : 'Not updated yet'}
        </span>
        {actuals.length > 0 && (
          <button onClick={() => setShowHistory(v => !v)} className="font-semibold text-blue-600 hover:underline">
            {showHistory ? 'Hide history' : 'History'}
          </button>
        )}
      </div>

      {showHistory && (
        <ul className="mt-3 border-t border-gray-100 pt-2 space-y-1 max-h-40 overflow-y-auto">
          {[...history].reverse().map(h => (
            <li key={h.id} className="flex text-xs text-gray-600 gap-2">
              <span className="tabular-nums font-semibold">{h.actual != null ? config.format(h.actual) : '—'}</span>
              <span className="text-gray-400">/ {h.target != null ? config.format(h.target) : '—'}</span>
              <span className="ml-auto text-gray-400">{firstName(byId(h.edited_by))} · {shortDate(h.edited_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------- section ----------

interface Props {
  year: number
  keys: MetricKey[]
  title?: string
  empty?: ReactNode
  controls?: ReactNode
}

export function KeyMetrics({ year, keys, title = `Key metrics · ${year}`, empty, controls }: Props) {
  const { me } = useTeam()
  const { metrics, loading, error, updateMetric, historyFor } = useScorecardMetrics(year, me.id)

  return (
    <section>
      <SectionLabel right={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="text-[11px] text-gray-400">click a number to edit · updated together at the first Monday meeting each month</span>
          {controls}
        </div>
      }>
        {title}
      </SectionLabel>
      {error && <p role="alert" className="text-xs text-red-600 mb-2">{error}</p>}
      {keys.length === 0 ? (
        <div className="card p-5 text-sm text-gray-500">{empty}</div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{keys.map(k => <div key={k} className="card h-44 animate-pulse" />)}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {keys.map(key => (
            <MetricCard key={key} metricKey={key} metric={metrics.find(m => m.metric_key === key)} history={historyFor(key)} onUpdate={updateMetric} />
          ))}
        </div>
      )}
    </section>
  )
}
