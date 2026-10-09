import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, EyeOff, FileText, Lock, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePerformanceReview, useReviewHistory, useReviewStatuses, reviewStatus } from '../hooks/usePerformanceReview'
import { useIndividualGoals } from '../hooks/useIndividualGoals'
import { useKpis, kpiPeriodLabel } from '../hooks/useKpis'
import type { Profile, ReviewItem, ReviewPeriod, Rock } from '../types/database'
import { useTeam, displayName, firstName, shortDate } from '../lib/team'
import { PageShell, PageHeader, SectionLabel } from '../components/layout/PageShell'
import { Avatar } from '../components/ui/Avatar'
import { StatusPill } from '../components/ui/StatusPill'
import { AutoTextarea } from '../components/ui/AutoTextarea'

const THIS_YEAR = new Date().getFullYear()
const PERIODS: { id: ReviewPeriod; label: string; quarters: number[] }[] = [
  { id: 'mid_year', label: 'Mid-year', quarters: [1, 2] },
  { id: 'end_of_year', label: 'End of year', quarters: [1, 2, 3, 4] },
]

const REFLECTION: { id: string; label: string; help: (p: ReviewPeriod) => string }[] = [
  { id: 'wins', label: 'Wins and accomplishments', help: p => p === 'mid_year' ? 'What are you proudest of so far this year?' : 'What are you proudest of this year?' },
  { id: 'challenges', label: 'Challenges', help: () => 'What got in the way, and how did you handle it?' },
  { id: 'growth', label: 'Areas for growth', help: () => 'Where do you want to get stronger?' },
  { id: 'development', label: 'Professional development', help: () => 'What do you want to learn or build next?' },
  { id: 'support', label: 'Support needed', help: () => 'What would help you do your best work?' },
]

