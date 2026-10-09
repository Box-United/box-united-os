import { Fragment, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Repeat, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { useTeamTasks } from '../../hooks/useTeamTasks'
import { useRocks } from '../../hooks/useRocks'
import { useKpis } from '../../hooks/useKpis'
import { useIndividualGoals } from '../../hooks/useIndividualGoals'
import { useAnnualGoals } from '../../hooks/useAnnualGoals'
import type { RecurringTask, TeamTask } from '../../types/database'
import { useTeam, firstName, shortDate, currentQuarter, quarterLabel, monthKey, monthLabel } from '../../lib/team'
import { describeSchedule, doneMonth, isoWeekday, MONTH_WEEKS, pastMonths, weekOfMonth, WEEKDAYS } from '../../lib/tasks'
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
    if (l) return { kind: l.kind, title: titles[k], up: ups[k] }
    return { kind: t.on_team_board === false ? 'Not linked' : 'Team Board', title: undefined, unlinked: true }
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
  return t.source === 'monday' ? 'Monday' : t.recurring_id ? 'Repeats' : t.assigned_in_meeting ? 'Meeting' : `Added by ${creator}`
}

// Everything assigned to this person: open tasks, and finished ones (which
// file themselves under the month they were done)
function myTasks(board: Board, personId: string) {
  const assigned = board.tasks.filter(t => t.assigned_to === personId)
  const open = assigned.filter(t => t.status !== 'done').sort(byDue)
  const done = assigned.filter(t => t.status === 'done')
  return { open, done }
}

export function MyTasksTable({ board, personId }: { board: Board; personId: string }) {
  const { me, canEdit } = useTeam()
  const { open, done } = myTasks(board, personId)
  const [showDone, setShowDone] = useState(false)
  const [month, setMonth] = useState(monthKey())
  const months = [monthKey(), ...pastMonths(done)]
  const doneShown = showDone ? done.filter(t => doneMonth(t) === month) : []
  const doneThisMonth = done.filter(t => doneMonth(t) === monthKey()).length
  const linkOf = useLinkTitles([...open, ...doneShown])
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
        {isOwn ? 'My tasks' : 'Tasks'}
      </SectionLabel>
      {board.error && <p role="alert" className="text-xs text-red-600 mb-2">{board.error}</p>}
      {adding && <AddTask board={board} personId={personId} onClose={() => setAdding(false)} />}
      <TaskTable board={board} rows={open} linkOf={linkOf} loading={board.loading} empty="No open tasks." />

      <div className="mt-3">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowDone(v => !v)} aria-expanded={showDone}
            className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900">
            {showDone ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Completed{doneThisMonth ? ` this month (${doneThisMonth})` : ''}
          </button>
          {showDone && months.length > 1 && (
            <select value={month} onChange={e => setMonth(e.target.value)} aria-label="Month"
              className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1">
              {months.map(m => <option key={m} value={m}>{m === monthKey() ? `This month (${monthLabel(m)})` : monthLabel(m)}</option>)}
            </select>
          )}
        </div>
        {showDone && (
          <div className="mt-2">
            <TaskTable board={board} rows={doneShown} linkOf={linkOf} loading={false} empty={`Nothing completed in ${monthLabel(month)}.`} />
          </div>
        )}
      </div>
    </section>
  )
}

type LinkOf = ReturnType<typeof useLinkTitles>

