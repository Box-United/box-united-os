import { useState, type ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useIndividualGoals } from '../../hooks/useIndividualGoals'
import type { KpiStatus } from '../../types/database'
import { SectionLabel } from '../layout/PageShell'
import { StatusPill } from '../ui/StatusPill'
import { PROGRESS_OPTIONS } from '../../lib/statuses'
import { GoalRollup } from '../scorecard/GoalRollup'
import { useGoalChildren } from '../../hooks/useGoalLinks'

const THIS_YEAR = new Date().getFullYear()

interface Props {
  personId: string
  editable: boolean
  // Extra control for the section header (e.g. the dashboard's Less toggle)
  extra?: ReactNode
}

// This person's own goals for the year. Team goals live on the Scorecard.
export function IndividualGoals({ personId, editable, extra }: Props) {
  const [year, setYear] = useState(THIS_YEAR)
  const { goals, loading, error, clearError, addGoal, updateGoal, deleteGoal } = useIndividualGoals(personId, year)
  const children = useGoalChildren('personal', goals.map(g => g.id))
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')

  function add() {
    if (!title.trim()) return
    addGoal(title.trim())
    setTitle('')
    setAdding(false)
  }

  return (
    <section className="card p-5 self-start">
      <SectionLabel
        right={
          <div className="flex items-center gap-2">
            <select value={year} onChange={e => setYear(Number(e.target.value))} aria-label="Year"
              className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1">
              {[THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {editable && (
              <button onClick={() => setAdding(v => !v)} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
                <Plus size={13} /> Add goal
              </button>
            )}
            {extra}
          </div>
        }
      >
        Annual goals
      </SectionLabel>

      {error && (
        <div role="alert" className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
          <span className="flex-1">{error}</span>
          <button onClick={clearError} className="font-semibold hover:underline">Dismiss</button>
        </div>
      )}

      {adding && (
        <div className="flex gap-2 mb-3">
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setAdding(false) }}
            placeholder={`A goal of yours for ${year}…`}
            className="flex-1 min-w-0 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
          />
          <button onClick={add} disabled={!title.trim()} className="text-xs font-semibold text-white px-3 rounded-lg disabled:opacity-40" style={{ background: '#2563EB' }}>
            Save
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : goals.length === 0 ? (
        <p className="text-sm text-gray-400 py-1">
          {editable ? `No personal goals for ${year} yet. Add the few things you want to accomplish this year.` : `No personal goals for ${year} yet.`}
        </p>
      ) : (
        <ul className="space-y-2">
          {goals.map(g => (
            <li key={g.id} className="rounded-lg border border-gray-100 px-3 py-2.5 group">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm font-medium text-gray-900 leading-snug">{g.title}</span>
                <StatusPill
                  status={g.status}
                  small
                  options={editable ? PROGRESS_OPTIONS : undefined}
                  onChange={editable ? s => updateGoal(g.id, { status: s as KpiStatus }) : undefined}
                />
                {editable && (
                  <button onClick={() => deleteGoal(g.id)} aria-label="Delete goal" className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <GoalRollup {...children.under(g.id)} />
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-gray-400 mt-3">These carry into your mid-year and end-of-year reviews.</p>
    </section>
  )
}
