import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Kpi, Rock } from '../../types/database'
import { useIndividualGoals } from '../../hooks/useIndividualGoals'
import { useGoalChildren } from '../../hooks/useGoalLinks'
import { SectionLabel } from '../layout/PageShell'
import { StatusPill } from '../ui/StatusPill'

// The dashboard's at-a-glance versions of goals, rocks and KPIs.
// "Details" swaps in the full (editable) section.

export function DetailsToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-expanded={open} className="flex items-center gap-0.5 text-xs font-semibold text-blue-600 hover:text-blue-700">
      {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {open ? 'Less' : 'Details'}
    </button>
  )
}

function Summary({ title, right, empty, children }: { title: ReactNode; right: ReactNode; empty: string | null; children: ReactNode }) {
  return (
    <section>
      <SectionLabel right={right}>{title}</SectionLabel>
      {empty ? <div className="card px-4 py-3 text-sm text-gray-400">{empty}</div> : children}
    </section>
  )
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function Rows({ children }: { children: ReactNode }) {
  return <ul className="card divide-y divide-gray-50">{children}</ul>
}

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span className="flex-1 min-w-0 truncate text-sm text-gray-800">{title}</span>
      {children}
    </li>
  )
}

// Each goal with its status and how much sits under it
export function GoalsSummary({ personId, year, right }: { personId: string; year: number; right: ReactNode }) {
  const { goals, loading } = useIndividualGoals(personId, year)
  const children = useGoalChildren('personal', goals.map(g => g.id))
  return (
    <Summary title={`Annual goals · ${year}`} right={right} empty={!loading && !goals.length ? `No annual goals for ${year} yet.` : null}>
      <Rows>
        {goals.map(g => {
          const u = children.under(g.id)
          return (
            <Row key={g.id} title={g.title}>
              <span className="hidden sm:inline text-[11px] text-gray-400 whitespace-nowrap">{plural(u.rocks.length, 'rock')} · {plural(u.kpis.length, 'KPI')}</span>
              <StatusPill status={g.status} small />
            </Row>
          )
        })}
      </Rows>
    </Summary>
  )
}

export function RocksSummary({ rocks, loading, title, right }: { rocks: Rock[]; loading: boolean; title: string; right: ReactNode }) {
  return (
    <Summary title={title} right={right} empty={!loading && !rocks.length ? 'No rocks this quarter yet.' : null}>
      <Rows>
        {rocks.map(r => (
          <Row key={r.id} title={r.title}><StatusPill status={r.status} small /></Row>
        ))}
      </Rows>
    </Summary>
  )
}

export function KpisSummary({ kpis, loading, title, right }: { kpis: Kpi[]; loading: boolean; title: string; right: ReactNode }) {
  return (
    <Summary title={title} right={right} empty={!loading && !kpis.length ? 'No KPIs this quarter yet.' : null}>
      <Rows>
        {kpis.map(k => (
          <Row key={k.id} title={k.title}>
            {k.target != null && <span className="text-xs font-semibold text-gray-600 tabular-nums">{(k.current ?? 0).toLocaleString()}/{k.target.toLocaleString()}</span>}
            <StatusPill status={k.status} small />
          </Row>
        ))}
      </Rows>
    </Summary>
  )
}
