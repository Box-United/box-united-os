import { useState, type ReactNode } from 'react'
import { Copy, ExternalLink, Plus, Trash2 } from 'lucide-react'
import { currentPeriod, kpiPeriodLabel, type KpiPeriod, type useKpis } from '../../hooks/useKpis'
import type { Department, Kpi, KpiArea, KpiStatus, TeamTask } from '../../types/database'
import { useTeam, quarterLabel } from '../../lib/team'
import { DEPARTMENTS } from '../../lib/departments'
import { ProgressBar, SectionLabel } from '../layout/PageShell'
import { StatusPill } from '../ui/StatusPill'
import { PROGRESS_OPTIONS } from '../../lib/statuses'
import { DeptSelect, DeptTag } from '../ui/DeptTag'
import { SupportsPicker } from '../ui/SupportsPicker'
import { useSupportOptions, type SupportOptions } from '../../hooks/useGoalLinks'
import { parentPatch, parentValue } from '../../lib/goalLinks'

interface Props {
  kpiState: ReturnType<typeof useKpis>
  tasks: TeamTask[]
  editable: boolean
  personId: string
  fallbackMondayUrl: string | null
  // The quarter being looked at; its year's annual KPIs show too
  period: KpiPeriod
  // Extra control for the section header (e.g. the dashboard's Less toggle)
  extra?: ReactNode
}

const TONE: Record<KpiStatus, 'blue' | 'green' | 'amber' | 'red'> = {
  'not-started': 'blue', 'on-track': 'green', 'off-track': 'red', done: 'blue',
}

// Annual KPIs count toward the year; quarterly ones start over each quarter
type Cadence = 'annual' | 'quarterly'
const cadenceOf = (k: Kpi): Cadence => (k.quarter ? 'quarterly' : 'annual')
const whenFor = (c: Cadence, p: KpiPeriod) => ({ year: p.year, quarter: c === 'quarterly' ? p.q : null })
const periodIndex = (year: number, q: number) => year * 4 + q

function isUrl(s: string) {
  try { return ['http:', 'https:'].includes(new URL(s).protocol) } catch { return false }
}

// The closest quarter that has quarterly KPIs, to copy into an empty past quarter
function nearestQuarterSet(all: Kpi[], p: KpiPeriod) {
  const byQuarter = new Map<number, Kpi[]>()
  for (const k of all) {
    if (!k.quarter) continue
    const i = periodIndex(k.year, k.quarter)
    byQuarter.set(i, [...(byQuarter.get(i) ?? []), k])
  }
  const here = periodIndex(p.year, p.q)
  const best = [...byQuarter.keys()].sort((a, b) => Math.abs(a - here) - Math.abs(b - here) || b - a)[0]
  return best == null ? null : byQuarter.get(best)!
}

