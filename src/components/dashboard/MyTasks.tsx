import { useEffect, useState } from 'react'
import { CalendarClock, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { useTeamTasks } from '../../hooks/useTeamTasks'
import { useRocks } from '../../hooks/useRocks'
import { useKpis } from '../../hooks/useKpis'
import { useIndividualGoals } from '../../hooks/useIndividualGoals'
import { useAnnualGoals } from '../../hooks/useAnnualGoals'
import type { TeamTask } from '../../types/database'
import { useTeam, firstName, shortDate, currentQuarter, quarterLabel } from '../../lib/team'
import { SectionLabel } from '../layout/PageShell'
import { useGoalDataVersion } from '../../lib/linkEvents'

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

// What each task supports: a rock, KPI, personal goal or team goal (any owner's)
const LINKS = [
  { field: 'rock_id', table: 'rocks', kind: 'Rock' },
  { field: 'kpi_id', table: 'kpis', kind: 'KPI' },
  { field: 'goal_id', table: 'individual_goals', kind: 'Goal' },
  { field: 'team_goal_id', table: 'annual_goals', kind: 'Team goal' },
] as const

// Where a linked rock or KPI rolls up to: its goal, or (for a KPI) its rock's goal
type Up = { team_goal_id?: string | null; goal_id?: string | null; rock_id?: string | null }

function useLinkTitles(tasks: TeamTask[]) {
  const key = LINKS.map(l => [...new Set(tasks.map(t => t[l.field]).filter(Boolean) as string[])].sort().join(',')).join('|')
  const [titles, setTitles] = useState<Record<string, string>>({})
  const [ups, setUps] = useState<Record<string, string>>({})
  const version = useGoalDataVersion()

  useEffect(() => {
    async function load() {
      const ids = key.split('|')
      const next: Record<string, string> = {}
      const parents: Record<string, Up> = {}
      for (const [i, l] of LINKS.entries()) {
        if (!ids[i]) continue
        const list = ids[i].split(',')
        // rocks and KPIs also say what they support (migration 014); fall back without it
        const withParents = l.table === 'rocks' ? 'id, title, team_goal_id, goal_id' : l.table === 'kpis' ? 'id, title, team_goal_id, goal_id, rock_id' : null
        const rows = (cols: string) =>
          supabase.from(l.table).select(cols).in('id', list) as unknown as Promise<{ data: ({ id: string; title: string } & Up)[] | null; error: unknown }>
        let res = await rows(withParents ?? 'id, title')
        if (res.error && withParents) res = await rows('id, title')
        for (const row of res.data ?? []) {
          next[`${l.field}:${row.id}`] = row.title
          if (withParents) parents[`${l.field}:${row.id}`] = row
        }
      }
      setTitles(next)

      // KPIs under a rock roll up through that rock's goal
      const rockIds = Object.values(parents).map(p => p.rock_id).filter(Boolean) as string[]
      const rockParents: Record<string, Up> = {}
      if (rockIds.length) {
        const { data } = await supabase.from('rocks').select('id, team_goal_id, goal_id').in('id', rockIds)
        for (const r of data ?? []) rockParents[r.id] = r
      }
      const goalOf = (p: Up): Up => (p.rock_id ? rockParents[p.rock_id] ?? {} : p)
      const teamIds = [...new Set(Object.values(parents).map(p => goalOf(p).team_goal_id).filter(Boolean) as string[])]
      const goalIds = [...new Set(Object.values(parents).map(p => goalOf(p).goal_id).filter(Boolean) as string[])]
      const goalTitle: Record<string, string> = {}
      if (teamIds.length) for (const g of (await supabase.from('annual_goals').select('id, title').in('id', teamIds)).data ?? []) goalTitle[`t:${g.id}`] = g.title
      if (goalIds.length) for (const g of (await supabase.from('individual_goals').select('id, title').in('id', goalIds)).data ?? []) goalTitle[`g:${g.id}`] = g.title
      const nextUps: Record<string, string> = {}
      for (const [k, p] of Object.entries(parents)) {
        const g = goalOf(p)
        const t = g.team_goal_id ? goalTitle[`t:${g.team_goal_id}`] : g.goal_id ? goalTitle[`g:${g.goal_id}`] : undefined
        if (t) nextUps[k] = t
      }
      setUps(nextUps)
    }
    void load()
  }, [key, version])

  return (t: TeamTask) => {
    const l = LINKS.find(x => t[x.field])
    const k = l ? `${l.field}:${t[l.field]}` : ''
    return l
      ? { kind: l.kind, title: titles[k], up: ups[k] }
      : { kind: 'Team Board', title: undefined, unlinked: true }
  }
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

function Advances({ link }: { link: { kind: string; title?: string; up?: string; unlinked?: boolean } }) {
  return (
    <span className="inline-flex flex-col items-start gap-0.5 max-w-full">
      <span className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 max-w-full ${link.unlinked ? 'text-gray-600 bg-gray-100' : 'text-blue-700 bg-blue-50'}`}>
        <span className="font-semibold shrink-0">{link.kind}</span>
        {link.title && <span className="truncate">· {link.title}</span>}
      </span>
      {link.up && <span className="text-[11px] text-indigo-700 truncate max-w-full pl-2">↑ {link.up}</span>}
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
  const [adding, setAdding] = useState(false)

  return (
    <section className="mt-5">
      <SectionLabel right={
        <div className="flex items-center gap-3">
          {canEdit(personId) && (
            <button onClick={() => setAdding(v => !v)} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
              <Plus size={13} /> Add task
            </button>
          )}
          <a href="#/team-board" className="text-xs font-semibold text-blue-600 hover:underline">Team Board</a>
        </div>
      }>
        {isOwn ? 'My tasks' : 'Tasks'} · rocks, KPIs, goals and Team Board
      </SectionLabel>
      {board.error && <p role="alert" className="text-xs text-red-600 mb-2">{board.error}</p>}
      {adding && <AddTask board={board} personId={personId} onClose={() => setAdding(false)} />}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 border-b border-gray-100">
              <th className="w-10 px-4 py-3" aria-label="Done" />
              <th className="px-2 py-3">Task</th>
              <th className="px-2 py-3 w-36">Due</th>
              <th className="px-2 py-3">Supports</th>
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

// Add a task by hand. It has to support a rock, KPI or goal, or go on the Team Board.
function AddTask({ board, personId, onClose }: { board: Board; personId: string; onClose: () => void }) {
  const { me } = useTeam()
  const cq = currentQuarter()
  const year = cq.year
  const { rocks } = useRocks(quarterLabel(cq.q, year), personId)
  const { kpis } = useKpis(personId)
  const { goals } = useIndividualGoals(personId, year)
  const teamGoals = useAnnualGoals(year, me.id).goals
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [link, setLink] = useState('')
  const [team, setTeam] = useState(false)
  const [saving, setSaving] = useState(false)
  const ok = title.trim() && (link || team) && !saving

  async function save() {
    if (!ok) return
    setSaving(true)
    const [kind, id] = link.split(':')
    const saved = await board.addTeamTask({
      title: title.trim(),
      assigned_to: personId,
      due_date: due || null,
      description: null,
      assigned_in_meeting: false,
      rock_id: kind === 'rock' ? id : null,
      kpi_id: kind === 'kpi' ? id : null,
      // only sent when used, so rock / KPI tasks still save before migration 013
      ...(kind === 'goal' ? { goal_id: id } : {}),
      ...(kind === 'team_goal' ? { team_goal_id: id } : {}),
      ...(team ? {} : { on_team_board: false }),
    }, me.id)
    setSaving(false)
    if (saved) onClose()
  }

  return (
    <div className="card p-4 mb-3 border border-blue-100">
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_2fr] gap-3">
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose() }}
          placeholder="Task…" className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
        <input type="date" value={due} onChange={e => setDue(e.target.value)} aria-label="Due date"
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white" />
        <select value={link} onChange={e => setLink(e.target.value)} aria-label="What it supports"
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white" style={{ color: link ? '#1e293b' : '#2563EB' }}>
          <option value="">Which rock, KPI or goal does it support?</option>
          {rocks.length > 0 && <optgroup label={`Rocks · ${quarterLabel(cq.q, year)}`}>{rocks.map(r => <option key={r.id} value={`rock:${r.id}`}>{r.title}</option>)}</optgroup>}
          {kpis.length > 0 && <optgroup label="KPIs">{kpis.map(k => <option key={k.id} value={`kpi:${k.id}`}>{k.title}</option>)}</optgroup>}
          {goals.length > 0 && <optgroup label={`Annual goals · ${year}`}>{goals.map(g => <option key={g.id} value={`goal:${g.id}`}>{g.title}</option>)}</optgroup>}
          {teamGoals.length > 0 && <optgroup label={`Team goals · ${year}`}>{teamGoals.map(g => <option key={g.id} value={`team_goal:${g.id}`}>{g.title}</option>)}</optgroup>}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <label className="flex items-center gap-1.5 text-xs text-gray-700">
          <input type="checkbox" checked={team} onChange={e => setTeam(e.target.checked)} className="accent-blue-600" /> Also put it on the Team Board
        </label>
        {!link && !team && title.trim() && <span className="text-[11px] text-amber-700">Pick what it supports, or put it on the Team Board.</span>}
        <div className="ml-auto flex gap-2">
          <button onClick={onClose} className="text-xs text-gray-500 px-3 py-1.5">Cancel</button>
          <button onClick={save} disabled={!ok} className="text-xs font-semibold text-white px-4 py-1.5 rounded-lg disabled:opacity-40" style={{ background: '#2563EB' }}>
            {saving ? 'Saving…' : 'Add task'}
          </button>
        </div>
      </div>
    </div>
  )
}
