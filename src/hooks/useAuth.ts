import { useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(s => ({ ...s, session, user: session?.user ?? null }))
      if (session?.user) fetchProfile(session.user.id)
      else setState(s => ({ ...s, loading: false }))
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(s => ({ ...s, session, user: session?.user ?? null }))
      if (session?.user) fetchProfile(session.user.id)
      else setState(s => ({ ...s, profile: null, loading: false }))
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setState(s => ({ ...s, profile: data, loading: false }))
  }

  async function signInWithGoogle() {
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

  return { ...state, signInError: readSignInError(), signInWithGoogle, signOut }
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
