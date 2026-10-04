import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { useRocks } from '../../hooks/useRocks'
import type { Profile, RockStatus } from '../../types/database'
import { useTeam, displayName } from '../../lib/team'
import { Avatar } from '../ui/Avatar'
import { StatusPill } from '../ui/StatusPill'

const ROCK_OPTIONS: RockStatus[] = ['on-track', 'off-track', 'done']

interface Props {
  person: Profile
  rocks: ReturnType<typeof useRocks>
  quarter: string
  showName?: boolean
}

// Aim for fewer than this many rocks a quarter; it's a guide, not a limit
const ROCK_TARGET = 6

// One person's rocks for a quarter
export function RockCard({ person, rocks, quarter, showName = true }: Props) {
  const { canEdit, openDashboard } = useTeam()
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const mine = rocks.rocks.filter(r => r.user_id === person.id)
  const editable = canEdit(person.id)
  const over = mine.length >= ROCK_TARGET

  function save() {
    if (!title.trim()) return
    rocks.addRock(person.id, title.trim())
    setTitle('')
    setAdding(false)
  }

  return (
    <div className="card p-4">
      {showName && (
        <div className="flex items-center gap-2 mb-3">
          <Avatar profile={person} size={28} />
          <button onClick={() => openDashboard(person.id)} className="text-sm font-semibold text-gray-900 hover:text-blue-600 truncate">{displayName(person)}</button>
          <span className={`text-xs ml-auto ${over ? 'text-amber-700 font-semibold' : 'text-gray-400'}`} title={`Aim for fewer than ${ROCK_TARGET}`}>{mine.length} rock{mine.length === 1 ? '' : 's'}</span>
        </div>
      )}
      <ul className="space-y-2">
        {mine.map(r => (
          <li key={r.id} className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 group">
            <span className="flex-1 text-sm text-gray-800 leading-snug">{r.title}</span>
            <StatusPill status={r.status} small options={editable ? ROCK_OPTIONS : undefined}
              onChange={editable ? s => rocks.updateRockStatus(r.id, s as RockStatus) : undefined} />
            {editable && (
              <button onClick={() => rocks.deleteRock(r.id)} aria-label="Delete rock" className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400">
                <Trash2 size={12} />
              </button>
            )}
          </li>
        ))}
        {mine.length === 0 && !adding && <li className="text-xs text-gray-400">No rocks for {quarter}.</li>}
      </ul>
      {!showName && <p className="text-[11px] text-gray-400 mt-2">{mine.length} rock{mine.length === 1 ? '' : 's'} this quarter · aim for fewer than {ROCK_TARGET}</p>}
      {over && <p className="text-[11px] text-amber-700 mt-1">That's {mine.length} rocks. Fewer than {ROCK_TARGET} keeps the quarter focused.</p>}
      {editable && (
        adding ? (
          <div className="flex gap-2 mt-2">
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setAdding(false) }}
              placeholder="New rock…" className="flex-1 min-w-0 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none" />
            <button onClick={save} className="text-xs font-semibold text-white px-3 rounded-lg" style={{ background: '#2563EB' }}>Add</button>
          </div>
        ) : (
          <button onClick={() => { setAdding(true); setTitle('') }} className="mt-2 flex items-center gap-1 text-xs font-semibold text-blue-600">
            <Plus size={12} /> Add rock
          </button>
        )
      )}
    </div>
  )
}

// Q1–Q4 picker used next to rock sections
export function QuarterPills({ q, onChange }: { q: number; onChange: (q: number) => void }) {
  return (
    <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100">
      {[1, 2, 3, 4].map(n => (
        <button key={n} onClick={() => onChange(n)} className="text-xs font-semibold px-2.5 py-1 rounded-lg"
          style={{ background: q === n ? '#2563EB' : 'transparent', color: q === n ? 'white' : '#6b7280' }}>
          Q{n}
        </button>
      ))}
    </div>
  )
}
