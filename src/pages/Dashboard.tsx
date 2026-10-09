import { useState } from 'react'
import { Eye, Pencil } from 'lucide-react'
import { PageShell, SectionLabel } from '../components/layout/PageShell'
import { Avatar } from '../components/ui/Avatar'
import { NotificationBell } from '../components/dashboard/NotificationBell'
import { KpiPanel } from '../components/dashboard/KpiPanel'
import { IndividualGoals } from '../components/dashboard/IndividualGoals'
import { TopTasks, MyTasksTable } from '../components/dashboard/MyTasks'
import { PersonSettings } from '../components/dashboard/PersonSettings'
import { MondayButton } from '../components/dashboard/MondayConnect'
import { KeyMetrics } from '../components/scorecard/KeyMetrics'
import { RockCard } from '../components/scorecard/RockCard'
import { DeptTag } from '../components/ui/DeptTag'
import { useKpis, currentPeriod } from '../hooks/useKpis'
import { useRocks } from '../hooks/useRocks'
import { useTeamTasks } from '../hooks/useTeamTasks'
import type { useNotifications } from '../hooks/useNotifications'
import { useTeam, displayName, firstName, managerOf, currentQuarter, quarterLabel } from '../lib/team'
import { departmentsOf, deptInfo, makeRelevant } from '../lib/departments'

interface Props {
  viewingUserId: string
  notifications: ReturnType<typeof useNotifications>
}

const ROLE_LABELS: Record<string, string> = {
  executive_director: 'Executive Director',
}

export function Dashboard({ viewingUserId, notifications }: Props) {
  const { me, profiles, byId, canEdit } = useTeam()
  const person = byId(viewingUserId) ?? me
  const isOwn = person.id === me.id
  const editable = canEdit(person.id)
  const manager = byId(managerOf(person, profiles))

  const kpis = useKpis(person.id)
  const board = useTeamTasks()
  const cq = currentQuarter()
  const quarter = quarterLabel(cq.q, cq.year)
  const rocks = useRocks(quarter, person.id)
  // Key metrics for this person's departments (and those of anyone who reports to them)
  const relevant = makeRelevant(person, profiles)
  const deptNames = departmentsOf(person, profiles).map(d => deptInfo(d)!.label).join(' · ')
  const whose = isOwn ? 'your' : `${firstName(person)}'s`
  // Only the executive director sets reporting lines and departments
  const [settingsFor, setSettingsFor] = useState<string | null>(null)
  const canSetup = me.role === 'executive_director'

  return (
    <PageShell>
      {!isOwn && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-5 text-sm"
          style={{ background: 'rgba(37,99,235,0.08)', color: '#2563EB' }}
        >
          {editable ? <Pencil size={14} /> : <Eye size={14} />}
          <span className="font-medium">Viewing {displayName(person)}'s page</span>
          <span className="text-blue-400 text-xs ml-auto">{editable ? 'you can edit (manager)' : 'view only'}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Avatar profile={person} size={44} />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-gray-900 truncate" style={{ fontFamily: 'Archivo, sans-serif' }}>
            {displayName(person)}
          </h1>
          <p className="text-sm text-gray-400">
            {person.title || (person.role && ROLE_LABELS[person.role]) || 'Team member'}
            {manager && <> · reports to {displayName(manager)}</>}
            {canSetup && settingsFor !== person.id && (
              <button onClick={() => setSettingsFor(person.id)} className="ml-2 text-xs font-semibold text-blue-600 hover:underline">
                {person.role === 'executive_director' ? 'Edit' : 'Change'}
              </button>
            )}
          </p>
          {(person.departments ?? []).length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {(person.departments ?? []).map(d => <DeptTag key={d} dept={d} />)}
            </div>
          )}
        </div>
        {isOwn && <MondayButton userId={me.id} onSynced={board.refetch} />}
        {isOwn && <NotificationBell notifications={notifications} />}
      </div>

      {canSetup && settingsFor === person.id && (
        <PersonSettings key={person.id} person={person} onDone={() => setSettingsFor(null)} />
      )}

      {/* Big picture first: metrics, goals, rocks, KPIs, then tasks */}
      <div className="space-y-8 mb-8">
        <KeyMetrics
          year={cq.year}
          filter={m => relevant(m.department)}
          title={`Key metrics for ${whose} departments · ${cq.year}`}
          empty={
            <>
              {deptNames ? `None of the key metrics are tagged ${deptNames}.` : `${isOwn ? "You don't" : `${firstName(person)} doesn't`} have a department yet, so no key metrics show here.`}{' '}
              All key metrics are on the <a href="#/team-board" className="font-semibold text-blue-600 hover:underline">Team Board</a>.
            </>
          }
        />

        <IndividualGoals personId={person.id} editable={editable} />

        <section>
          <SectionLabel>{isOwn ? 'My rocks' : 'Rocks'} · {quarter}</SectionLabel>
          {rocks.error && <p role="alert" className="text-xs text-red-600 mb-2">{rocks.error}</p>}
          <RockCard person={person} rocks={rocks} quarter={quarter} showName={false} />
        </section>

        <KpiPanel kpiState={kpis} tasks={board.tasks} editable={editable} personId={person.id} fallbackMondayUrl={null} period={currentPeriod()} />
      </div>

      <TopTasks board={board} personId={person.id} />
      <MyTasksTable board={board} personId={person.id} />
    </PageShell>
  )
}
