import { AlertTriangle, ArrowRight } from 'lucide-react'
import type { Kpi, Rock, TeamTask } from '../../types/database'
import { SectionLabel } from '../layout/PageShell'

interface Props {
  personId: string
  tasks: TeamTask[]
  kpis: Kpi[]
  rocks: Rock[]
}

// This person's next 5 open Team Board tasks, by due date.
export function UpNext({ personId, tasks, kpis, rocks }: Props) {
  const open = tasks
    .filter(t => t.assigned_to === personId && t.status !== 'done' && !t.archived_month)
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
  const next = open.slice(0, 5)

  function goToBoard() {
    window.location.hash = '/team-board'
  }

  return (
    <section className="card p-5 self-start">
      <SectionLabel right={<span className="text-[11px] text-gray-400">from Team Board</span>}>Up next</SectionLabel>

      {next.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">No open team tasks. Nice.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {next.map(t => {
            const kpi = kpis.find(k => k.id === t.kpi_id)
            const rock = rocks.find(r => r.id === t.rock_id)
            const link = kpi ? `KPI · ${kpi.title}` : rock ? `Rock · ${rock.title}` : t.rock_id ? 'Rock' : t.kpi_id ? 'KPI' : null
            const d = t.due_date ? new Date(t.due_date + 'T00:00') : null
            const overdue = d && d < new Date(new Date().toDateString())
            return (
              <li key={t.id} className="flex gap-3 py-2.5 first:pt-0">
                <div
                  className="shrink-0 w-11 rounded-lg border text-center py-1 leading-tight"
                  style={{ borderColor: overdue ? '#fecaca' : '#e5e7eb', background: overdue ? '#fef2f2' : '#f8fafc' }}
                >
                  {d ? (
                    <>
                      <div className="text-sm font-bold text-gray-900 tabular-nums">{d.getDate()}</div>
                      <div className="text-[9px] font-semibold tracking-[0.12em] text-gray-400 uppercase">
                        {d.toLocaleDateString('en-US', { month: 'short' })}
                      </div>
                    </>
                  ) : (
                    <div className="text-[10px] text-gray-400 py-1">no date</div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 leading-snug">{t.title}</p>
                  {link ? (
                    <p className="text-xs text-gray-500 truncate">{link}</p>
                  ) : (
                    <p className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle size={11} /> Unaligned</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <button onClick={goToBoard} className="mt-3 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
        {open.length > 5 ? `View all ${open.length} on Team Board` : 'View all on Team Board'} <ArrowRight size={12} />
      </button>
    </section>
  )
}
