import { useState, useEffect, useMemo } from 'react'
import { Menu } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { useNotifications } from './hooks/useNotifications'
import { LoginPage } from './components/auth/LoginPage'
import { Sidebar, type Page } from './components/layout/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { TeamBoard } from './components/team/TeamBoard'
import { Scorecard } from './pages/AnnualGoals'
import { EowStatus } from './pages/EowStatus'
import { supabase } from './lib/supabase'
import { TeamContext, makeCanEdit, type TeamContextValue } from './lib/team'
import type { Profile } from './types/database'

const PATHS: Record<Page, string> = {
  dashboard: '',
  team: 'team-board',
  scorecard: 'scorecard',
  eow: 'eow-status',
}

// GitHub Pages serves one index.html, so pages live in the hash: #/eow-status
function pageFromHash(): Page {
  const h = window.location.hash.replace(/^#\/?/, '')
  return (Object.keys(PATHS) as Page[]).find(p => PATHS[p] === h) ?? 'dashboard'
}

export default function App() {
  const { user, profile, loading, signInError, signInWithGoogle, signOut } = useAuth()
  const [page, setPage] = useState<Page>(pageFromHash)
  const [viewingUserId, setViewingUserId] = useState<string | null>(null)
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [navOpen, setNavOpen] = useState(false)
  const notifications = useNotifications(user?.id ?? '')

  const effectiveViewingUserId = viewingUserId ?? user?.id ?? ''

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true })
      .then(({ data }) => setAllProfiles(data ?? []))
  }, [user?.id])

  useEffect(() => {
    const onHash = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const team = useMemo<TeamContextValue | null>(() => {
    if (!profile) return null
    const me = allProfiles.find(p => p.id === profile.id) ?? profile
    return {
      me,
      profiles: allProfiles.length ? allProfiles : [me],
      byId: id => allProfiles.find(p => p.id === id),
      canEdit: makeCanEdit(me, allProfiles),
      openDashboard: uid => handleSelectUser(uid),
    }
  }, [profile, allProfiles])

  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center" style={{ background: '#EEF2F7' }}>
        <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <LoginPage onSignIn={signInWithGoogle} error={signInError} />
  }

  if (!team) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center p-6 text-center" style={{ background: '#EEF2F7' }}>
        <p className="text-sm text-gray-500">Your profile couldn't be loaded. Refresh the page, or sign out and back in.</p>
      </div>
    )
  }

  function navigate(p: Page) {
    setPage(p)
    window.location.hash = PATHS[p] ? `/${PATHS[p]}` : ''
    setNavOpen(false)
  }

  function handleSelectUser(uid: string) {
    setViewingUserId(uid === user!.id ? null : uid)
    navigate('dashboard')
  }

  function handleNavigate(p: Page) {
    if (p !== 'dashboard' || page === 'dashboard') setViewingUserId(null)
    navigate(p)
  }

  return (
    <TeamContext.Provider value={team}>
      <div className="flex w-full h-dvh overflow-hidden" style={{ background: '#EEF2F7' }}>
        <Sidebar
          activePage={page}
          onNavigate={handleNavigate}
          onSignOut={signOut}
          viewingUserId={effectiveViewingUserId}
          onSelectUser={handleSelectUser}
          unreadCount={notifications.unread.length}
          open={navOpen}
          onClose={() => setNavOpen(false)}
        />

        <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
          {/* Mobile top bar */}
          <div className="md:hidden flex items-center gap-3 px-4 py-3 text-white" style={{ background: '#0B1E39' }}>
            <button onClick={() => setNavOpen(true)} aria-label="Open menu" className="p-1 -ml-1">
              <Menu size={20} />
            </button>
            <span className="text-sm font-semibold" style={{ fontFamily: 'Archivo, sans-serif' }}>Box United OS</span>
          </div>

          {page === 'dashboard' ? (
            <Dashboard viewingUserId={effectiveViewingUserId} notifications={notifications} />
          ) : page === 'team' ? (
            <TeamBoard />
          ) : page === 'scorecard' ? (
            <Scorecard />
          ) : (
            <EowStatus />
          )}
        </main>
      </div>
    </TeamContext.Provider>
  )
}
