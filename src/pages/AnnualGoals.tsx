import { useState, useRef } from 'react'
import { Target, Plus, Trash2, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'
import { useAnnualGoals } from '../hooks/useAnnualGoals'
import { useScorecardMetrics } from '../hooks/useScorecardMetrics'
import { useRocks } from '../hooks/useRocks'
import { useKpis } from '../hooks/useKpis'
import type { GoalStatus, MetricHistory, RockStatus } from '../types/database'
import type { MetricKey, ScorecardMetric } from '../hooks/useScorecardMetrics'
import { useTeam, currentQuarter, quarterLabel, displayName, firstName, shortDate } from '../lib/team'
import { PageShell, SectionLabel, ProgressBar } from '../components/layout/PageShell'
import { Avatar } from '../components/ui/Avatar'
import { StatusPill } from '../components/ui/StatusPill'

const CURRENT_YEAR = new Date().getFullYear()
const GOAL_OPTIONS: GoalStatus[] = ['not-started', 'in-progress', 'on-track', 'done']
const ROCK_OPTIONS: RockStatus[] = ['on-track', 'off-track', 'done']

type MetricConfig = {
  label: string
  format: (v: number) => string
  inputPrefix?: string
}

const METRIC_CONFIG: Record<MetricKey, MetricConfig> = {
  schools: { label: 'Schools', format: v => v.toLocaleString() },
  dollars_raised: {
    label: 'Raised',
    format: v => v >= 10000 ? '$' + Math.round(v / 1000).toLocaleString() + 'K' : '$' + v.toLocaleString(),
    inputPrefix: '$',
  },
  students: { label: 'Girls served', format: v => v.toLocaleString() },
}

const METRIC_ORDER: MetricKey[] = ['schools', 'dollars_raised', 'students']

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
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500">{config.label}</span>

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

// ---------- page ----------

export function Scorecard() {
  const { me, profiles, canEdit, openDashboard } = useTeam()
  const [year, setYear] = useState(CURRENT_YEAR)
  const now = currentQuarter()
  const [q, setQ] = useState(now.q)
  const quarter = quarterLabel(q, year)

  const { goals, loading: goalsLoading, addGoal, updateGoalStatus, deleteGoal } = useAnnualGoals(year, me.id)
  const { metrics, loading: metricsLoading, updateMetric, historyFor } = useScorecardMetrics(year, me.id)
  const rocks = useRocks(quarter)
  const { areas, kpis } = useKpis()

  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newOwner, setNewOwner] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rockFor, setRockFor] = useState<string | null>(null)
  const [rockTitle, setRockTitle] = useState('')

  const years = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

  function handleAdd() {
    if (!newTitle.trim()) return
    addGoal(newTitle.trim(), newDesc.trim() || undefined, newOwner || undefined)
    setNewTitle('')
    setNewDesc('')
    setNewOwner('')
    setShowAdd(false)
  }

  function saveRock(ownerId: string) {
    if (!rockTitle.trim()) return
    rocks.addRock(ownerId, rockTitle.trim())
    setRockTitle('')
    setRockFor(null)
  }

  const pill = (active: boolean) => ({ background: active ? '#2563EB' : 'transparent', color: active ? 'white' : '#6b7280' })

  return (
    <PageShell>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Archivo, sans-serif' }}>Scorecard</h1>
          </div>
          <p className="text-sm text-gray-400 ml-7">Annual goals · key metrics · everyone's rocks · individual KPIs</p>
        </div>
        <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100">
          {years.map(y => (
            <button key={y} onClick={() => setYear(y)} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg" style={pill(year === y)}>{y}</button>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        {/* ── Key metrics ─────────────────────────────── */}
        <section>
          <SectionLabel right={<span className="text-[11px] text-gray-400">click a number to edit · updated together at the first Monday meeting each month</span>}>
            Key metrics · {year}
          </SectionLabel>
          {metricsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[1, 2, 3].map(i => <div key={i} className="card h-44 animate-pulse" />)}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {METRIC_ORDER.map(key => (
                <MetricCard key={key} metricKey={key} metric={metrics.find(m => m.metric_key === key)} history={historyFor(key)} onUpdate={updateMetric} />
              ))}
            </div>
          )}
        </section>

        {/* ── Annual goals ─────────────────────────────── */}
        <section>
          <SectionLabel
            right={
              <button onClick={() => setShowAdd(v => !v)} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
                <Plus size={13} /> Add goal
              </button>
            }
          >
            Team annual goals · {year}
          </SectionLabel>

          {showAdd && (
            <div className="card p-5 mb-3 border border-blue-100">
              <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr] gap-3">
                <input autoFocus type="text" placeholder="Goal title…" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  className="text-sm text-gray-800 outline-none border border-gray-200 rounded-lg px-3 py-2" />
                <input type="text" placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  className="text-sm text-gray-500 outline-none border border-gray-200 rounded-lg px-3 py-2" />
                <select value={newOwner} onChange={e => setNewOwner(e.target.value)} className="text-sm text-gray-700 outline-none border border-gray-200 rounded-lg px-3 py-2 bg-white">
                  <option value="">Owner (optional)</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{displayName(p)}{p.id === me.id ? ' (me)' : ''}</option>)}
                </select>
              </div>
              <div className="flex gap-2 justify-end mt-3">
                <button onClick={() => setShowAdd(false)} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">Cancel</button>
                <button onClick={handleAdd} disabled={!newTitle.trim()} className="text-xs font-semibold text-white px-4 py-1.5 rounded-lg disabled:opacity-40" style={{ background: '#2563EB' }}>
                  Save goal
                </button>
              </div>
            </div>
          )}

          {goalsLoading ? (
            <div className="card h-14 animate-pulse" />
          ) : goals.length === 0 ? (
            <div className="card p-6 text-sm text-gray-400">No goals for {year} yet.</div>
          ) : (
            <div className="card divide-y divide-gray-50">
              {goals.map(goal => {
                const expanded = expandedId === goal.id
                return (
                  <div key={goal.id} className="px-4 py-3 group">
                    <div className="flex items-center gap-3">
                      {goal.owner && <Avatar profile={goal.owner} size={24} />}
                      <p className="flex-1 text-sm font-medium text-gray-900 leading-snug">{goal.title}</p>
                      <StatusPill status={goal.status} options={GOAL_OPTIONS} onChange={s => updateGoalStatus(goal.id, s as GoalStatus)} />
                      {goal.description && (
                        <button onClick={() => setExpandedId(expanded ? null : goal.id)} aria-label="Show description" className="text-gray-300 hover:text-gray-500">
                          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                      {goal.created_by === me.id && (
                        <button onClick={() => deleteGoal(goal.id)} aria-label="Delete goal" className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    {goal.description && expanded && <p className="text-xs text-gray-500 mt-2 leading-relaxed">{goal.description}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Quarterly rocks, everyone ───────────────── */}
        <section>
          <SectionLabel
            right={
              <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100">
                {[1, 2, 3, 4].map(n => (
                  <button key={n} onClick={() => setQ(n)} className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={pill(q === n)}>Q{n}</button>
                ))}
              </div>
            }
          >
            Quarterly rocks · {quarter}
          </SectionLabel>
          {rocks.error && <p className="text-xs text-red-600 mb-2">{rocks.error}</p>}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {profiles.map(p => {
              const mine = rocks.rocks.filter(r => r.user_id === p.id)
              const editable = canEdit(p.id)
              return (
                <div key={p.id} className="card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Avatar profile={p} size={28} />
                    <button onClick={() => openDashboard(p.id)} className="text-sm font-semibold text-gray-900 hover:text-blue-600 truncate">{displayName(p)}</button>
                    <span className="text-xs text-gray-400 ml-auto">{mine.length}/3</span>
                  </div>
                  <ul className="space-y-2">
                    {mine.map(r => (
                      <li key={r.id} className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 group">
                        <span className="flex-1 text-sm text-gray-800 leading-snug">{r.title}</span>
                        <StatusPill status={r.status} small options={editable ? ROCK_OPTIONS : undefined}
                          onChange={editable ? s => rocks.updateRockStatus(r.id, s as RockStatus) : undefined} />
                        {editable && (
                          <button onClick={() => rocks.deleteRock(r.id)} aria-label="Delete rock" className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </li>
                    ))}
                    {mine.length === 0 && rockFor !== p.id && <li className="text-xs text-gray-400">No rocks for {quarter}.</li>}
                  </ul>
                  {editable && mine.length < 3 && (
                    rockFor === p.id ? (
                      <div className="flex gap-2 mt-2">
                        <input autoFocus value={rockTitle} onChange={e => setRockTitle(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveRock(p.id); if (e.key === 'Escape') setRockFor(null) }}
                          placeholder="New rock…" className="flex-1 min-w-0 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none" />
                        <button onClick={() => saveRock(p.id)} className="text-xs font-semibold text-white px-3 rounded-lg" style={{ background: '#2563EB' }}>Add</button>
                      </div>
                    ) : (
                      <button onClick={() => { setRockFor(p.id); setRockTitle('') }} className="mt-2 flex items-center gap-1 text-xs font-semibold text-blue-600">
                        <Plus size={12} /> Add rock
                      </button>
                    )
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* ── KPI summary per person ──────────────────── */}
        <section>
          <SectionLabel>Individual KPIs · summary</SectionLabel>
          <div className="card divide-y divide-gray-50">
            {profiles.map(p => {
              const mine = kpis.filter(k => k.user_id === p.id)
              const myAreas = areas.filter(a => a.user_id === p.id)
              const count = (s: string) => mine.filter(k => k.status === s).length
              return (
                <button key={p.id} onClick={() => openDashboard(p.id)}
                  className="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/60">
                  <Avatar profile={p} size={28} />
                  <div className="min-w-[160px] flex-1">
                    <p className="text-sm font-semibold text-gray-900">{displayName(p)}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {myAreas.length ? myAreas.map(a => a.name).join(' · ') : 'No program areas yet'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {count('on-track') > 0 && <span className="status-pill on-track">{count('on-track')} on track</span>}
                    {count('in-progress') > 0 && <span className="status-pill in-progress">{count('in-progress')} in progress</span>}
                    {count('off-track') > 0 && <span className="status-pill off-track">{count('off-track')} off track</span>}
                    {count('done') > 0 && <span className="status-pill goal-done">{count('done')} done</span>}
                    {mine.length === 0 && <span className="text-xs text-gray-400">0 KPIs</span>}
                  </div>
                  <ArrowRight size={14} className="text-gray-300" />
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </PageShell>
  )
}
