import { AlertTriangle } from 'lucide-react'
import type { Kpi, Rock } from '../../types/database'
import { useTeam, firstName } from '../../lib/team'
import { StatusPill } from '../ui/StatusPill'

// The rocks and KPIs that sit under one goal (KPIs under those rocks are indented)
export function GoalRollup({ rocks, kpis }: { rocks: Rock[]; kpis: Kpi[] }) {
  const { byId } = useTeam()
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
      <span className="text-gray-400 hidden sm:inline">{firstName(byId(k.user_id))}</span>
      <StatusPill status={k.status} small />
    </li>
  )
  return (
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
  )
}
