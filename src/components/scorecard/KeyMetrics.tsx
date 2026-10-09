import { useEffect, useState, useRef, type ReactNode } from 'react'
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useGoalChildren } from '../../hooks/useGoalLinks'
import { useGoalDataVersion } from '../../lib/linkEvents'
import { useScorecardMetrics } from '../../hooks/useScorecardMetrics'
import { useKeyMetrics } from '../../hooks/useKeyMetrics'
import type { AnnualGoal, Department, KeyMetric, MetricHistory, MetricUnit } from '../../types/database'
import type { MetricKey, ScorecardMetric } from '../../hooks/useScorecardMetrics'
import { UNITS, formatMetric } from '../../config/metrics'
import { useTeam, firstName, shortDate } from '../../lib/team'
import { DEPARTMENTS, leadsOf } from '../../lib/departments'
import { SectionLabel, ProgressBar } from '../layout/PageShell'
import { DeptTag } from '../ui/DeptTag'
import { StatusPill } from '../ui/StatusPill'

// ---------- metric tile ----------

interface MetricCardProps {
  def: KeyMetric
  metric: ScorecardMetric | undefined
  history: MetricHistory[]
  onUpdate: (key: MetricKey, field: 'actual' | 'target', value: number | null) => void
  // Only for the department's lead (or the executive director)
  onRemove?: () => void
  onEdit?: (patch: { label: string; unit: MetricUnit }) => void
  onMoveLeft?: () => void
  onMoveRight?: () => void
  // Team goals that move this metric, with how many rocks / KPIs sit under each
  movedBy: { goal: Pick<AnnualGoal, 'id' | 'title' | 'status'>; rocks: number; kpis: number }[]
}

