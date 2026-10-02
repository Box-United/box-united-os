import { useState } from 'react'
import { Target } from 'lucide-react'
import { useRocks } from '../hooks/useRocks'
import { useKpis } from '../hooks/useKpis'
import { useTeamTasks } from '../hooks/useTeamTasks'
import { useTeam, currentQuarter, quarterLabel, displayName } from '../lib/team'
import { departmentsOf, deptInfo } from '../lib/departments'
import { PageShell, SectionLabel } from '../components/layout/PageShell'
import { KpiPanel } from '../components/dashboard/KpiPanel'
import { KeyMetrics } from '../components/scorecard/KeyMetrics'
import { TeamGoals } from '../components/scorecard/TeamGoals'
import { RockCard, QuarterPills } from '../components/scorecard/RockCard'

const CURRENT_YEAR = new Date().getFullYear()

// Your own scorecard: your KPIs and rocks, plus the key metrics and team goals
// for your departments (and those of the people who report to you).
// Everyone's rocks, KPIs and the full set of metrics are on the Team Board.
export function Scorecard() {
  const { me, profiles, relevant } = useTeam()
  const [year, setYear] = useState(CURRENT_YEAR)
  const now = currentQuarter()
  const [q, setQ] = useState(now.q)
  const quarter = quarterLabel(q, year)

  const rocks = useRocks(quarter, me.id)
  const kpis = useKpis(me.id)
  const { tasks } = useTeamTasks()

  const isExec = me.role === 'executive_director'
  const myDepts = departmentsOf(me, profiles)
  const exec = profiles.find(p => p.role === 'executive_director')
  const deptNames = myDepts.map(d => deptInfo(d)!.label).join(' · ')

  const years = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]
  const pill = (active: boolean) => ({ background: active ? '#2563EB' : 'transparent', color: active ? 'white' : '#6b7280' })
  const toTeamBoard = <a href="#/team-board" className="font-semibold text-blue-600 hover:underline">Team Board</a>

  return (
    <PageShell>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Archivo, sans-serif' }}>My Scorecard</h1>
          </div>
          <p className="text-sm text-gray-400 ml-7">
            Your KPIs and rocks, plus the metrics and team goals for {isExec ? 'every department' : deptNames || 'your departments'}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100">
          {years.map(y => (
            <button key={y} onClick={() => setYear(y)} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg" style={pill(year === y)}>{y}</button>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        <KeyMetrics
          year={year}
          filter={m => relevant(m.department)}
          title={`Key metrics for your departments · ${year}`}
          empty={
            <>
              {myDepts.length === 0
                ? `You don't have a department yet, so no key metrics show here. ${exec && exec.id !== me.id ? `Ask ${displayName(exec)} to set yours.` : ''}`
                : `None of the key metrics are tagged ${deptNames}.`}{' '}
              All key metrics are on the {toTeamBoard}.
            </>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5">
          <KpiPanel kpiState={kpis} tasks={tasks} editable personId={me.id} fallbackMondayUrl={null} />
          <section className="self-start">
            <SectionLabel right={<QuarterPills q={q} onChange={setQ} />}>My rocks · {quarter}</SectionLabel>
            {rocks.error && <p role="alert" className="text-xs text-red-600 mb-2">{rocks.error}</p>}
            <RockCard person={me} rocks={rocks} quarter={quarter} showName={false} />
          </section>
        </div>

        <TeamGoals
          year={year}
          filter={g => relevant(g.department) || g.owner_id === me.id}
          defaultDept={isExec ? null : (me.departments ?? [])[0] ?? myDepts[0] ?? null}
          footer={
            <p className="text-[11px] text-gray-400 mt-2">
              Showing whole-team goals and goals tagged to your departments. Every team goal is on the {toTeamBoard}.
            </p>
          }
        />
      </div>
    </PageShell>
  )
}
