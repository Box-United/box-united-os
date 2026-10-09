import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import type { Kpi, Rock } from '../../types/database'
import { useTeam, firstName } from '../../lib/team'
import { kpiPeriodLabel } from '../../hooks/useKpis'
import { StatusPill } from '../ui/StatusPill'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// The rocks and KPIs that sit under one goal (KPIs under those rocks are indented).
// Starts as a one-line count; click to see the list.
export function GoalRollup({ rocks, kpis }: { rocks: Rock[]; kpis: Kpi[] }) {
  const { byId } = useTeam()
  const [open, setOpen] = useState(false)
  if (!rocks.length && !kpis.length) {
    return (
      <p className="flex items-center gap-1 text-[11px] text-amber-700 mt-1.5">
        <AlertTriangle size={11} /> No rocks or KPIs support this goal yet
      </p>
    )
  }
  const rockIds = new Set(rocks.map(r => r.id))
  const direct = kpis.filter(k => !k.rock_id || !rockIds.has(k.rock_id))
  const kpiLine = (k: Kpi, indent: boolean) => (
    <li key={k.id} className={`flex items-center gap-2 text-xs ${indent ? 'pl-5' : ''}`}>
      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-purple-600 w-9 shrink-0">KPI</span>
      <span className="flex-1 min-w-0 truncate text-gray-700">{k.title}</span>
      {k.target != null && <span className="tabular-nums text-gray-500">{(k.current ?? 0).toLocaleString()}/{k.target.toLocaleString()}</span>}
      {k.quarter && <span className="text-gray-400">{kpiPeriodLabel(k)}</span>}
      <span className="text-gray-400 hidden sm:inline">{firstName(byId(k.user_id))}</span>
      <StatusPill status={k.status} small />
    </li>
  )
  const offTrack = [...rocks, ...kpis].filter(x => x.status === 'off-track').length
  const summary = (
    <button onClick={() => setOpen(o => !o)} aria-expanded={open}
      className="flex items-center gap-1.5 mt-1.5 text-[11px] text-gray-500 hover:text-gray-800">
      {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      {plural(rocks.length, 'rock')} · {plural(kpis.length, 'KPI')}
      {offTrack > 0 && <span className="status-pill off-track text-[10px]">{offTrack} off track</span>}
    </button>
  )
  if (!open) return summary
  return (
    <>
      {summary}
      <ul className="mt-2 space-y-1 border-l-2 border-indigo-100 pl-3">
        {rocks.map(r => (
          <li key={r.id}>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-blue-600 w-9 shrink-0">Rock</span>
              <span className="flex-1 min-w-0 truncate text-gray-700">{r.title}</span>
              <span className="text-gray-400">{r.quarter}</span>
              <span className="text-gray-400 hidden sm:inline">{firstName(byId(r.user_id))}</span>
              <StatusPill status={r.status} small />
            </div>
            {kpis.some(k => k.rock_id === r.id) && (
              <ul className="mt-1 space-y-1">{kpis.filter(k => k.rock_id === r.id).map(k => kpiLine(k, true))}</ul>
            )}
          </li>
        ))}
        {direct.map(k => kpiLine(k, false))}
      </ul>
    </>
  )
}
