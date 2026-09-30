import { useEffect, useRef, useState } from 'react'

// Unsubmitted EOW answers, autosaved in this browser so a refresh, closed tab or
// page switch doesn't lose them. Drafts stay private; Submit writes to the database.

interface Draft {
  answers: Record<string, string>
  savedAt: string
}

const PREFIX = 'bu-eow-draft:'

function read(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Draft) : null
  } catch {
    return null
  }
}

function write(key: string, draft: Draft) {
  try {
    localStorage.setItem(key, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

function remove(key: string) {
  try { localStorage.removeItem(key) } catch { /* storage unavailable */ }
}

// Drop drafts from earlier weeks for this person
function pruneOld(userId: string, keep: string) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k && k.startsWith(`${PREFIX}${userId}:`) && k !== keep) localStorage.removeItem(k)
    }
  } catch { /* storage unavailable */ }
}

const same = (a: Record<string, string>, b: Record<string, string>) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) if ((a[k] ?? '').trim() !== (b[k] ?? '').trim()) return false
  return true
}

/**
 * @param submitted  answers already in the database for this week (null if none)
 * @param submittedAt when those were last saved
 * @param ready      true once the submissions have loaded
 */
export function useEowDraft(userId: string, week: string, submitted: Record<string, string> | null, submittedAt: string | null, ready: boolean) {
  const key = `${PREFIX}${userId}:${week}`
  const [answers, setAnswersState] = useState<Record<string, string>>({})
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  const [restored, setRestored] = useState(false)
  const [storageOk, setStorageOk] = useState(true)
  const initialized = useRef(false)
  const latest = useRef(answers)
  const timer = useRef<number | undefined>(undefined)
  const submittedRef = useRef(submitted)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    submittedRef.current = submitted
  }, [submitted])

  // Load once: an unsubmitted draft newer than the database copy wins
  useEffect(() => {
    if (!ready || initialized.current) return
    initialized.current = true
    pruneOld(userId, key)
    const draft = read(key)
    const draftIsNewer = draft && (!submittedAt || draft.savedAt > submittedAt)
    if (draft && draftIsNewer && !same(draft.answers, submitted ?? {})) {
      latest.current = draft.answers
      setAnswersState(draft.answers)
      setDraftSavedAt(draft.savedAt)
      setRestored(true)
      setLoaded(true)
    } else {
      if (draft) remove(key)
      latest.current = submitted ?? {}
      setAnswersState(submitted ?? {})
      setLoaded(true)
    }
  }, [ready])

  function flush() {
    window.clearTimeout(timer.current)
    const a = latest.current
    if (same(a, submittedRef.current ?? {})) {
      remove(key)
      setDraftSavedAt(null)
      return
    }
    const savedAt = new Date().toISOString()
    const ok = write(key, { answers: a, savedAt })
    setStorageOk(ok)
    if (ok) setDraftSavedAt(savedAt)
  }

  function setAnswer(id: string, value: string) {
    const next = { ...latest.current, [id]: value }
    latest.current = next
    setAnswersState(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, 800)
  }

  // Save immediately if the tab is hidden or closed mid-typing
  useEffect(() => {
    const onHide = () => { if (initialized.current) flush() }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onHide)
      if (initialized.current) flush()  // leaving the EOW page inside the app
    }
  }, [key])

  function clearDraft() {
    window.clearTimeout(timer.current)
    remove(key)
    setDraftSavedAt(null)
    setRestored(false)
  }

  const dirty = loaded && !same(answers, submitted ?? {})

  return { answers, setAnswer, draftSavedAt, restored, dirty, storageOk, clearDraft }
}
