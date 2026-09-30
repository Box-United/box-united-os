import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PerformanceReview, ReviewItem, ReviewPart, ReviewPeriod } from '../types/database'

type Side = 'self' | 'manager'
const TABLE: Record<Side, string> = { self: 'review_self', manager: 'review_manager' }

const emptyPart = (reviewId = ''): ReviewPart => ({ review_id: reviewId, answers: {}, items: {}, updated_at: '' })

// One person's review for a year + period. Both halves autosave to the database;
// row-level security decides who can read each half.
export function usePerformanceReview(employeeId: string, year: number, period: ReviewPeriod, reviewerId: string | null) {
  const [review, setReview] = useState<PerformanceReview | null>(null)
  const [self, setSelf] = useState<ReviewPart>(emptyPart())
  const [manager, setManager] = useState<ReviewPart>(emptyPart())
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<{ kind: 'idle' | 'saving' | 'saved' | 'error'; at?: string; text?: string }>({ kind: 'idle' })
  const timers = useRef<Record<Side, number | undefined>>({ self: undefined, manager: undefined })
  const pending = useRef<Record<Side, ReviewPart | null>>({ self: null, manager: null })
  const reviewRef = useRef<PerformanceReview | null>(null)

  // Which review a pending save belongs to, so switching person/period mid-typing
  // still saves the text to the review it was typed into.
  type Ctx = { employeeId: string; year: number; period: ReviewPeriod; reviewerId: string | null }
  const ctx: Ctx = { employeeId, year, period, reviewerId }

  useEffect(() => {
    if (!employeeId) return
    const mine = { ...ctx }
    load()
    return () => {
      const parts = { ...pending.current }
      const r = reviewRef.current
      pending.current = { self: null, manager: null }
      for (const side of ['self', 'manager'] as Side[]) {
        window.clearTimeout(timers.current[side])
        const part = parts[side]
        if (part) void writePart(side, part, mine, r)
      }
    }
  }, [employeeId, year, period])

  async function load() {
    reviewRef.current = null
    setLoading(true)
    setSaveState({ kind: 'idle' })
    const { data } = await supabase
      .from('performance_reviews')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('year', year)
      .eq('period', period)
      .maybeSingle()
    const r = (data as PerformanceReview) ?? null
    reviewRef.current = r
    setReview(r)
    if (r) {
      // Each read returns nothing if RLS hides that half from this viewer
      const [s, m] = await Promise.all([
        supabase.from('review_self').select('*').eq('review_id', r.id).maybeSingle(),
        supabase.from('review_manager').select('*').eq('review_id', r.id).maybeSingle(),
      ])
      setSelf((s.data as ReviewPart) ?? emptyPart(r.id))
      setManager((m.data as ReviewPart) ?? emptyPart(r.id))
    } else {
      setSelf(emptyPart())
      setManager(emptyPart())
    }
    setLoading(false)
  }

  // Creates the review row the first time anyone writes to it
  async function createReview(c: Ctx): Promise<PerformanceReview | null> {
    const { data, error } = await supabase
      .from('performance_reviews')
      .insert({ employee_id: c.employeeId, year: c.year, period: c.period, reviewer_id: c.reviewerId })
      .select('*')
      .single()
    if (!error && data) return data as PerformanceReview
    // someone else may have just created it
    const { data: existing } = await supabase.from('performance_reviews').select('*')
      .eq('employee_id', c.employeeId).eq('year', c.year).eq('period', c.period).maybeSingle()
    return (existing as PerformanceReview) ?? null
  }

  async function ensureReview(): Promise<PerformanceReview | null> {
    if (reviewRef.current) return reviewRef.current
    const r = await createReview(ctx)
    if (!r) {
      setSaveState({ kind: 'error', text: "Couldn't start this review. Check your connection and try again." })
      return null
    }
    reviewRef.current = r
    setReview(r)
    return r
  }

  // Save a part for a review that may no longer be on screen
  async function writePart(side: Side, part: ReviewPart, c: Ctx, known: PerformanceReview | null) {
    const r = known ?? await createReview(c)
    if (!r) return
    await supabase.from(TABLE[side]).upsert({ review_id: r.id, answers: part.answers, items: part.items, updated_at: new Date().toISOString() })
  }

  async function write(side: Side) {
    const part = pending.current[side]
    if (!part) return
    pending.current[side] = null
    const r = await ensureReview()
    if (!r) {
      pending.current[side] = part
      return
    }
    setSaveState({ kind: 'saving' })
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from(TABLE[side])
      .upsert({ review_id: r.id, answers: part.answers, items: part.items, updated_at: now })
      .select('review_id')
    if (error || !data?.length) {
      pending.current[side] = part  // keep it so the next change retries
      setSaveState({ kind: 'error', text: error ? "Couldn't save. Check your connection; your text is still here." : "Couldn't save: this review is locked or you can't edit this part." })
    } else {
      setSaveState({ kind: 'saved', at: now })
    }
  }

  function edit(side: Side, patch: { answers?: Record<string, string>; items?: Record<string, string> }) {
    const setter = side === 'self' ? setSelf : setManager
    setter(prev => {
      const next = {
        ...prev,
        answers: patch.answers ? { ...prev.answers, ...patch.answers } : prev.answers,
        items: patch.items ? { ...prev.items, ...patch.items } : prev.items,
      }
      pending.current[side] = next
      return next
    })
    setSaveState({ kind: 'saving' })
    window.clearTimeout(timers.current[side])
    timers.current[side] = window.setTimeout(() => { void write(side) }, 1000)
  }

  async function flushAll() {
    for (const side of ['self', 'manager'] as Side[]) {
      window.clearTimeout(timers.current[side])
      await write(side)
    }
  }

  async function stamp(patch: Partial<PerformanceReview>) {
    await flushAll()
    const r = await ensureReview()
    if (!r) return false
    const { data, error } = await supabase.from('performance_reviews').update(patch).eq('id', r.id).select('*')
    if (error || !data?.length) {
      setSaveState({ kind: 'error', text: error?.message ?? "Couldn't update this review." })
      return false
    }
    reviewRef.current = data[0] as PerformanceReview
    setReview(reviewRef.current)
    return true
  }

  const now = () => new Date().toISOString()
  return {
    review, self, manager, loading, saveState,
    editSelf: (p: Parameters<typeof edit>[1]) => edit('self', p),
    editManager: (p: Parameters<typeof edit>[1]) => edit('manager', p),
    submitSelf: () => stamp({ self_submitted_at: now() }),
    share: (snapshot: ReviewItem[]) => stamp({ shared_at: now(), snapshot }),
    signAsEmployee: () => stamp({ employee_signed_at: now() }),
    signAsReviewer: () => stamp({ reviewer_signed_at: now() }),
    reload: load,
  }
}

// Status for each person's mid-year / end-of-year review in a year (only rows you may see)
export function useReviewStatuses(year: number) {
  const [rows, setRows] = useState<PerformanceReview[]>([])
  useEffect(() => {
    supabase.from('performance_reviews').select('*').eq('year', year).then(({ data }) => setRows((data as PerformanceReview[]) ?? []))
  }, [year])
  return rows
}

export function reviewStatus(r: PerformanceReview | null | undefined) {
  if (!r) return { label: 'Not started', cls: 'not-started' }
  if (r.employee_signed_at && r.reviewer_signed_at) return { label: 'Complete', cls: 'goal-done' }
  if (r.shared_at) return { label: 'Shared · awaiting sign-off', cls: 'on-track' }
  if (r.self_submitted_at) return { label: 'Self-review submitted', cls: 'in-progress' }
  return { label: 'In progress', cls: 'in-progress' }
}
