import { useMemo, useState } from 'react'
import { AlertTriangle, Archive, MessageCircle, Plus, Trash2, Users } from 'lucide-react'
import { useTeamTasks, type NewTeamTask } from '../../hooks/useTeamTasks'
import { useKpis } from '../../hooks/useKpis'
import { useRocks } from '../../hooks/useRocks'
import type { Kpi, Rock, TeamTask } from '../../types/database'
import { useTeam, currentQuarter, quarterLabel, firstName, monthKey, monthLabel, shortDate } from '../../lib/team'
import { PageShell, PageHeader } from '../layout/PageShell'
import { Avatar } from '../ui/Avatar'

const CURRENT = 'current'

// Link values are encoded as "kpi:<id>" or "rock:<id>" in the picker
function linkValue(t: Pick<TeamTask, 'kpi_id' | 'rock_id'>) {
  return t.kpi_id ? `kpi:${t.kpi_id}` : t.rock_id ? `rock:${t.rock_id}` : ''
}
function parseLink(v: string) {
  return { kpi_id: v.startsWith('kpi:') ? v.slice(4) : null, rock_id: v.startsWith('rock:') ? v.slice(5) : null }
}

export function TeamBoard() {
  const { me, profiles, canEdit } = useTeam()
  const board = useTeamTasks()
  const { kpis } = useKpis()
  const now = currentQuarter()
  const { rocks } = useRocks(quarterLabel(now.q, now.year))

  const [view, setView] = useState(CURRENT)
  const [adding, setAdding] = useState(false)
  const [archiveMsg, setArchiveMsg] = useState<string | null>(null)

  const months = useMemo(
    () => [...new Set(board.tasks.map(t => t.archived_month).filter(Boolean) as string[])].sort().reverse(),
    [board.tasks],
  )
  const rows = board.tasks.filter(t => (view === CURRENT ? !t.archived_month : t.archived_month === view))
  const doneCount = board.tasks.filter(t => t.status === 'done' && !t.archived_month).length
  const unalignedCount = rows.filter(t => !t.kpi_id && !t.rock_id && t.status !== 'done').length

  async function archive() {
    const n = await board.archiveCompleted()
    setArchiveMsg(n ? `Archived ${n} completed task${n > 1 ? 's' : ''}.` : 'Nothing to archive.')
  }

  const canEditTask = (t: TeamTask) => t.created_by === me.id || canEdit(t.assigned_to)

  return (
    <PageShell>
      <PageHeader
        icon={<Users size={18} className="text-blue-600" />}
        title="Team Board"
        subtitle="Joint and meeting-assigned tasks, each tied to a KPI or rock. Task-by-task detail stays in Monday."
        actions={
          <>
            <select
              value={view}
              onChange={e => { setView(e.target.value); setAdding(false) }}
              aria-label="Month"
              className="text-sm bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm"
            >
              <option value={CURRENT}>This month ({monthLabel(monthKey())})</option>
              {months.map(m => <option key={m} value={m}>Archive · {monthLabel(m)}</option>)}
            </select>
            {view === CURRENT && (
              <button
                onClick={() => setAdding(true)}
                className="flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-xl hover:opacity-90"
                style={{ background: '#2563EB' }}
              >
                <Plus size={15} /> Add task
              </button>
            )}
          </>
        }
      />

      {board.error && <p className="text-sm text-red-600 mb-3">{board.error}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 border-b border-gray-100">
              <th className="w-10 px-4 py-3" aria-label="Done" />
              <th className="px-2 py-3">Task</th>
              <th className="px-2 py-3 w-36">Owner</th>
              <th className="px-2 py-3 w-32">Due</th>
              <th className="px-2 py-3">Notes</th>
              <th className="px-2 py-3 w-56">KPI / Rock</th>
              <th className="px-2 py-3 w-28">Source</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {adding && (
              <AddRow
                kpis={kpis}
                rocks={rocks}
                onCancel={() => setAdding(false)}
                onSave={async task => { if (await board.addTeamTask(task, me.id)) setAdding(false) }}
              />
            )}
            {board.loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 && !adding ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                  {view === CURRENT ? 'No team tasks yet. Use "Add task" to create one.' : 'Nothing archived for this month.'}
                </td>
              </tr>
            ) : rows.map(t => (
              <TaskRow
                key={t.id}
                task={t}
                kpis={kpis}
                rocks={rocks}
                editable={canEditTask(t) && view === CURRENT}
                profiles={profiles}
                onUpdate={patch => board.updateTask(t.id, patch)}
                onDelete={() => board.deleteTeamTask(t.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {view === CURRENT && (
        <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-gray-500">
          {unalignedCount > 0 && (
            <span className="flex items-center gap-1 text-amber-700">
              <AlertTriangle size={12} /> {unalignedCount} open task{unalignedCount > 1 ? 's' : ''} not linked to a KPI or rock
            </span>
          )}
          <span className="ml-auto">
            Monthly memory: completed tasks move to that month's archive.
          </span>
          <button
            onClick={archive}
            disabled={doneCount === 0}
            className="flex items-center gap-1.5 font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-1.5 disabled:opacity-40"
          >
            <Archive size={13} /> Archive {doneCount} completed
          </button>
          {archiveMsg && <span className="text-gray-400">{archiveMsg}</span>}
        </div>
      )}

    </PageShell>
  )
}

// ---------- link picker ----------

function LinkSelect({ ownerId, value, onChange, kpis, rocks, highlight }: {
  ownerId: string | null
  value: string
  onChange: (v: string) => void
  kpis: Kpi[]
  rocks: Rock[]
  highlight?: boolean
}) {
  const { byId } = useTeam()
  // Owner's own KPIs/rocks first, then everyone else's
  const sortOwner = <T extends { user_id: string }>(xs: T[]) =>
    [...xs].sort((a, b) => Number(b.user_id === ownerId) - Number(a.user_id === ownerId))
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      aria-label="Link to KPI or rock"
      className="w-full text-xs rounded-lg px-2 py-1.5 bg-white"
      style={{ border: highlight && !value ? '1.5px solid #93c5fd' : '1px solid #e5e7eb', color: value ? '#1e293b' : '#2563EB' }}
    >
      <option value="">What does this advance?</option>
      {kpis.length > 0 && (
        <optgroup label="KPIs">
          {sortOwner(kpis).map(k => <option key={k.id} value={`kpi:${k.id}`}>{firstName(byId(k.user_id))} · {k.title}</option>)}
        </optgroup>
      )}
      {rocks.length > 0 && (
        <optgroup label="Rocks (this quarter)">
          {sortOwner(rocks).map(r => <option key={r.id} value={`rock:${r.id}`}>{firstName(byId(r.user_id))} · {r.title}</option>)}
        </optgroup>
      )}
    </select>
  )
}

// ---------- add row ----------

function AddRow({ kpis, rocks, onSave, onCancel }: {
  kpis: Kpi[]
  rocks: Rock[]
  onSave: (t: NewTeamTask) => void
  onCancel: () => void
}) {
  const { me, profiles } = useTeam()
  const [title, setTitle] = useState('')
  const [owner, setOwner] = useState(me.id)
  const [due, setDue] = useState('')
  const [notes, setNotes] = useState('')
  const [link, setLink] = useState('')
  // Team meeting is on Mondays — default the flag on that day
  const [inMeeting, setInMeeting] = useState(new Date().getDay() === 1)

  function save() {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      assigned_to: owner || null,
      due_date: due || null,
      description: notes.trim() || null,
      assigned_in_meeting: inMeeting,
      ...parseLink(link),
    })
  }

  const keys = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') onCancel()
  }
  const notifies = owner && owner !== me.id && !inMeeting

  return (
    <tr className="bg-blue-50/50 border-b border-blue-100 align-top">
      <td className="px-4 py-2.5" />
      <td className="px-2 py-2">
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} onKeyDown={keys} placeholder="New task…"
          className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-blue-400" />
      </td>
      <td className="px-2 py-2">
        <select value={owner} onChange={e => setOwner(e.target.value)} aria-label="Owner" className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
          <option value="">Unassigned</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{firstName(p)}{p.id === me.id ? ' (me)' : ''}</option>)}
        </select>
      </td>
      <td className="px-2 py-2">
        <input type="date" value={due} onChange={e => setDue(e.target.value)} aria-label="Due date" className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white" />
      </td>
      <td className="px-2 py-2">
        <input value={notes} onChange={e => setNotes(e.target.value)} onKeyDown={keys} placeholder="Notes"
          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white outline-none" />
      </td>
      <td className="px-2 py-2">
        <LinkSelect ownerId={owner} value={link} onChange={setLink} kpis={kpis} rocks={rocks} highlight />
        {!link && <p className="text-[10px] text-amber-700 mt-1">Strongly encouraged — unlinked tasks are flagged "Unaligned"</p>}
      </td>
      <td className="px-2 py-2">
        <label className="flex items-center gap-1.5 text-xs text-gray-600 pt-1.5">
          <input type="checkbox" checked={inMeeting} onChange={e => setInMeeting(e.target.checked)} /> In meeting
        </label>
        {notifies && <p className="text-[10px] text-violet-700 mt-1">Owner will be notified</p>}
      </td>
      <td className="px-2 py-2">
        <div className="flex flex-col gap-1">
          <button onClick={save} disabled={!title.trim()} className="text-xs font-semibold text-white px-2.5 py-1.5 rounded-lg disabled:opacity-40" style={{ background: '#2563EB' }}>Save</button>
          <button onClick={onCancel} className="text-[11px] text-gray-500">Cancel</button>
        </div>
      </td>
    </tr>
  )
}

