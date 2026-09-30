import { Eye, Pencil } from 'lucide-react'
import { PageShell } from '../components/layout/PageShell'
import { Avatar } from '../components/ui/Avatar'
import { NotificationBell } from '../components/dashboard/NotificationBell'
import { KpiPanel } from '../components/dashboard/KpiPanel'
import { IndividualGoals } from '../components/dashboard/IndividualGoals'
import { useKpis } from '../hooks/useKpis'
import { useTeamTasks } from '../hooks/useTeamTasks'
import type { useNotifications } from '../hooks/useNotifications'
import { useTeam, displayName } from '../lib/team'

interface Props {
  viewingUserId: string
  notifications: ReturnType<typeof useNotifications>
}

const ROLE_LABELS: Record<string, string> = {
  executive_director: 'Executive Director',
}

export function Dashboard({ viewingUserId, notifications }: Props) {
  const { me, byId, canEdit } = useTeam()
  const person = byId(viewingUserId) ?? me
  const isOwn = person.id === me.id
  const editable = canEdit(person.id)

  const kpis = useKpis(person.id)
  const { tasks } = useTeamTasks()

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
          <p className="text-sm text-gray-400">{(person.role && ROLE_LABELS[person.role]) || 'Team member'}</p>
        </div>
        {isOwn && <NotificationBell notifications={notifications} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5">
        <KpiPanel kpiState={kpis} tasks={tasks} editable={editable} personId={person.id} fallbackMondayUrl={null} />
        <IndividualGoals personId={person.id} editable={editable} />
      </div>
    </PageShell>
  )
}