export function PerformanceReviews() {
  const { me, profiles, canReview } = useTeam()
  const people = [me, ...profiles.filter(p => p.id !== me.id && canReview(p))]

  const [year, setYear] = useState(THIS_YEAR)
  const [period, setPeriod] = useState<ReviewPeriod>(new Date().getMonth() < 9 ? 'mid_year' : 'end_of_year')
  const [personId, setPersonId] = useState(me.id)
  const statuses = useReviewStatuses(year)

  const person = people.find(p => p.id === personId) ?? me
  const history = useReviewHistory(person.id)
  const years = [...new Set([THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1, ...history.map(r => r.year)])].sort((a, b) => a - b)
  const exec = profiles.find(p => p.role === 'executive_director')
  const reviewerId = person.manager_id ?? (person.role !== 'executive_director' ? exec?.id ?? null : null)

  return (
    <PageShell>
      <PageHeader
        icon={<FileText size={18} className="text-blue-600" />}
        title="Performance Reviews"
        subtitle={people.length > 1
          ? 'Mid-year and end-of-year reviews. Each review is visible only to that person, their manager and the executive director.'
          : 'Your mid-year and end-of-year reviews. Only you, your manager and the executive director can see them.'}
        actions={
          <select value={year} onChange={e => setYear(Number(e.target.value))} aria-label="Year"
            className="text-sm bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        }
      />

      {/* People you can open */}
      {people.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
          {people.map(p => {
            const active = p.id === person.id
            return (
              <button key={p.id} onClick={() => setPersonId(p.id)}
                className="card px-4 py-3 text-left transition-shadow"
                style={{ boxShadow: active ? 'inset 0 0 0 2px #2563EB, 0 1px 3px rgba(0,0,0,.07)' : undefined }}>
                <div className="flex items-center gap-2.5 mb-2">
                  <Avatar profile={p} size={28} />
                  <span className="text-sm font-semibold text-gray-900 truncate">{displayName(p)}{p.id === me.id ? ' (you)' : ''}</span>
                </div>
                <div className="flex flex-col gap-1">
                  {PERIODS.map(per => {
                    const st = reviewStatus(statuses.find(r => r.employee_id === p.id && r.period === per.id))
                    return (
                      <span key={per.id} className="flex items-center justify-between text-xs text-gray-500">
                        {per.label}<span className={`status-pill ${st.cls} text-[10px]`}>{st.label}</span>
                      </span>
                    )
                  })}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {history.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500">
            Review history
          </span>
          {history.map(r => {
            const st = reviewStatus(r)
            const active = r.year === year && r.period === period
            return (
              <button key={r.id} onClick={() => { setYear(r.year); setPeriod(r.period) }}
                className="flex items-center gap-2 text-xs bg-white border rounded-full pl-3 pr-1.5 py-1 hover:border-blue-300"
                style={{ borderColor: active ? '#2563EB' : '#e5e7eb' }}>
                <span className="font-semibold text-gray-800">{r.period === 'mid_year' ? 'Mid-year' : 'End of year'} {r.year}</span>
                <span className={`status-pill ${st.cls} text-[10px]`}>{st.label}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100 w-fit mb-5" role="tablist" aria-label="Review period">
        {PERIODS.map(p => (
          <button key={p.id} role="tab" aria-selected={period === p.id} onClick={() => setPeriod(p.id)}
            className="text-sm font-semibold px-4 py-1.5 rounded-lg"
            style={{ background: period === p.id ? '#2563EB' : 'transparent', color: period === p.id ? 'white' : '#6b7280' }}>
            {p.label} {year}
          </button>
        ))}
      </div>

      <ReviewEditor
        key={`${person.id}-${year}-${period}`}
        person={person}
        year={year}
        period={period}
        reviewerId={reviewerId}
        isEmployee={person.id === me.id}
        isReviewer={canReview(person)}
      />
    </PageShell>
  )
}

// ---------------------------------------------------------------------------

interface EditorProps {
  person: Profile
  year: number
  period: ReviewPeriod
  reviewerId: string | null
  isEmployee: boolean
  isReviewer: boolean
}

function ReviewEditor({ person, year, period, reviewerId, isEmployee, isReviewer }: EditorProps) {
  const { byId } = useTeam()
  const rv = usePerformanceReview(person.id, year, period, reviewerId)
  const items = useReviewItems(person.id, year, period)
  const [confirmShare, setConfirmShare] = useState(false)

  const r = rv.review
  const locked = Boolean(r?.employee_signed_at && r?.reviewer_signed_at)
  const shared = Boolean(r?.shared_at)
  const submitted = Boolean(r?.self_submitted_at)
  const reviewer = byId(reviewerId)
  const who = firstName(person)

  // Once shared, show goals/KPIs/rocks as they stood at that moment
  const shownItems = shared && r?.snapshot ? r.snapshot : items

  const canEditSelf = isEmployee && !locked
  const canEditManager = isReviewer && !locked
  const showSelf = isEmployee || submitted             // reviewer sees it once submitted
  const showManager = isReviewer || shared             // person sees it once shared

  if (rv.loading) return <div className="card h-64 animate-pulse" />

  return (
    <div className="space-y-5">
      {/* Header / status */}
      <section className="card p-5 flex flex-wrap items-center gap-4">
        <Avatar profile={person} size={40} />
        <div className="flex-1 min-w-[200px]">
          <h2 className="text-base font-bold text-gray-900" style={{ fontFamily: 'Archivo, sans-serif' }}>
            {displayName(person)} · {period === 'mid_year' ? 'Mid-year' : 'End-of-year'} review {year}
          </h2>
          <p className="text-xs text-gray-500">
            Reviewer: {reviewer ? displayName(reviewer) : 'none assigned (self-reflection only)'}
          </p>
        </div>
        <ol className="flex flex-wrap items-center gap-2 text-xs">
          <Step done={submitted} label={`Self-review${r?.self_submitted_at ? ' · ' + shortDate(r.self_submitted_at) : ''}`} />
          <Step done={shared} label={`Shared${r?.shared_at ? ' · ' + shortDate(r.shared_at) : ''}`} />
          <Step done={Boolean(r?.employee_signed_at)} label={`${who} signed`} />
          <Step done={Boolean(r?.reviewer_signed_at)} label="Reviewer signed" />
        </ol>
        {locked && <span className="flex items-center gap-1 text-xs font-semibold text-gray-600"><Lock size={12} /> Locked</span>}
      </section>

      {!isEmployee && !submitted && (
        <Note icon={<EyeOff size={14} />}>
          {who} hasn't submitted a self-review yet. You'll see it here once they do. You can start your comments now.
        </Note>
      )}
      {isEmployee && reviewer && !shared && (
        <Note icon={<EyeOff size={14} />}>
          {firstName(reviewer)}'s comments stay private until they share the review with you.
        </Note>
      )}

      {/* Goals, KPIs and rocks */}
      <section className="card p-5">
        <SectionLabel>Goals, KPIs &amp; rocks</SectionLabel>
        {shownItems.length === 0 ? (
          <p className="text-sm text-gray-400">No individual goals, KPIs or rocks for this period yet. Add them on {who}'s dashboard and the Scorecard.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {shownItems.map(it => (
              <li key={it.key} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-600">{it.kind === 'goal' ? 'Annual goal' : it.kind === 'kpi' ? 'KPI' : 'Rock'}</span>
                  <span className="text-sm font-semibold text-gray-900">{it.title}</span>
                  {it.detail && <span className="text-xs text-gray-400">{it.detail}</span>}
                  <span className="ml-auto"><StatusPill status={it.status} small /></span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <Field
                    id={`self-${it.key}`}
                    label="Self-assessment"
                    visible={showSelf}
                    editable={canEditSelf}
                    value={rv.self.items[it.key] ?? ''}
                    onChange={v => rv.editSelf({ items: { [it.key]: v } })}
                    hiddenText={`Visible after ${who} submits`}
                    rows={2}
                  />
                  {reviewerId && (
                    <Field
                      id={`mgr-${it.key}`}
                      label={`${reviewer ? firstName(reviewer) : 'Reviewer'}'s comments`}
                      visible={showManager}
                      editable={canEditManager}
                      value={rv.manager.items[it.key] ?? ''}
                      onChange={v => rv.editManager({ items: { [it.key]: v } })}
                      hiddenText="Visible once shared"
                      rows={2}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Reflection */}
      <section className="card p-5">
        <SectionLabel>Reflection</SectionLabel>
        <div className="space-y-6">
          {REFLECTION.map(q => (
            <div key={q.id}>
              <p className="text-sm font-semibold text-gray-900">{q.label}</p>
              <p className="text-xs text-gray-400 mb-2">{q.help(period)}</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Field
                  id={`self-${q.id}`}
                  label={`${who}'s answer`}
                  visible={showSelf}
                  editable={canEditSelf}
                  value={rv.self.answers[q.id] ?? ''}
                  onChange={v => rv.editSelf({ answers: { [q.id]: v } })}
                  hiddenText={`Visible after ${who} submits`}
                />
                {reviewerId && (
                  <Field
                    id={`mgr-${q.id}`}
                    label={`${reviewer ? firstName(reviewer) : 'Reviewer'}'s response`}
                    visible={showManager}
                    editable={canEditManager}
                    value={rv.manager.answers[q.id] ?? ''}
                    onChange={v => rv.editManager({ answers: { [q.id]: v } })}
                    hiddenText="Visible once shared"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Overall summary */}
      {reviewerId && (
        <section className="card p-5">
          <SectionLabel>Overall summary</SectionLabel>
          <Field
            id="mgr-summary"
            label={`From ${reviewer ? firstName(reviewer) : 'the reviewer'}`}
            visible={showManager}
            editable={canEditManager}
            value={rv.manager.answers.summary ?? ''}
            onChange={v => rv.editManager({ answers: { summary: v } })}
            hiddenText="Visible once shared"
            rows={5}
          />
        </section>
      )}

      {/* Actions */}
      <section className="card p-5 flex flex-wrap items-center gap-3">
        <SaveLine state={rv.saveState} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isEmployee && !submitted && !locked && (
            <ActionButton onClick={() => rv.submitSelf()} icon={<Send size={14} />}>
              {reviewer ? `Submit self-review to ${firstName(reviewer)}` : 'Mark self-review complete'}
            </ActionButton>
          )}
          {isReviewer && !shared && (
            confirmShare ? (
              <>
                <span className="text-xs text-gray-600">{who} will be able to read all your comments.</span>
                <button onClick={() => setConfirmShare(false)} className="text-xs text-gray-500 px-3 py-2">Cancel</button>
                <ActionButton onClick={async () => { await rv.share(items); setConfirmShare(false) }} icon={<Send size={14} />}>Share now</ActionButton>
              </>
            ) : (
              <ActionButton onClick={() => setConfirmShare(true)} icon={<Send size={14} />}>Share with {who}</ActionButton>
            )
          )}
          {shared && isEmployee && !r?.employee_signed_at && (
            <ActionButton onClick={() => rv.signAsEmployee()} icon={<CheckCircle2 size={14} />}>Sign off as {who}</ActionButton>
          )}
          {shared && isReviewer && !r?.reviewer_signed_at && (
            <ActionButton onClick={() => rv.signAsReviewer()} icon={<CheckCircle2 size={14} />}>Sign off as reviewer</ActionButton>
          )}
        </div>
        <p className="w-full text-[11px] text-gray-400">
          Everything saves as you type. Once both of you sign off, the review is locked.
        </p>
      </section>
    </div>
  )
}

// Goals / KPIs / rocks for the period, live from the dashboard and Scorecard
function useReviewItems(personId: string, year: number, period: ReviewPeriod): ReviewItem[] {
  const { goals } = useIndividualGoals(personId, year)
  const quarters = PERIODS.find(p => p.id === period)!.quarters
  const all = useKpis(personId, null).kpis
  const kpis = useMemo(() => all.filter(k => k.year === year && (k.quarter == null || quarters.includes(k.quarter))), [all, year, quarters])
  const [rocks, setRocks] = useState<Rock[]>([])

  useEffect(() => {
    supabase.from('rocks').select('*').eq('user_id', personId)
      .in('quarter', quarters.map(q => `Q${q} ${year}`))
      .order('quarter').order('created_at')
      .then(({ data }) => setRocks((data as Rock[]) ?? []))
  }, [personId, year, period])

  return useMemo(() => [
    ...goals.map(g => ({ key: `goal:${g.id}`, kind: 'goal' as const, title: g.title, status: g.status })),
    ...kpis.map(k => ({
      key: `kpi:${k.id}`, kind: 'kpi' as const, title: k.title, status: k.status,
      detail: [k.quarter ? kpiPeriodLabel(k) : null, k.target != null ? `${(k.current ?? 0).toLocaleString()} / ${k.target.toLocaleString()}` : null]
        .filter(Boolean).join(' · ') || undefined,
    })),
    ...rocks.map(r => ({ key: `rock:${r.id}`, kind: 'rock' as const, title: r.title, status: r.status, detail: r.quarter })),
  ], [goals, kpis, rocks])
}

// ---------- small pieces ----------

function Field({ id, label, visible, editable, value, onChange, hiddenText, rows = 4 }: {
  id: string
  label: string
  visible: boolean
  editable: boolean
  value: string
  onChange: (v: string) => void
  hiddenText: string
  rows?: number
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500 mb-1">{label}</label>
      {!visible ? (
        <div className="flex items-center gap-2 text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl px-3.5 py-3">
          <EyeOff size={12} /> {hiddenText}
        </div>
      ) : editable ? (
        <AutoTextarea id={id} value={value} onChange={onChange} rows={rows} placeholder="Write here…" />
      ) : (
        <p id={id} className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-xl px-3.5 py-3 min-h-[48px]">{value.trim() || '—'}</p>
      )}
    </div>
  )
}

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${done ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
      {done ? <CheckCircle2 size={12} /> : <span className="w-2 h-2 rounded-full bg-gray-300" />} {label}
    </li>
  )
}

function Note({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm" style={{ background: 'rgba(37,99,235,0.08)', color: '#1d4ed8' }}>
      {icon}<span>{children}</span>
    </div>
  )
}

function ActionButton({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-xl hover:opacity-90" style={{ background: '#2563EB' }}>
      {icon}{children}
    </button>
  )
}

function SaveLine({ state }: { state: ReturnType<typeof usePerformanceReview>['saveState'] }) {
  if (state.kind === 'error') return <p role="alert" className="text-xs text-red-600">{state.text}</p>
  if (state.kind === 'saving') return <p className="text-xs text-gray-400">Saving…</p>
  if (state.kind === 'saved') return (
    <p className="text-xs text-green-700">Saved · {new Date(state.at!).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
  )
  return <p className="text-xs text-gray-400">Changes save automatically</p>
}