export function KpiPanel({ kpiState, tasks, editable, personId, fallbackMondayUrl, period, extra }: Props) {
  const { areas, kpis, allKpis, loading, error, addArea, updateArea, addKpi, copyKpis, deleteArea } = kpiState
  const [adding, setAdding] = useState(false)
  const [kpiTitle, setKpiTitle] = useState('')
  const [areaName, setAreaName] = useState('')
  const [areaUrl, setAreaUrl] = useState('')
  const [dept, setDept] = useState<Department | null>(null)
  const [target, setTarget] = useState('')
  const [cadence, setCadence] = useState<Cadence>('annual')
  const [parent, setParent] = useState('')
  const [saving, setSaving] = useState(false)
  const options = useSupportOptions(personId)

  const existing = areas.find(a => a.name.trim().toLowerCase() === areaName.trim().toLowerCase())
  // The Monday board link is optional
  const urlOk = areaUrl.trim() === '' || isUrl(areaUrl.trim())
  const canSave = kpiTitle.trim() && areaName.trim() && urlOk && !saving

  // An empty past quarter can start from another quarter's set (to fill in history)
  const now = currentPeriod()
  const isPast = periodIndex(period.year, period.q) < periodIndex(now.year, now.q)
  const copySource = editable && isPast && !kpis.some(k => k.quarter) ? nearestQuarterSet(allKpis, period) : null
  const [copying, setCopying] = useState(false)

  // Picking an existing program area fills in its Monday board link and department
  function onAreaChange(v: string) {
    setAreaName(v)
    const match = areas.find(a => a.name.trim().toLowerCase() === v.trim().toLowerCase())
    if (match?.monday_url && !areaUrl.trim()) setAreaUrl(match.monday_url)
    if (match?.department) setDept(match.department)
  }

  function reset() {
    setKpiTitle('')
    setAreaName('')
    setAreaUrl('')
    setDept(null)
    setTarget('')
    setCadence('annual')
    setParent('')
    setAdding(false)
  }

  async function save() {
    if (!canSave) return
    setSaving(true)
    const url = areaUrl.trim() || null
    let area = existing ?? null
    if (area && url && area.monday_url !== url) await updateArea(area.id, { monday_url: url })
    if (area && dept && area.department !== dept) await updateArea(area.id, { department: dept })
    if (!area) area = await addArea(personId, areaName.trim(), url, dept)
    if (area) {
      const t = target.trim() === '' ? null : Number(target.replace(/[,$]/g, ''))
      await addKpi(area, kpiTitle.trim(), t != null && !isNaN(t) ? t : null, whenFor(cadence, period), parent)
      reset()
    }
    setSaving(false)
  }

  async function copyIn() {
    if (!copySource) return
    setCopying(true)
    await copyKpis(copySource, { year: period.year, quarter: period.q })
    setCopying(false)
  }

  return (
    <section className="card p-5 self-start">
      <SectionLabel
        right={(editable || extra) && (
          <div className="flex items-center gap-3">
            {editable && (
              <button onClick={() => setAdding(v => !v)} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
                <Plus size={13} /> Add program area
              </button>
            )}
            {extra}
          </div>
        )}
      >
        Individual KPIs · {quarterLabel(period.q, period.year)}
      </SectionLabel>

      {error && <SaveError text={error} onDismiss={kpiState.clearError} />}

      {adding && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block md:col-span-2">
              <span className="block text-xs font-semibold text-gray-700 mb-1">KPI</span>
              <input autoFocus value={kpiTitle} onChange={e => setKpiTitle(e.target.value)}
                placeholder="e.g. 30 schools submit surveys"
                className="w-full text-sm outline-none border border-gray-200 rounded-lg px-3 py-2 bg-white focus:border-blue-400" />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-gray-700 mb-1">Program area it's tied to</span>
              <input value={areaName} onChange={e => onAreaChange(e.target.value)} list={`areas-${personId}`}
                placeholder="e.g. Programs, Operations, Development"
                className="w-full text-sm outline-none border border-gray-200 rounded-lg px-3 py-2 bg-white focus:border-blue-400" />
              <datalist id={`areas-${personId}`}>
                {areas.map(a => <option key={a.id} value={a.name} />)}
              </datalist>
              {areaName.trim() && <span className="block text-[11px] text-gray-400 mt-1">{existing ? 'Adds to this existing area' : 'Creates a new program area'}</span>}
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-gray-700 mb-1">Department</span>
              <select value={dept ?? ''} onChange={e => setDept((e.target.value || null) as Department | null)}
                className="w-full text-sm outline-none border border-gray-200 rounded-lg px-3 py-2 bg-white focus:border-blue-400">
                <option value="">No department</option>
                {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-gray-700 mb-1">Target number <span className="font-normal text-gray-400">(optional)</span></span>
              <input value={target} onChange={e => setTarget(e.target.value)} inputMode="decimal"
                placeholder="e.g. 30"
                className="w-full text-sm outline-none border border-gray-200 rounded-lg px-3 py-2 bg-white focus:border-blue-400" />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-gray-700 mb-1">Counts start over</span>
              <select value={cadence} onChange={e => setCadence(e.target.value as Cadence)}
                className="w-full text-sm outline-none border border-gray-200 rounded-lg px-3 py-2 bg-white focus:border-blue-400">
                <option value="annual">Every year · counts toward {period.year}</option>
                <option value="quarterly">Every quarter · counts toward {quarterLabel(period.q, period.year)}</option>
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="block text-xs font-semibold text-gray-700 mb-1">Supports <span className="font-normal text-gray-400">(optional)</span></span>
              <SupportsPicker options={options} value={parent} onChange={setParent} withRocks />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-gray-700 mb-1">Link to the Monday board <span className="font-normal text-gray-400">(optional)</span></span>
              <input value={areaUrl} onChange={e => setAreaUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()}
                placeholder="https://boxunited.monday.com/boards/…"
                className="w-full text-sm outline-none border border-gray-200 rounded-lg px-3 py-2 bg-white focus:border-blue-400" />
              {areaUrl.trim() !== '' && !urlOk && <span className="block text-xs text-red-600 mt-1">Paste the full board link, starting with https://</span>}
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={reset} className="text-xs text-gray-500 px-3 py-1.5">Cancel</button>
            <button onClick={save} disabled={!canSave} className="text-xs font-semibold text-white px-4 py-1.5 rounded-lg disabled:opacity-40" style={{ background: '#2563EB' }}>
              {saving ? 'Saving…' : 'Save KPI'}
            </button>
          </div>
        </div>
      )}

      {copySource && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-gray-200 px-3 py-2.5 mb-4 text-xs text-gray-600">
          <span className="flex-1 min-w-[180px]">No quarterly KPIs for {quarterLabel(period.q, period.year)} yet. Start from the {kpiPeriodLabel(copySource[0])} set? Same KPIs and targets, counts at 0.</span>
          <button onClick={copyIn} disabled={copying} className="flex items-center gap-1 font-semibold text-blue-600 border border-blue-200 rounded-lg px-2.5 py-1 disabled:opacity-50">
            <Copy size={12} /> {copying ? 'Copying…' : `Copy ${copySource.length} KPI${copySource.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : areas.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">
          {editable ? 'Use "Add program area" to add a KPI and the program area it belongs to.' : 'No KPIs set up yet.'}
        </p>
      ) : (
        <div className="space-y-5">
          {areas.map(area => (
            <AreaBlock
              key={area.id}
              area={area}
              kpis={kpis.filter(k => k.area_id === area.id)}
              tasks={tasks}
              editable={editable}
              kpiState={kpiState}
              options={options}
              mondayUrl={area.monday_url || fallbackMondayUrl}
              period={period}
              onDelete={() => deleteArea(area.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function SaveError({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
      <span className="flex-1">{text}</span>
      <button onClick={onDismiss} className="font-semibold hover:underline">Dismiss</button>
    </div>
  )
}

interface AreaProps {
  area: KpiArea
  kpis: Kpi[]
  tasks: TeamTask[]
  editable: boolean
  kpiState: ReturnType<typeof useKpis>
  options: SupportOptions
  mondayUrl: string | null
  period: KpiPeriod
  onDelete: () => void
}

function AreaBlock({ area, kpis, tasks, editable, kpiState, options, mondayUrl, period, onDelete }: AreaProps) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  const [cadence, setCadence] = useState<Cadence>('annual')

  function add() {
    if (!title.trim()) return
    const t = target.trim() === '' ? null : Number(target.replace(/[,$]/g, ''))
    kpiState.addKpi(area, title.trim(), t != null && !isNaN(t) ? t : null, whenFor(cadence, period))
    setTitle('')
    setTarget('')
    setCadence('annual')
    setAdding(false)
  }

  return (
    <div className="group/area">
      <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-700">{area.name}</h3>
        {editable
          ? <DeptSelect value={area.department} onChange={d => kpiState.updateArea(area.id, { department: d })} noneLabel="No department" />
          : <DeptTag dept={area.department} />}
        {mondayUrl && (
          <a href={mondayUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline">
            Monday board <ExternalLink size={10} />
          </a>
        )}
        {editable && (
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setAdding(v => !v)} className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
              <Plus size={11} /> KPI
            </button>
            <button onClick={onDelete} aria-label={`Delete ${area.name}`} className="opacity-0 group-hover/area:opacity-100 text-gray-300 hover:text-red-400">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {adding && (
        <div className="flex flex-wrap gap-2 py-2">
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="KPI (e.g. 30 schools submit surveys)" className="flex-1 min-w-[180px] text-sm outline-none border border-gray-200 rounded-lg px-3 py-1.5" />
          <input value={target} onChange={e => setTarget(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Target # (optional)" inputMode="decimal" className="w-36 text-sm outline-none border border-gray-200 rounded-lg px-3 py-1.5" />
          <select value={cadence} onChange={e => setCadence(e.target.value as Cadence)} aria-label="Counts start over"
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
            <option value="annual">Every year</option>
            <option value="quarterly">Every quarter</option>
          </select>
          <button onClick={add} disabled={!title.trim()} className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg disabled:opacity-40" style={{ background: '#2563EB' }}>Add</button>
        </div>
      )}

      {kpis.length === 0 && !adding && <p className="text-xs text-gray-400 py-2">No KPIs here for {quarterLabel(period.q, period.year)}.</p>}
      <ul>
        {kpis.map(k => (
          <KpiRow key={k.id} kpi={k} tasks={tasks.filter(t => t.kpi_id === k.id && t.status !== 'done' && !t.archived_month)} editable={editable} kpiState={kpiState} options={options} period={period} />
        ))}
      </ul>
    </div>
  )
}

function KpiRow({ kpi, tasks, editable, kpiState, options, period }: { kpi: Kpi; tasks: TeamTask[]; editable: boolean; kpiState: ReturnType<typeof useKpis>; options: SupportOptions; period: KpiPeriod }) {
  const { me } = useTeam()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  const numeric = kpi.target != null
  const pct = numeric && kpi.target ? ((kpi.current ?? 0) / kpi.target) * 100 : 0
  // Past quarters are history: they keep how they were counted
  const now = currentPeriod()
  const canSwitch = editable && periodIndex(period.year, period.q) >= periodIndex(now.year, now.q)

  function commit() {
    const n = val.trim() === '' ? null : Number(val.replace(/[,$]/g, ''))
    if (n === null || !isNaN(n)) kpiState.updateKpi(kpi.id, { current: n }, me.id)
    setEditing(false)
  }

  return (
    <li className="py-2.5 border-b border-gray-50 last:border-0 group">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_120px_auto] items-center gap-x-3 gap-y-1.5">
        <p className="text-sm font-medium text-gray-900 leading-snug">{kpi.title}</p>
        {numeric ? (
          <div className="hidden sm:block"><ProgressBar pct={pct} tone={TONE[kpi.status]} /></div>
        ) : <span className="hidden sm:block" />}
        <div className="flex items-center gap-2 justify-end">
          {numeric && (
            editing ? (
              <input autoFocus value={val} onChange={e => setVal(e.target.value)} onBlur={commit}
                onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
                inputMode="decimal" className="w-16 text-xs text-right border-b border-blue-500 outline-none tabular-nums" />
            ) : (
              <button
                disabled={!editable}
                onClick={() => { setVal(kpi.current != null ? String(kpi.current) : ''); setEditing(true) }}
                title={editable ? 'Click to update' : undefined}
                className="text-xs font-bold text-gray-700 tabular-nums enabled:hover:text-blue-600 enabled:cursor-text"
              >
                {(kpi.current ?? 0).toLocaleString()}/{kpi.target!.toLocaleString()}
              </button>
            )
          )}
          {canSwitch ? (
            <select value={cadenceOf(kpi)} aria-label="Counts start over"
              title={kpi.quarter ? `Counts toward ${kpiPeriodLabel(kpi)}, then start over next quarter` : `Counts toward ${kpi.year}, then start over next year`}
              onChange={e => kpiState.updateKpi(kpi.id, whenFor(e.target.value as Cadence, period), me.id)}
              className="text-[11px] text-gray-500 bg-gray-50 rounded-full px-2 py-0.5 outline-none border-none appearance-none cursor-pointer">
              <option value="annual">Yearly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          ) : (
            <span className="text-[11px] text-gray-500 bg-gray-50 rounded-full px-2 py-0.5">{kpi.quarter ? 'Quarterly' : 'Yearly'}</span>
          )}
          <StatusPill
            status={kpi.status}
            small
            options={editable ? PROGRESS_OPTIONS : undefined}
            onChange={editable ? s => kpiState.updateKpi(kpi.id, { status: s as KpiStatus }, me.id) : undefined}
          />
          {editable && (
            <button onClick={() => kpiState.deleteKpi(kpi.id)} aria-label="Delete KPI" className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="mt-1">
        {editable
          ? <SupportsPicker compact withRocks options={options} value={parentValue(kpi)} onChange={v => kpiState.updateKpi(kpi.id, parentPatch(v, true), me.id)} />
          : parentValue(kpi) && <span className="text-[11px] text-indigo-700">↑ {options.label(parentValue(kpi)) ?? 'a goal or rock'}</span>}
      </div>
      {tasks.length > 0 && (
        <p className="text-xs text-gray-400 mt-1 truncate">
          {tasks.length} open task{tasks.length > 1 ? 's' : ''}: {tasks.map(t => t.title).join(' · ')}
        </p>
      )}
    </li>
  )
}