function MetricCard({ def, metric, history, onUpdate, onRemove, onEdit, onMoveLeft, onMoveRight, movedBy }: MetricCardProps) {
  const metricKey = def.key
  const { byId } = useTeam()
  const [editingField, setEditingField] = useState<'actual' | 'target' | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  // Starts as just the number and progress; "More" shows the trend, Moved by and history
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(def.label)
  const [unit, setUnit] = useState<MetricUnit>(def.unit)
  const config = { label: def.label, department: def.department, format: (v: number) => formatMetric(def.unit, v) }

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
    <div className="card p-5 min-w-0 flex flex-col group">
      {renaming && onEdit ? (
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <input autoFocus value={name} onChange={e => setName(e.target.value)} aria-label="Metric name"
            onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onEdit({ label: name.trim(), unit }); setRenaming(false) } if (e.key === 'Escape') setRenaming(false) }}
            className="flex-1 min-w-[120px] text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-blue-400" />
          <select value={unit} onChange={e => setUnit(e.target.value as MetricUnit)} aria-label="Counted in"
            className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 bg-white">
            {UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
          <button onClick={() => setRenaming(false)} className="text-[11px] text-gray-400 px-1">Cancel</button>
          <button disabled={!name.trim()} onClick={() => { onEdit({ label: name.trim(), unit }); setRenaming(false) }}
            className="text-[11px] font-semibold text-white px-2 py-1 rounded-md disabled:opacity-40" style={{ background: '#2563EB' }}>Save</button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500">{config.label}</span>
          <span className="ml-auto"><DeptTag dept={config.department} /></span>
          {(onEdit || onMoveLeft || onMoveRight) && !confirmRemove && (
            <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
              {onMoveLeft && (
                <button onClick={onMoveLeft} aria-label={`Move ${config.label} left`} title="Move left" className="text-gray-300 hover:text-blue-600">
                  <ChevronLeft size={14} />
                </button>
              )}
              {onMoveRight && (
                <button onClick={onMoveRight} aria-label={`Move ${config.label} right`} title="Move right" className="text-gray-300 hover:text-blue-600">
                  <ChevronRight size={14} />
                </button>
              )}
              {onEdit && (
                <button onClick={() => { setName(def.label); setUnit(def.unit); setRenaming(true) }} aria-label={`Rename ${config.label}`} title="Rename or change unit"
                  className="text-gray-300 hover:text-blue-600 ml-0.5">
                  <Pencil size={12} />
                </button>
              )}
            </span>
          )}
          {onRemove && (
            confirmRemove ? (
              <span className="flex items-center gap-1.5 text-[11px]">
                <button onClick={onRemove} className="font-semibold text-red-600">Remove</button>
                <button onClick={() => setConfirmRemove(false)} className="text-gray-400">Keep</button>
              </span>
            ) : (
              <button onClick={() => setConfirmRemove(true)} aria-label={`Remove ${config.label}`}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-300 hover:text-red-400">
                <Trash2 size={12} />
              </button>
            )
          )}
        </div>
      )}

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
        {expanded && last3.length > 1 && (
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

      <button onClick={() => setExpanded(e => !e)} aria-expanded={expanded}
        className="flex items-center gap-0.5 self-start mt-2.5 text-[11px] font-semibold text-gray-400 hover:text-blue-600">
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {expanded ? 'Less' : 'More'}
      </button>

      {expanded && (
        <>
          <div className="mt-2 pt-2 border-t border-gray-100">
            {movedBy.length === 0 ? (
              <p className="flex items-center gap-1 text-[11px] text-amber-700"><AlertTriangle size={11} /> No team goals move this metric yet</p>
            ) : (
              <>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 mb-1">Moved by</p>
                <ul className="space-y-1">
                  {movedBy.map(m => (
                    <li key={m.goal.id} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 min-w-0 truncate text-gray-700">{m.goal.title}</span>
                      <span className={`text-[11px] ${m.rocks + m.kpis ? 'text-gray-400' : 'text-amber-700'}`}>
                        {m.rocks + m.kpis ? `${m.rocks} rock${m.rocks === 1 ? '' : 's'} · ${m.kpis} KPI${m.kpis === 1 ? '' : 's'}` : 'nothing under it'}
                      </span>
                      <StatusPill status={m.goal.status} small />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

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
        </>
      )}
    </div>
  )
}

// ---------- section ----------

interface Props {
  year: number
  // Limits which metrics show (e.g. to the viewer's departments)
  filter?: (m: KeyMetric) => boolean
  title?: string
  empty?: ReactNode
  controls?: ReactNode
}

export function KeyMetrics({ year, filter, title = `Key metrics · ${year}`, empty, controls }: Props) {
  const { me, profiles } = useTeam()
  const { metrics, loading, error, updateMetric, historyFor } = useScorecardMetrics(year, me.id)
  const list = useKeyMetrics()
  const shown = filter ? list.defs.filter(filter) : list.defs
  const leads = leadsOf(me, profiles)
  const [adding, setAdding] = useState(false)

  // Team goals for the year that point at a key metric, and what sits under them
  const [goals, setGoals] = useState<Pick<AnnualGoal, 'id' | 'title' | 'status' | 'metric_key'>[]>([])
  const version = useGoalDataVersion()
  useEffect(() => {
    supabase.from('annual_goals').select('id, title, status, metric_key').eq('year', year).not('metric_key', 'is', null)
      .then(({ data }) => setGoals(data ?? []))
  }, [year, version])
  const children = useGoalChildren('team', goals.map(g => g.id))
  const movedBy = (key: string) => goals.filter(g => g.metric_key === key).map(g => {
    const u = children.under(g.id)
    return { goal: g, rocks: u.rocks.length, kpis: u.kpis.length }
  })

  return (
    <section>
      <SectionLabel right={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="text-[11px] text-gray-400">click a number to edit · updated together at the first Monday meeting each month</span>
          {list.editable && leads.length > 0 && (
            <button onClick={() => setAdding(v => !v)} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
              <Plus size={13} /> Add key metric
            </button>
          )}
          {controls}
        </div>
      }>
        {title}
      </SectionLabel>
      {(error || list.error) && <p role="alert" className="text-xs text-red-600 mb-2">{error || list.error}</p>}
      {adding && <AddMetric departments={leads} onCancel={() => setAdding(false)}
        onSave={async (label, dept, unit) => { if (await list.addMetric(label, dept, unit)) setAdding(false) }} />}
      {shown.length === 0 ? (
        <div className="card p-5 text-sm text-gray-500">{empty ?? 'No key metrics yet.'}</div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{shown.map(m => <div key={m.key} className="card h-44 animate-pulse" />)}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {shown.map((def, i) => {
            const manages = list.editable && leads.includes(def.department)
            // Moving goes past the neighbouring card on screen; positions are in the full list
            const others = list.defs.filter(m => m.key !== def.key)
            const prev = shown[i - 1]
            const next = shown[i + 1]
            return (
              <MetricCard key={def.key} def={def} metric={metrics.find(m => m.metric_key === def.key)} history={historyFor(def.key)} onUpdate={updateMetric} movedBy={movedBy(def.key)}
                onRemove={manages ? () => list.removeMetric(def.key) : undefined}
                onEdit={manages ? patch => list.editMetric(def.key, patch) : undefined}
                onMoveLeft={manages && prev ? () => list.moveMetric(def.key, others.indexOf(prev)) : undefined}
                onMoveRight={manages && next ? () => list.moveMetric(def.key, others.indexOf(next) + 1) : undefined} />
            )
          })}
        </div>
      )}
    </section>
  )
}

// Department leads (and the executive director) add metrics for their departments
function AddMetric({ departments, onSave, onCancel }: {
  departments: Department[]
  onSave: (label: string, dept: Department, unit: MetricUnit) => void
  onCancel: () => void
}) {
  const [label, setLabel] = useState('')
  const [dept, setDept] = useState<Department>(departments[0])
  const [unit, setUnit] = useState<MetricUnit>('number')
  const save = () => { if (label.trim()) onSave(label.trim(), dept, unit) }

  return (
    <div className="card p-5 mb-3 border border-blue-100">
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-3">
        <input autoFocus value={label} onChange={e => setLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel() }}
          placeholder="Metric name, e.g. Coaches trained" className="text-sm outline-none border border-gray-200 rounded-lg px-3 py-2" />
        <select value={dept} onChange={e => setDept(e.target.value as Department)} aria-label="Department"
          className="text-sm text-gray-700 outline-none border border-gray-200 rounded-lg px-3 py-2 bg-white">
          {DEPARTMENTS.filter(d => departments.includes(d.id)).map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
        <select value={unit} onChange={e => setUnit(e.target.value as MetricUnit)} aria-label="Counted in"
          className="text-sm text-gray-700 outline-none border border-gray-200 rounded-lg px-3 py-2 bg-white">
          {UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2 justify-end mt-3">
        <span className="text-[11px] text-gray-400 mr-auto">You can add metrics for the departments you lead. Set the target and number on the tile after.</span>
        <button onClick={onCancel} className="text-xs text-gray-500 px-3 py-1.5">Cancel</button>
        <button onClick={save} disabled={!label.trim()} className="text-xs font-semibold text-white px-4 py-1.5 rounded-lg disabled:opacity-40" style={{ background: '#2563EB' }}>
          Add metric
        </button>
      </div>
    </div>
  )
}
