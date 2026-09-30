import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, ClipboardCheck } from 'lucide-react'
import { useEow } from '../hooks/useEow'
import { EOW_QUESTIONS, EOW_FORM_TITLE, EOW_FORM_DESCRIPTION } from '../config/eowQuestions'
import { useRocks } from '../hooks/useRocks'
import { useTeam, weekOf, shortDate, firstName, currentQuarter, quarterLabel } from '../lib/team'
import { StatusPill } from '../components/ui/StatusPill'
import { PageShell, PageHeader, SectionLabel } from '../components/layout/PageShell'
import { Avatar } from '../components/ui/Avatar'

function AutoTextarea({ id, value, onChange, disabled }: { id: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      id={id}
      ref={ref}
      rows={4}
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      placeholder="Long answer…"
      className="w-full min-h-[104px] resize-none text-sm text-gray-800 leading-relaxed border border-gray-200 rounded-xl px-3.5 py-3 outline-none focus:border-blue-400 bg-white disabled:bg-gray-50"
    />
  )
}

function weekLabel(week: string) {
  return `Week of ${shortDate(week)}`
}

export function EowStatus() {
  const { me, byId } = useTeam()
  const { submissions, loading, save } = useEow()
  const week = weekOf()
  const mine = submissions.find(s => s.user_id === me.id && s.week_of === week)
  const cq = currentQuarter()
  const { rocks } = useRocks(quarterLabel(cq.q, cq.year), me.id)

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    if (mine) setAnswers(mine.answers)
  }, [mine?.id])

  const missing = EOW_QUESTIONS.filter(q => q.required && !(answers[q.id] ?? '').trim())

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (missing.length) {
      setStatus({ kind: 'err', text: `Answer "${missing[0].label}" to submit.` })
      return
    }
    setSaving(true)
    const err = await save(me.id, week, answers)
    setSaving(false)
    setStatus(err ? { kind: 'err', text: err } : { kind: 'ok', text: mine ? 'Updated. You can keep editing until Sunday night.' : 'Submitted. You can edit it until Sunday night.' })
  }

  return (
    <PageShell>
      <PageHeader
        icon={<ClipboardCheck size={18} className="text-blue-600" />}
        title="End-of-Week Status"
        subtitle={`${EOW_FORM_TITLE} · ${EOW_FORM_DESCRIPTION}. One per person per week; only you can edit yours.`}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6">
        <form onSubmit={submit} className="card p-5 md:p-6 self-start">
          <SectionLabel right={mine && <span className="text-[11px] text-green-700 font-semibold">Submitted {shortDate(mine.submitted_at)}</span>}>
            {EOW_FORM_TITLE} · {weekLabel(week)}
          </SectionLabel>
          <p className="text-xs text-gray-400 -mt-1 mb-4">
            Today: {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} · <span className="text-red-500">*</span> required
          </p>
          <div className="space-y-5">
            {EOW_QUESTIONS.map(q => (
              <div key={q.id}>
                <label htmlFor={`eow-${q.id}`} className="block text-sm font-semibold text-gray-900 mb-1.5">
                  {q.label}{q.required && <span className="text-red-500"> *</span>}
                </label>
                {q.help && <p className="text-xs text-gray-400 mb-1.5">{q.help}</p>}
                {q.showRocks && rocks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {rocks.map(r => (
                      <span key={r.id} className="inline-flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-full pl-2.5 pr-1 py-0.5">
                        {r.title} <StatusPill status={r.status} small />
                      </span>
                    ))}
                  </div>
                )}
                <AutoTextarea id={`eow-${q.id}`} value={answers[q.id] ?? ''} onChange={v => setAnswers(a => ({ ...a, [q.id]: v }))} />
              </div>
            ))}
          </div>
          <button type="submit" disabled={saving} className="w-full mt-5 text-sm font-semibold text-white py-2.5 rounded-xl disabled:opacity-50" style={{ background: '#2563EB' }}>
            {saving ? 'Saving…' : mine ? 'Update check-in' : 'Submit'}
          </button>
          {status && <p className={`text-sm mt-3 ${status.kind === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{status.text}</p>}
        </form>

        <section className="card p-5 md:p-6 self-start">
          <SectionLabel>Submissions · newest first</SectionLabel>
          {loading ? (
            <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          ) : submissions.length === 0 ? (
            <p className="text-sm text-gray-400">No check-ins yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 border-b border-gray-100">
                    <th className="py-2 pr-2">Week of</th>
                    <th className="py-2 px-2">Person</th>
                    <th className="py-2 px-2">Submitted</th>
                    <th className="py-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(s => {
                    const person = byId(s.user_id)
                    const expanded = open === s.id
                    return (
                      <FragmentRow key={s.id}>
                        <tr className="border-b border-gray-50 cursor-pointer hover:bg-gray-50/60" onClick={() => setOpen(expanded ? null : s.id)}>
                          <td className="py-2.5 pr-2 tabular-nums">{shortDate(s.week_of)}</td>
                          <td className="py-2.5 px-2"><span className="flex items-center gap-2"><Avatar profile={person} size={22} />{firstName(person)}</span></td>
                          <td className="py-2.5 px-2 text-gray-500 tabular-nums">
                            {new Date(s.submitted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 text-gray-400">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
                        </tr>
                        {expanded && (
                          <tr className="border-b border-gray-100 bg-gray-50/50">
                            <td colSpan={4} className="px-3 py-3 space-y-3">
                              {EOW_QUESTIONS.map(q => (
                                <div key={q.id}>
                                  <p className="text-xs font-semibold text-gray-500">{q.label}</p>
                                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{s.answers[q.id]?.trim() || '—'}</p>
                                </div>
                              ))}
                            </td>
                          </tr>
                        )}
                      </FragmentRow>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </PageShell>
  )
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
