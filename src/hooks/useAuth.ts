import { useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

// People are signed out of Box United OS (not Google) this long after they sign in
const MAX_SESSION_MS = 24 * 60 * 60 * 1000

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  expired: boolean
}

// When this browser signed in. The access token's `amr` claim holds the sign-in
// time and keeps it across token refreshes; last_sign_in_at is the fallback.
function signedInAt(session: Session): number | null {
  try {
    const part = session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const amr = (JSON.parse(atob(part)).amr ?? []) as { timestamp?: number }[]
    const times = amr.map(a => a.timestamp).filter((t): t is number => typeof t === 'number')
    if (times.length) return Math.max(...times) * 1000
  } catch { /* fall through */ }
  const last = session.user.last_sign_in_at
  return last ? Date.parse(last) : null
}

function isExpired(session: Session) {
  const at = signedInAt(session)
  return at != null && Date.now() - at >= MAX_SESSION_MS
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
    expired: false,
  })

  function expire() {
    setState({ user: null, session: null, profile: null, loading: false, expired: true })
    // Ends only this browser's session; deferred because Supabase can deadlock
    // if auth calls are made inside its onAuthStateChange callback.
    window.setTimeout(() => { void supabase.auth.signOut({ scope: 'local' }) }, 0)
  }

  useEffect(() => {
    function accept(session: Session | null) {
      if (session && isExpired(session)) {
        expire()
        return
      }
      setState(s => ({ ...s, session, user: session?.user ?? null }))
      if (session?.user) fetchProfile(session.user.id)
      else setState(s => ({ ...s, profile: null, loading: false }))
    }

    supabase.auth.getSession().then(({ data: { session } }) => accept(session))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => accept(session))

    return () => subscription.unsubscribe()
  }, [])

  // While the app is open, sign out at the 24-hour mark. Background tabs throttle
  // timers, so also check whenever the tab comes back into view.
  useEffect(() => {
    const session = state.session
    if (!session) return
    const at = signedInAt(session)
    if (at == null) return
    const check = () => { if (isExpired(session)) expire() }
    const timer = window.setTimeout(check, Math.max(0, at + MAX_SESSION_MS - Date.now()) + 1000)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [state.session])

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setState(s => ({ ...s, profile: data, loading: false }))
  }

  async function signInWithGoogle() {
    setState(s => ({ ...s, expired: false }))
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        // Google only offers Box United accounts; the database also rejects any other domain
        queryParams: { hd: 'boxunited.org', prompt: 'select_account' },
      },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const signInNotice = state.expired
    ? 'For security, Box United OS signs you out once a day. Sign in again to pick up where you left off.'
    : null

  return { ...state, signInError: readSignInError(), signInNotice, signInWithGoogle, signOut }
}

// Supabase sends OAuth failures back as ?error_description=… or #error_description=…
function readSignInError(): string | null {
  const params = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const desc = params.get('error_description') ?? hash.get('error_description')
  if (!desc) return null
  if (/database error|boxunited/i.test(desc)) {
    return 'Only @boxunited.org Google accounts can sign in. Choose your Box United account and try again.'
  }
  return `Sign-in didn't work: ${desc}`
}