function TaskTable({ board, rows, linkOf, loading, empty }: { board: Board; rows: TeamTask[]; linkOf: LinkOf; loading: boolean; empty: string }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm min-w-[680px]">
        <thead>
          <tr className="text-left text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 border-b border-gray-100">
            <th className="w-10 px-4 py-3" aria-label="Done" />
            <th className="px-2 py-3">Task</th>
            <th className="px-2 py-3 w-36">Due</th>
            <th className="px-2 py-3">Supports</th>
            <th className="px-2 py-3 w-32">Source</th>
            <th className="w-10" aria-label="Delete" />
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">{empty}</td></tr>
          ) : rows.map(t => (
            <TaskTableRow key={t.id} task={t} board={board} link={linkOf(t)}
              rule={t.recurring_id ? board.recurring.find(r => r.id === t.recurring_id) : undefined} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TaskTableRow({ task: t, board, link, rule }: { task: TeamTask; board: Board; link: ReturnType<LinkOf>; rule?: RecurringTask }) {
  const { me, byId, canEdit } = useTeam()
  const [confirming, setConfirming] = useState(false)
  const editable = t.created_by === me.id || canEdit(t.assigned_to)
  const isDone = t.status === 'done'

  return (
    <Fragment>
      <tr className={`border-b border-gray-50 last:border-0 group ${isDone ? 'opacity-60' : ''}`}>
        <td className="px-4 py-2.5">
          <input type="checkbox" checked={isDone} disabled={!editable}
            onChange={e => board.updateTask(t.id, { status: e.target.checked ? 'done' : 'todo' })}
            aria-label={isDone ? 'Mark not done' : 'Mark done'} className="w-4 h-4 accent-blue-600" />
        </td>
        <td className="px-2 py-2.5">
          <p className={`font-semibold text-gray-900 ${isDone ? 'line-through' : ''}`}>{t.title}</p>
          {t.description && <p className="text-xs text-gray-400 truncate max-w-[420px]">{t.description}</p>}
          {rule && (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 mt-0.5">
              <Repeat size={10} /> {describeSchedule(rule)}
            </span>
          )}
        </td>
        <td className="px-2 py-2.5 text-xs"><DueLabel task={t} /></td>
        <td className="px-2 py-2.5 max-w-[320px]"><Advances link={link} /></td>
        <td className="px-2 py-2.5 text-xs text-gray-400">{sourceLabel(t, firstName(byId(t.created_by)))}</td>
        <td className="px-2 py-2.5">
          {editable && !confirming && (
            <button onClick={() => setConfirming(true)} aria-label={`Delete ${t.title}`}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-300 hover:text-red-400">
              <Trash2 size={13} />
            </button>
          )}
        </td>
      </tr>
      {confirming && (
        <tr className="bg-red-50/40 border-b border-red-100">
          <td colSpan={6} className="px-4 py-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-700 mr-auto">
                Delete “{t.title}”? It won't count as done.{t.recurring_id && rule ? ' It repeats: delete just this one, or every open one and stop repeating?' : ''}
              </span>
              <button onClick={() => setConfirming(false)} className="text-gray-500 px-2 py-1">Keep</button>
              <button onClick={() => board.deleteTeamTask(t.id)} className="font-semibold text-red-600 border border-red-200 bg-white rounded-lg px-2.5 py-1">
                {t.recurring_id && rule ? 'Delete this one' : 'Delete'}
              </button>
              {t.recurring_id && rule && (
                <button onClick={() => board.deleteSeries(rule.id)} className="font-semibold text-white bg-red-600 rounded-lg px-2.5 py-1">
                  Delete all and stop repeating
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  )
}

type RepeatKind = 'none' | 'weekly' | 'monthly'
type Ends = 'never' | 'on' | 'after'

// Add a task by hand. Linking it to a rock, KPI or goal (or the Team Board) is optional.
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

  // Repeating, like a calendar invite
  const [repeat, setRepeat] = useState<RepeatKind>('none')
  const [everyWeeks, setEveryWeeks] = useState(1)
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [monthWeek, setMonthWeek] = useState(1)
  const [monthDay, setMonthDay] = useState(5)
  const [ends, setEnds] = useState<Ends>('never')
  const [endsOn, setEndsOn] = useState('')
  const [count, setCount] = useState('10')
  const start = due || today()
  const repeats = repeat !== 'none'
  const scheduleOk = !repeats || (
    (repeat === 'monthly' || weekdays.length > 0)
    && (ends !== 'on' || (endsOn !== '' && endsOn >= start))
    && (ends !== 'after' || Number(count) >= 1)
  )
  const ok = title.trim() && scheduleOk && !saving

  function pickRepeat(r: RepeatKind) {
    setRepeat(r)
    // Start from the weekday of the first date
    if (r === 'weekly' && weekdays.length === 0) setWeekdays([isoWeekday(start)])
    if (r === 'monthly') {
      setMonthDay(isoWeekday(start))
      setMonthWeek(weekOfMonth(start))
    }
  }

  async function save() {
    if (!ok) return
    setSaving(true)
    const [kind, id] = link.split(':')
    const links = {
      rock_id: kind === 'rock' ? id : null,
      kpi_id: kind === 'kpi' ? id : null,
      goal_id: kind === 'goal' ? id : null,
      team_goal_id: kind === 'team_goal' ? id : null,
    }
    const saved = repeats
      ? await board.addRecurring({
        title: title.trim(),
        description: null,
        assigned_to: personId,
        created_by: me.id,
        ...links,
        on_team_board: team,
        frequency: repeat,
        every_weeks: repeat === 'weekly' ? everyWeeks : 1,
        weekdays: repeat === 'weekly' ? [...weekdays].sort((a, b) => a - b) : [monthDay],
        month_week: repeat === 'monthly' ? monthWeek : null,
        starts_on: start,
        ends_on: ends === 'on' ? endsOn : null,
        max_count: ends === 'after' ? Math.round(Number(count)) : null,
      })
      : await board.addTeamTask({
        title: title.trim(),
        assigned_to: personId,
        due_date: due || null,
        description: null,
        assigned_in_meeting: false,
        rock_id: links.rock_id,
        kpi_id: links.kpi_id,
        // only sent when used, so rock / KPI tasks still save before migration 013
        ...(links.goal_id ? { goal_id: links.goal_id } : {}),
        ...(links.team_goal_id ? { team_goal_id: links.team_goal_id } : {}),
        ...(team ? {} : { on_team_board: false }),
      }, me.id)
    setSaving(false)
    if (saved) onClose()
  }

  const field = 'text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white'
  const small = 'text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white'

  return (
    <div className="card p-4 mb-3 border border-blue-100">
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_2fr] gap-3">
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose() }}
          placeholder="Task…" className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
        <input type="date" value={due} onChange={e => setDue(e.target.value)} aria-label={repeats ? 'Starts' : 'Due date'} title={repeats ? 'Starts' : 'Due date'}
          className={field} />
        <select value={link} onChange={e => setLink(e.target.value)} aria-label="What it supports"
          className={field} style={{ color: link ? '#1e293b' : '#6b7280' }}>
          <option value="">Supports a rock, KPI or goal? (optional)</option>
          {rocks.length > 0 && <optgroup label={`Rocks · ${quarterLabel(cq.q, year)}`}>{rocks.map(r => <option key={r.id} value={`rock:${r.id}`}>{r.title}</option>)}</optgroup>}
          {kpis.length > 0 && <optgroup label="KPIs">{kpis.map(k => <option key={k.id} value={`kpi:${k.id}`}>{k.title}</option>)}</optgroup>}
          {goals.length > 0 && <optgroup label={`Annual goals · ${year}`}>{goals.map(g => <option key={g.id} value={`goal:${g.id}`}>{g.title}</option>)}</optgroup>}
          {teamGoals.length > 0 && <optgroup label={`Team goals · ${year}`}>{teamGoals.map(g => <option key={g.id} value={`team_goal:${g.id}`}>{g.title}</option>)}</optgroup>}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-gray-700">
        <Repeat size={13} className="text-gray-400" />
        <select value={repeat} onChange={e => pickRepeat(e.target.value as RepeatKind)} aria-label="Repeat" className={small}>
          <option value="none">Doesn't repeat</option>
          <option value="weekly">Repeats weekly</option>
          <option value="monthly">Repeats monthly</option>
        </select>

        {repeat === 'weekly' && (
          <>
            <select value={everyWeeks} onChange={e => setEveryWeeks(Number(e.target.value))} aria-label="How often" className={small}>
              <option value={1}>every week</option>
              {[2, 3, 4].map(n => <option key={n} value={n}>every {n} weeks</option>)}
            </select>
            <span>on</span>
            <div className="flex gap-1" role="group" aria-label="Days">
              {WEEKDAYS.map(w => {
                const on = weekdays.includes(w.n)
                return (
                  <button key={w.n} type="button" aria-pressed={on} aria-label={w.short} title={w.short}
                    onClick={() => setWeekdays(ds => on ? ds.filter(d => d !== w.n) : [...ds, w.n])}
                    className="w-7 h-7 rounded-full text-[11px] font-semibold"
                    style={{ background: on ? '#2563EB' : '#f3f4f6', color: on ? 'white' : '#4b5563' }}>
                    {w.letter}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {repeat === 'monthly' && (
          <>
            <span>on the</span>
            <select value={monthWeek} onChange={e => setMonthWeek(Number(e.target.value))} aria-label="Which week" className={small}>
              {MONTH_WEEKS.map(m => <option key={m.n} value={m.n}>{m.label}</option>)}
            </select>
            <select value={monthDay} onChange={e => setMonthDay(Number(e.target.value))} aria-label="Day" className={small}>
              {WEEKDAYS.map(w => <option key={w.n} value={w.n}>{w.short}</option>)}
            </select>
            <span>of each month</span>
          </>
        )}

        {repeats && (
          <>
            <span className="ml-2">Ends</span>
            <select value={ends} onChange={e => setEnds(e.target.value as Ends)} aria-label="Ends" className={small}>
              <option value="never">never</option>
              <option value="on">on</option>
              <option value="after">after</option>
            </select>
            {ends === 'on' && <input type="date" value={endsOn} min={start} onChange={e => setEndsOn(e.target.value)} aria-label="End date" className={small} />}
            {ends === 'after' && (
              <>
                <input value={count} onChange={e => setCount(e.target.value)} inputMode="numeric" aria-label="How many times" className={`${small} w-14`} />
                <span>times</span>
              </>
            )}
          </>
        )}
      </div>
      {repeats && (
        <p className="text-[11px] text-gray-400 mt-1.5">
          Starts {shortDate(start)}. The next one always shows here; if one is still open when the next comes due, both stay until they're done.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 mt-3">
        <label className="flex items-center gap-1.5 text-xs text-gray-700">
          <input type="checkbox" checked={team} onChange={e => setTeam(e.target.checked)} className="accent-blue-600" /> Also put it on the Team Board
        </label>
        {repeat === 'weekly' && weekdays.length === 0 && <span className="text-[11px] text-amber-700">Pick at least one day.</span>}
        <div className="ml-auto flex gap-2">
          <button onClick={onClose} className="text-xs text-gray-500 px-3 py-1.5">Cancel</button>
          <button onClick={save} disabled={!ok} className="text-xs font-semibold text-white px-4 py-1.5 rounded-lg disabled:opacity-40" style={{ background: '#2563EB' }}>
            {saving ? 'Saving…' : repeats ? 'Add repeating task' : 'Add task'}
          </button>
        </div>
      </div>
    </div>
  )
}
