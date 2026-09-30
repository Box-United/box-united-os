import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { EowSubmission } from '../types/database'

export function useEow() {
  const [submissions, setSubmissions] = useState<EowSubmission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const { data } = await supabase
      .from('eow_submissions')
      .select('*')
      .order('week_of', { ascending: false })
      .order('submitted_at', { ascending: false })
      .limit(200)
    setSubmissions((data as EowSubmission[]) ?? [])
    setLoading(false)
  }

  // One submission per person per week; re-submitting the same week updates it.
  async function save(userId: string, week: string, answers: Record<string, string>) {
    const existing = submissions.find(s => s.user_id === userId && s.week_of === week)
    const now = new Date().toISOString()
    const res = existing
      ? await supabase.from('eow_submissions').update({ answers, updated_at: now }).eq('id', existing.id).select('*')
      : await supabase.from('eow_submissions').insert({ user_id: userId, week_of: week, answers }).select('*')
    if (res.error || !res.data?.length) {
      return res.error?.message ?? 'This week is closed for edits.'
    }
    await fetchAll()
    return null
  }

  return { submissions, loading, save, refetch: fetchAll }
}
