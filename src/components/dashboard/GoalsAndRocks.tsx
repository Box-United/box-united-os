import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useAnnualGoals } from '../../hooks/useAnnualGoals'
import type { useRocks } from '../../hooks/useRocks'
import type { RockStatus } from '../../types/database'
import { useTeam } from '../../lib/team'
import { SectionLabel } from '../layout/PageShell'
import { StatusPill } from '../ui/StatusPill'

interface Props {
  personId: string
  quarter: string
  rocks: ReturnType<typeof useRocks>
  editable: boolean
}

const ROCK_OPTIONS: RockStatus[] = ['on-track', 'off-track', 'done']

// Team annual goals (read-only here — edited on the Scorecard) + this person's rocks.
export function GoalsAndRocks({ personId, quarter, rocks, editable }: Props) {
  const { me } = useTeam()
  const year = Number(quarter.split(' ')[1])
  const { goals, loading: goalsLoading } = useAnnualGoals(year, me.id)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')

  function add() {
    if (!title.trim()) return
    rocks.addRock(personId, title.trim())
    setTitle('')
    setAdding(false)
  }

  return (
    <section>
      <SectionLabel
        right={editable && rocks.rocks.length < 3 && (
          <button onClick={() => setAdding(v => !v)} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
            <Plus size={13} /> Add rock
          </button>
        )}
      >
        Goals &amp; Rocks
      </SectionLabel>

      {adding && (
        <div className="card p-3 mb-3 flex flex-wrap gap-2">
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setAdding(false) }}
            placeholder={`New rock for ${quarter}…`}
            className="flex-1 min-w-[200px] text-sm outline-none border border-gray-200 rounded-lg px-3 py-2"
          />
          <button onClick={add} disabled={!title.trim()} className="text-xs font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-40" style={{ background: '#2563EB' }}>
            Save rock
          </button>
        </div>
      )}
      {rocks.error && <p className="text-xs text-red-600 mb-2">{rocks.error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {goalsLoading ? (
          <div className="card h-[88px] animate-pulse" />
        ) : goals.map(g => (
          <div key={g.id} className="card px-4 py-3 flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Team goal · {year}</span>
            <p className="text-sm font-semibold text-gray-900 leading-snug">{g.title}</p>
            <div className="mt-auto"><StatusPill status={g.status} small /></div>
          </div>
        ))}

        {rocks.rocks.map(r => (
          <div key={r.id} className="card px-4 py-3 flex flex-col gap-2 group" style={{ boxShadow: 'inset 0 0 0 1px #dbeafe, 0 1px 3px rgba(0,0,0,.07)' }}>
            <div className="flex items-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600">Rock · {quarter.split(' ')[0]}</span>
              {editable && (
                <button onClick={() => rocks.deleteRock(r.id)} aria-label="Delete rock" className="ml-auto opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-900 leading-snug">{r.title}</p>
            <div className="mt-auto">
              <StatusPill
                status={r.status}
                small
                options={editable ? ROCK_OPTIONS : undefined}
                onChange={editable ? s => rocks.updateRockStatus(r.id, s as RockStatus) : undefined}
              />
            </div>
          </div>
        ))}

        {!goalsLoading && !rocks.loading && goals.length === 0 && rocks.rocks.length === 0 && (
          <div className="card px-4 py-5 sm:col-span-2 xl:col-span-4 text-sm text-gray-400">
            No team goals for {year} or rocks for {quarter} yet. Team goals are set on the Scorecard.
          </div>
        )}
      </div>
    </section>
  )
}
