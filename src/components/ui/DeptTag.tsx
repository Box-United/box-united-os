import type { Department } from '../../types/database'
import { DEPARTMENTS, deptInfo } from '../../lib/departments'

const NONE = { color: '#4b5563', bg: '#f3f4f6' }

// Colored department chip; `noneLabel` shows a gray chip for untagged items
export function DeptTag({ dept, noneLabel }: { dept: Department | null | undefined; noneLabel?: string }) {
  const d = deptInfo(dept)
  if (!d && !noneLabel) return null
  const c = d ?? NONE
  return (
    <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-[0.08em] rounded-full px-2 py-0.5 shrink-0"
      style={{ color: c.color, background: c.bg }}>
      {d?.label ?? noneLabel}
    </span>
  )
}

// The same chip as a picker
export function DeptSelect({ value, onChange, noneLabel = 'Whole team', label = 'Department', only }: {
  value: Department | null | undefined
  onChange: (d: Department | null) => void
  noneLabel?: string
  label?: string
  // Limit the choices (the current value always stays listed)
  only?: Department[]
}) {
  const c = deptInfo(value) ?? NONE
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange((e.target.value || null) as Department | null)}
      aria-label={label}
      className="text-[10px] font-semibold uppercase tracking-[0.08em] rounded-full px-2 py-0.5 shrink-0 cursor-pointer outline-none border-none appearance-none"
      style={{ color: c.color, background: c.bg }}
    >
      <option value="" className="text-gray-800 bg-white normal-case">{noneLabel}</option>
      {DEPARTMENTS.filter(d => !only || only.includes(d.id) || d.id === value).map(d => <option key={d.id} value={d.id} className="text-gray-800 bg-white">{d.label}</option>)}
    </select>
  )
}
