import { useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { useTeamTasks } from '../../hooks/useTeamTasks'
import type { TeamTask } from '../../types/database'
import { useTeam, firstName, shortDate } from '../../lib/team'
import { SectionLabel } from '../layout/PageShell'

type Board = ReturnType<typeof useTeamTasks>

// Local date as YYYY-MM-DD (toISOString would be tomorrow's date on a US evening)
function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Soonest due first (so overdue comes first), undated last
function byDue(a: TeamTask, b: TeamTask) {
  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
  if (a.due_date || b.due_date) return a.due_date ? -1 : 1
  return a.created_at.localeCompare(b.created_at)
}

// Titles of the KPIs and rocks these tasks advance (they can belong to anyone)
function useLinkTitles(tasks: TeamTask[]) {
  const kpiIds = [...new Set(tasks.map(t => t.kpi_id).filter(Boolean) as string[])].sort().join(',')
  const rockIds = [...new Set(tasks.map(t => t.rock_id).filter(Boolean) as string[])].sort().join(',')
  const [titles, setTitles] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const next: Record<string, string> = {}
      if (kpiIds) {
        const { data } = await supabase.from('kpis').select('id, title').in('id', kpiIds.split(','))
        for (const k of data ?? []) next[`kpi:${k.id}`] = k.title
      }
      if (rockIds) {
        const { data } = await supabase.from('rocks').select('id, title').in('id', rockIds.split(','))
        for (const r of data ?? []) next[`rock:${r.id}`] = r.title
      }
      setTitles(next)
    }
    void load()
  }, [kpiIds, rockIds])

  return (t: TeamTask) => t.kpi_id
    ? { kind: 'KPI', title: titles[`kpi:${t.kpi_id}`] }
    : t.rock_id
      ? { kind: 'Rock', title: titles[`rock:${t.rock_id}`] }
      : { kind: 'Team Board', title: undefined, unlinked: true }
}

function DueLabel({ task }: { task: TeamTask }) {
  if (!task.due_date) return <span className="text-gray-400">No due date</span>
  const overdue = task.status !== 'done' && task.due_date < today()
  return (
    <span className={`tabular-nums ${overdue ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
      {overdue ? 'Overdue · ' : task.due_date === today() ? 'Today · ' : ''}{shortDate(task.due_date)}
    </span>
  )
}

function Advances({ link }: { link: { kind: string; title?: string; unlinked?: boolean } }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 max-w-full ${link.unlinked ? 'text-gray-600 bg-gray-100' : 'text-blue-700 bg-blue-50'}`}>
      <span className="font-semibold shrink-0">{link.kind}</span>
      {link.title && <span className="truncate">· {link.title}</span>}
    </span>
  )
}

function sourceLabel(t: TeamTask, creator: string) {
  return t.source === 'monday' ? 'Monday' : t.assigned_in_meeting ? 'Meeting' : `Added by ${creator}`
}

// This person's Team Board tasks. Monday items only reach the Team Board when
// they're tied to a KPI or rock (or flagged Team), so everyday to-dos stay in Monday.
function myTasks(board: Board, personId: string) {
  const assigned = board.tasks.filter(t => t.assigned_to === personId && !t.archived_month)
  const open = assigned.filter(t => t.status !== 'done').sort(byDue)
  const done = assigned.filter(t => t.status === 'done')
  return { open, done }
}

export function TopTasks({ board, personId }: { board: Board; personId: string }) {
  const { me } = useTeam()
  const { open } = myTasks(board, personId)
  const top = open.slice(0, 3)
  const linkOf = useLinkTitles(top)
  const isOwn = personId === me.id

  return (
    <section className="mb-5">
      <SectionLabel right={open.length > 3 && <span className="text-[11px] text-gray-400">{open.length - 3} more below</span>}>
        Top 3 up next
      </SectionLabel>
      {board.loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[1, 2, 3].map(i => <div key={i} className="card h-24 animate-pulse" />)}</div>
      ) : top.length === 0 ? (
        <div className="card p-5 text-sm text-gray-400">
          Nothing open. Tasks tied to {isOwn ? 'your' : 'their'} KPIs and rocks, or added on the Team Board, show up here, soonest due first.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {top.map((t, i) => (
            <div key={t.id} className="card p-4 flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: '#2563EB' }}>{i + 1}</span>
                <CalendarClock size={12} className="text-gray-400" />
                <DueLabel task={t} />
              </div>
              <p className="text-sm font-semibold text-gray-900 leading-snug">{t.title}</p>
              <div className="mt-auto"><Advances link={linkOf(t)} /></div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function MyTasksTable({ board, personId }: { board: Board; personId: string }) {
  const { me, byId, canEdit } = useTeam()
  const { open, done } = myTasks(board, personId)
  const rows = [...open, ...done]
  const linkOf = useLinkTitles(rows)
  const canEditTask = (t: TeamTask) => t.created_by === me.id || canEdit(t.assigned_to)
  const isOwn = personId === me.id

  return (
    <section className="mt-5">
      <SectionLabel right={<a href="#/team-board" className="text-xs font-semibold text-blue-600 hover:underline">Team Board</a>}>
        {isOwn ? 'My tasks' : 'Tasks'} · KPIs, rocks and Team Board
      </SectionLabel>
      {board.error && <p role="alert" className="text-xs text-red-600 mb-2">{board.error}</p>}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 border-b border-gray-100">
              <th className="w-10 px-4 py-3" aria-label="Done" />
              <th className="px-2 py-3">Task</th>
              <th className="px-2 py-3 w-36">Due</th>
              <th className="px-2 py-3">Advances</th>
              <th className="px-2 py-3 w-32">Source</th>
            </tr>
          </thead>
          <tbody>
            {board.loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No open tasks.</td></tr>
            ) : rows.map(t => {
              const isDone = t.status === 'done'
              return (
                <tr key={t.id} className={`border-b border-gray-50 last:border-0 ${isDone ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-2.5">
                    <input type="checkbox" checked={isDone} disabled={!canEditTask(t)}
                      onChange={e => board.updateTask(t.id, { status: e.target.checked ? 'done' : 'todo' })}
                      aria-label={isDone ? 'Mark not done' : 'Mark done'} className="w-4 h-4 accent-blue-600" />
                  </td>
                  <td className="px-2 py-2.5">
                    <p className={`font-semibold text-gray-900 ${isDone ? 'line-through' : ''}`}>{t.title}</p>
                    {t.description && <p className="text-xs text-gray-400 truncate max-w-[420px]">{t.description}</p>}
                  </td>
                  <td className="px-2 py-2.5 text-xs"><DueLabel task={t} /></td>
                  <td className="px-2 py-2.5 max-w-[320px]"><Advances link={linkOf(t)} /></td>
                  <td className="px-2 py-2.5 text-xs text-gray-400">{sourceLabel(t, firstName(byId(t.created_by)))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
