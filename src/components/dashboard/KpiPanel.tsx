import { useState } from 'react'
import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import type { useKpis } from '../../hooks/useKpis'
import type { Kpi, KpiArea, KpiStatus, TeamTask } from '../../types/database'
import { useTeam } from '../../lib/team'
import { ProgressBar, SectionLabel } from '../layout/PageShell'
import { StatusPill } from '../ui/StatusPill'

interface Props {
  kpiState: ReturnType<typeof useKpis>
  tasks: TeamTask[]
  editable: boolean
  personId: string
  fallbackMondayUrl: string | null
}

const KPI_OPTIONS: KpiStatus[] = ['not-started', 'in-progress', 'on-track', 'off-track', 'done']
const TONE: Record<KpiStatus, 'blue' | 'green' | 'amber' | 'red'> = {
  'not-started': 'blue', 'in-progress': 'amber', 'on-track': 'green', 'off-track': 'red', done: 'blue',
}

function isUrl(s: string) {
  try { return ['http:', 'https:'].includes(new URL(s).protocol) } catch { return false }
}

export function KpiPanel({ kpiState, tasks, editable, personId, fallbackMondayUrl }: Props) {
  const { areas, kpis, loading, addArea, deleteArea } = kpiState
  const [addingArea, setAddingArea] = useState(false)
  const [areaName, setAreaName] = useState('')
  const [areaUrl, setAreaUrl] = useState('')

  const urlOk = areaUrl.trim() === '' ? false : isUrl(areaUrl.trim())

  function saveArea() {
    if (!areaName.trim() || !urlOk) return
    addArea(personId, areaName.trim(), areaUrl.trim())
    setAreaName('')
    setAreaUrl('')
    setAddingArea(false)
  }

  return (
    <section className="card p-5 self-start">
      <SectionLabel
        right={editable && (
          <button onClick={() => setAddingArea(v => !v)} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
            <Plus size={13} /> Add program area
          </button>
        )}
      >
        Individual KPIs
      </SectionLabel>

      {addingArea && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 mb-4 space-y-2">
          <input
            autoFocus
            value={areaName}
            onChange={e => setAreaName(e.target.value)}
            placeholder="Program area (e.g. Programs, Operations, Development)"
            className="w-full text-sm outline-none border border-gray-200 rounded-lg px-3 py-2 bg-white"
          />
          <input
            value={areaUrl}
            onChange={e => setAreaUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveArea()}
            placeholder="Monday board link (required) — https://boxunited.monday.com/boards/…"
            className="w-full text-sm outline-none border border-gray-200 rounded-lg px-3 py-2 bg-white"
          />
          {areaUrl.trim() !== '' && !urlOk && <p className="text-xs text-red-600">Paste the full board link, starting with https://</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setAddingArea(false)} className="text-xs text-gray-500 px-3 py-1.5">Cancel</button>
            <button onClick={saveArea} disabled={!areaName.trim() || !urlOk} className="text-xs font-semibold text-white px-4 py-1.5 rounded-lg disabled:opacity-40" style={{ background: '#2563EB' }}>
              Save area
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : areas.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">
          {editable ? 'Add a program area, link its Monday board, then add the KPIs you own there.' : 'No KPIs set up yet.'}
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
              mondayUrl={area.monday_url || fallbackMondayUrl}
              onDelete={() => deleteArea(area.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

interface AreaProps {
  area: KpiArea
  kpis: Kpi[]
  tasks: TeamTask[]
  editable: boolean
  kpiState: ReturnType<typeof useKpis>
  mondayUrl: string | null
  onDelete: () => void
}

function AreaBlock({ area, kpis, tasks, editable, kpiState, mondayUrl, onDelete }: AreaProps) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')

  function add() {
    if (!title.trim()) return
    const t = target.trim() === '' ? null : Number(target.replace(/[,$]/g, ''))
    kpiState.addKpi(area, title.trim(), t != null && !isNaN(t) ? t : null)
    setTitle('')
    setTarget('')
    setAdding(false)
  }

  return (
    <div className="group/area">
      <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-700">{area.name}</h3>
        {mondayUrl ? (
          <a href={mondayUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline">
            Monday board <ExternalLink size={10} />
          </a>
        ) : (
          <span className="text-[11px] text-amber-700">no Monday board linked</span>
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
          <button onClick={add} disabled={!title.trim()} className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg disabled:opacity-40" style={{ background: '#2563EB' }}>Add</button>
        </div>
      )}

      {kpis.length === 0 && !adding && <p className="text-xs text-gray-400 py-2">No KPIs in this area yet.</p>}
      <ul>
        {kpis.map(k => (
          <KpiRow key={k.id} kpi={k} tasks={tasks.filter(t => t.kpi_id === k.id && t.status !== 'done' && !t.archived_month)} editable={editable} kpiState={kpiState} />
        ))}
      </ul>
    </div>
  )
}

function KpiRow({ kpi, tasks, editable, kpiState }: { kpi: Kpi; tasks: TeamTask[]; editable: boolean; kpiState: ReturnType<typeof useKpis> }) {
  const { me } = useTeam()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  const numeric = kpi.target != null
  const pct = numeric && kpi.target ? ((kpi.current ?? 0) / kpi.target) * 100 : 0

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
          <StatusPill
            status={kpi.status}
            small
            options={editable ? KPI_OPTIONS : undefined}
            onChange={editable ? s => kpiState.updateKpi(kpi.id, { status: s as KpiStatus }, me.id) : undefined}
          />
          {editable && (
            <button onClick={() => kpiState.deleteKpi(kpi.id)} aria-label="Delete KPI" className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
      {tasks.length > 0 && (
        <p className="text-xs text-gray-400 mt-1 truncate">
          {tasks.length} open task{tasks.length > 1 ? 's' : ''}: {tasks.map(t => t.title).join(' · ')}
        </p>
      )}
    </li>
  )
}