// ---------- existing row ----------

function TaskRow({ task, kpis, rocks, editable, profiles, onUpdate, onDelete }: {
  task: TeamTask
  kpis: Kpi[]
  rocks: Rock[]
  editable: boolean
  profiles: ReturnType<typeof useTeam>['profiles']
  onUpdate: (patch: Partial<TeamTask>) => void
  onDelete: () => void
}) {
  const { byId, me } = useTeam()
  const [notes, setNotes] = useState(task.description ?? '')
  const owner = byId(task.assigned_to)
  const creator = byId(task.created_by)
  const done = task.status === 'done'
  const linked = task.kpi_id || task.rock_id
  const kpi = kpis.find(k => k.id === task.kpi_id)
  const rock = rocks.find(r => r.id === task.rock_id)
  const overdue = !done && task.due_date && task.due_date < new Date().toISOString().slice(0, 10)

  return (
    <tr className={`border-b border-gray-50 last:border-0 group align-middle ${done ? 'opacity-60' : ''}`}>
      <td className="px-4 py-2.5">
        <input
          type="checkbox"
          checked={done}
          disabled={!editable}
          onChange={e => onUpdate({ status: e.target.checked ? 'done' : 'todo' })}
          aria-label={done ? 'Mark not done' : 'Mark done'}
          className="w-4 h-4 accent-blue-600"
        />
      </td>
      <td className="px-2 py-2.5">
        <p className={`font-semibold text-gray-900 ${done ? 'line-through' : ''}`}>{task.title}</p>
        {task.needs_discussion && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-700 bg-violet-50 rounded-full px-2 py-0.5 mt-1">
            <MessageCircle size={10} /> Discuss at next meeting
          </span>
        )}
      </td>
      <td className="px-2 py-2.5">
        {editable ? (
          <div className="flex items-center gap-1.5">
            <Avatar profile={owner} size={24} />
            <select value={task.assigned_to ?? ''} onChange={e => onUpdate({ assigned_to: e.target.value || null })} aria-label="Owner"
              className="text-xs bg-transparent outline-none min-w-0 flex-1 cursor-pointer">
              <option value="">Unassigned</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{firstName(p)}{p.id === me.id ? ' (me)' : ''}</option>)}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-1.5"><Avatar profile={owner} size={24} /><span className="text-xs text-gray-700">{firstName(owner)}</span></div>
        )}
      </td>
      <td className="px-2 py-2.5">
        {editable ? (
          <input type="date" value={task.due_date ?? ''} onChange={e => onUpdate({ due_date: e.target.value || null })} aria-label="Due date"
            className={`text-xs bg-transparent outline-none tabular-nums ${overdue ? 'text-red-600 font-semibold' : 'text-gray-700'}`} />
        ) : (
          <span className={`text-xs tabular-nums ${overdue ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>{shortDate(task.due_date)}</span>
        )}
      </td>
      <td className="px-2 py-2.5">
        {editable ? (
          <input value={notes} onChange={e => setNotes(e.target.value)}
            onBlur={() => notes !== (task.description ?? '') && onUpdate({ description: notes.trim() || null })}
            placeholder="—" className="w-full text-xs text-gray-600 bg-transparent outline-none focus:bg-white focus:border focus:border-gray-200 rounded px-1 py-0.5" />
        ) : (
          <span className="text-xs text-gray-600">{task.description || '—'}</span>
        )}
      </td>
      <td className="px-2 py-2.5">
        {editable && !done ? (
          <div>
            <LinkSelect ownerId={task.assigned_to} value={linkValue(task)} onChange={v => onUpdate(parseLink(v))} kpis={kpis} rocks={rocks} />
            {!linked && <UnalignedBadge />}
          </div>
        ) : linked ? (
          <span className="text-xs text-blue-600">{kpi ? `KPI · ${kpi.title}` : rock ? `Rock · ${rock.title}` : task.kpi_id ? 'KPI' : 'Rock'}</span>
        ) : <UnalignedBadge />}
      </td>
      <td className="px-2 py-2.5 text-xs text-gray-400">
        {task.source === 'monday' ? 'Monday' : task.assigned_in_meeting ? 'Meeting' : `Added by ${firstName(creator)}`}
      </td>
      <td className="px-2 py-2.5">
        {editable && (
          <button onClick={onDelete} aria-label="Delete task" className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400">
            <Trash2 size={13} />
          </button>
        )}
      </td>
    </tr>
  )
}

function UnalignedBadge() {
  return (
    <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-amber-800 bg-amber-100 rounded-full px-2 py-0.5">
      <AlertTriangle size={10} /> Unaligned
    </span>
  )
}
