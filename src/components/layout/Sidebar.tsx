import { LayoutDashboard, Users, LogOut, Dumbbell, Target, ClipboardCheck, X } from 'lucide-react'
import { useTeam, displayName } from '../../lib/team'
import { Avatar } from '../ui/Avatar'

export type Page = 'dashboard' | 'team' | 'scorecard' | 'eow'

interface Props {
  activePage: Page
  onNavigate: (page: Page) => void
  onSignOut: () => void
  viewingUserId: string
  onSelectUser: (userId: string) => void
  unreadCount: number
  open: boolean
  onClose: () => void
}

const navItems: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'My Dashboard', icon: LayoutDashboard },
  { id: 'team',      label: 'Team Board',   icon: Users },
  { id: 'scorecard', label: 'Scorecard',    icon: Target },
  { id: 'eow',       label: 'EOW Status',   icon: ClipboardCheck },
]

// Shown until Claire & Alexandra have signed in once
const PLACEHOLDERS = [
  { key: 'claire', full_name: 'Claire Trinkle', email: 'claire@boxunited.org' },
  { key: 'alexandra', full_name: 'Alexandra Foster', email: 'alexandra@boxunited.org' },
]

export function Sidebar({
  activePage,
  onNavigate,
  onSignOut,
  viewingUserId,
  onSelectUser,
  unreadCount,
  open,
  onClose,
}: Props) {
  const { me, profiles } = useTeam()

  const others = profiles.filter(p => p.id !== me.id)
  const missing = PLACEHOLDERS.filter(
    ph => !profiles.some(p => (p.full_name ?? p.email).toLowerCase().startsWith(ph.key)),
  )
  const members = [me, ...others]

  return (
    <>
      {/* Mobile backdrop */}
      {open && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={onClose} />}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col w-[232px] shrink-0 h-dvh transition-transform md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: '#0B1E39' }}
      >
        {/* Logo */}
        <div className="px-5 py-6 border-b border-white/10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#2563EB' }}>
            <Dumbbell size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white text-sm font-semibold leading-tight" style={{ fontFamily: 'Archivo, sans-serif' }}>
              Box United OS
            </p>
            <p className="text-blue-300 text-xs mt-0.5">Operations</p>
          </div>
          <button onClick={onClose} className="md:hidden text-white/60" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="px-3 py-4 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon
            const active = activePage === item.id && (item.id !== 'dashboard' || viewingUserId === me.id)
            return (
              <button
                key={item.id}
                onClick={() => item.id === 'dashboard' ? onSelectUser(me.id) : onNavigate(item.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left"
                style={{
                  background: active ? 'rgba(37,99,235,0.25)' : 'transparent',
                  color: active ? '#93c5fd' : 'rgba(255,255,255,0.65)',
                  boxShadow: active ? 'inset 3px 0 0 #2563EB' : undefined,
                }}
              >
                <Icon size={16} />
                <span className="flex-1">{item.label}</span>
                {item.id === 'dashboard' && unreadCount > 0 && (
                  <span className="text-[10px] font-bold text-white bg-red-500 rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Team — click anyone to open their dashboard */}
        <div className="px-4 py-4 border-t border-white/10 flex-1 overflow-y-auto">
          <p className="text-white/40 text-[11px] font-semibold uppercase tracking-wider mb-2 px-1">Team</p>
          <div className="space-y-0.5">
            {members.map(p => {
              const viewing = activePage === 'dashboard' && viewingUserId === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectUser(p.id)}
                  className="w-full flex items-center gap-2.5 px-1.5 py-1.5 rounded-lg text-left transition-colors hover:bg-white/5"
                  style={{ background: viewing ? 'rgba(255,255,255,0.08)' : undefined }}
                >
                  <Avatar profile={p} size={26} ring={viewing} />
                  <span className="text-xs text-white/80 truncate">
                    {displayName(p)}{p.id === me.id ? ' (you)' : ''}
                  </span>
                </button>
              )
            })}
            {missing.map(ph => (
              <div key={ph.key} className="flex items-center gap-2.5 px-1.5 py-1.5 opacity-40" title="Hasn't signed in yet">
                <Avatar profile={{ ...ph, avatar_url: null }} size={26} />
                <span className="text-xs text-white/80 truncate">{ph.full_name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* User */}
        <div className="px-3 pb-5 border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 px-2 mb-3">
            <Avatar profile={me} size={32} />
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate">{displayName(me)}</p>
              <p className="text-blue-300 text-xs truncate opacity-70">{me.email}</p>
            </div>
          </div>
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
