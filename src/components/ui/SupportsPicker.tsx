import type { SupportOptions } from '../../hooks/useGoalLinks'

interface Props {
  options: SupportOptions
  value: string
  onChange: (value: string) => void
  // KPIs can sit under a rock as well as a goal
  withRocks?: boolean
  // Small chip for list rows; full-width field for forms
  compact?: boolean
}

// "Supports goal" picker for rocks and KPIs
export function SupportsPicker({ options, value, onChange, withRocks, compact }: Props) {
  const current = value ? options.label(value) : null
  const cls = compact
    ? `text-[11px] rounded-full px-2 py-0.5 max-w-[220px] truncate cursor-pointer outline-none border-none appearance-none ${value ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-50 text-gray-400 hover:text-blue-600'}`
    : 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white'
  return (
    <select value={value} onChange={e => onChange(e.target.value)} aria-label="Supports" title={current ? `Supports: ${current}` : undefined} className={cls}>
      <option value="">{compact ? '+ Supports…' : 'Supports which goal? (optional)'}</option>
      {options.teamGoals.length > 0 && (
        <optgroup label="Team goals">
          {options.teamGoals.map(g => <option key={g.id} value={`team_goal:${g.id}`}>{compact ? '↑ ' : ''}{g.title}</option>)}
        </optgroup>
      )}
      {options.goals.length > 0 && (
        <optgroup label="Personal goals">
          {options.goals.map(g => <option key={g.id} value={`goal:${g.id}`}>{compact ? '↑ ' : ''}{g.title}</option>)}
        </optgroup>
      )}
      {withRocks && options.rocks.length > 0 && (
        <optgroup label="Rocks this quarter">
          {options.rocks.map(r => <option key={r.id} value={`rock:${r.id}`}>{compact ? '↑ ' : ''}{r.title}</option>)}
        </optgroup>
      )}
      {/* keep a saved link visible even if it's from another year or quarter */}
      {value && !current && <option value={value}>Linked item</option>}
    </select>
  )
}
