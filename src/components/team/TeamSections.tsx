import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useRocks } from '../../hooks/useRocks'
import { useKpis } from '../../hooks/useKpis'
import type { Department } from '../../types/database'
import { METRIC_ORDER } from '../../config/metrics'
import { useTeam, currentQuarter, quarterLabel, displayName, orgOrder } from '../../lib/team'
import { DEPARTMENTS } from '../../lib/departments'
import { SectionLabel } from '../layout/PageShell'
import { Avatar } from '../ui/Avatar'
import { DeptTag } from '../ui/DeptTag'
import { KeyMetrics } from '../scorecard/KeyMetrics'
import { TeamGoals } from '../scorecard/TeamGoals'
import { RockCard, QuarterPills } from '../scorecard/RockCard'

const CURRENT_YEAR = new Date().getFullYear()

function YearPills({ year, onChange }: { year: number; onChange: (y: number) => void }) {
  return (
    <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100">
      {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => (
        <button key={y} onClick={() => onChange(y)} className="text-xs font-semibold px-2.5 py-1 rounded-lg"
          style={{ background: year === y ? '#2563EB' : 'transparent', color: year === y ? 'white' : '#6b7280' }}>
          {y}
        </button>
      ))}
    </div>
  )
}

// ---------- everyone's rocks ----------

export function TeamRocks() {
  const { profiles } = useTeam()
  const now = currentQuarter()
  const [q, setQ] = useState(now.q)
  const [year, setYear] = useState(now.year)
  const quarter = quarterLabel(q, year)
  const rocks = useRocks(quarter)

  return (
    <section>
      <SectionLabel right={<div className="flex flex-wrap items-center gap-2"><YearPills year={year} onChange={setYear} /><QuarterPills q={q} onChange={setQ} /></div>}>
        Everyone's rocks · {quarter}
      </SectionLabel>
      {rocks.error && <p role="alert" className="text-xs text-red-600 mb-2">{rocks.error}</p>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {orgOrder(profiles).map(({ person }) => <RockCard key={person.id} person={person} rocks={rocks} quarter={quarter} />)}
      </div>
    </section>
  )
}

// ---------- KPI summary per person ----------

export function TeamKpis() {
  const { profiles, openDashboard } = useTeam()
  const { areas, kpis } = useKpis()
  const [dept, setDept] = useState<Department | 'all'>('all')

  const shownAreas = areas.filter(a => dept === 'all' || a.department === dept)
  const pill = (active: boolean) => ({ background: active ? '#2563EB' : 'transparent', color: active ? 'white' : '#6b7280' })

  return (
    <section>
      <SectionLabel
        right={
          <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100">
            <button onClick={() => setDept('all')} className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={pill(dept === 'all')}>All</button>
            {DEPARTMENTS.map(d => (
              <button key={d.id} onClick={() => setDept(d.id)} className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={pill(dept === d.id)}>{d.label}</button>
            ))}
          </div>
        }
      >
        Individual KPIs · summary
      </SectionLabel>
      <div className="card divide-y divide-gray-50">
        {orgOrder(profiles).map(({ person: p }) => {
          const myAreas = shownAreas.filter(a => a.user_id === p.id)
          const mine = kpis.filter(k => myAreas.some(a => a.id === k.area_id))
          const count = (s: string) => mine.filter(k => k.status === s).length
          if (dept !== 'all' && myAreas.length === 0) return null
          return (
            <button key={p.id} onClick={() => openDashboard(p.id)}
              className="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/60">
              <Avatar profile={p} size={28} />
              <div className="min-w-[160px] flex-1">
                <p className="text-sm font-semibold text-gray-900">{displayName(p)}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  {myAreas.length ? myAreas.map(a => (
                    <span key={a.id} className="flex items-center gap-1 text-xs text-gray-500">{a.name} <DeptTag dept={a.department} /></span>
                  )) : <span className="text-xs text-gray-400">No program areas yet</span>}
                </div>
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
        {dept !== 'all' && !shownAreas.length && (
          <p className="px-4 py-4 text-sm text-gray-400">No KPI areas tagged {DEPARTMENTS.find(d => d.id === dept)!.label} yet.</p>
        )}
      </div>
    </section>
  )
}

// ---------- all key metrics + all team goals ----------

export function TeamMetricsAndGoals() {
  const [year, setYear] = useState(CURRENT_YEAR)
  return (
    <div className="space-y-8">
      <KeyMetrics year={year} keys={METRIC_ORDER} controls={<YearPills year={year} onChange={setYear} />} />
      <TeamGoals year={year} />
    </div>
  )
}
