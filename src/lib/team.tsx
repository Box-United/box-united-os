import { createContext, useContext } from 'react'
import type { Department, Profile } from '../types/database'

export interface TeamContextValue {
  me: Profile
  profiles: Profile[]
  byId: (id: string | null | undefined) => Profile | undefined
  canEdit: (ownerId: string | null | undefined) => boolean
  canReview: (person: Profile) => boolean
  relevant: (dept: Department | null | undefined) => boolean
  openDashboard: (userId: string) => void
}

export const TeamContext = createContext<TeamContextValue | null>(null)

export function useTeam() {
  const ctx = useContext(TeamContext)
  if (!ctx) throw new Error('useTeam must be used inside TeamContext')
  return ctx
}

// Owner, owner's manager, or the executive director can edit (mirrors public.can_edit)
export function makeCanEdit(me: Profile, profiles: Profile[]) {
  return (ownerId: string | null | undefined) => {
    if (!ownerId) return me.role === 'executive_director'
    if (ownerId === me.id || me.role === 'executive_director') return true
    return profiles.find(p => p.id === ownerId)?.manager_id === me.id
  }
}

// Mirrors public.can_review: the person's manager or the executive director, never yourself.
// The same people can see someone's EOW check-ins and performance reviews.
export function makeCanReview(me: Profile) {
  return (p: Profile) => p.id !== me.id && (me.role === 'executive_director' || p.manager_id === me.id)
}

// Who someone reports to. Anyone without a manager set reports to the executive director.
export function managerOf(p: Profile, profiles: Profile[]) {
  if (p.manager_id && profiles.some(x => x.id === p.manager_id)) return p.manager_id
  if (p.role === 'executive_director') return null
  return profiles.find(x => x.role === 'executive_director' && x.id !== p.id)?.id ?? null
}

// Everyone in reporting order (each manager followed by their reports), with depth for indenting
export function orgOrder(profiles: Profile[]) {
  const out: { person: Profile; depth: number }[] = []
  const placed = new Set<string>()
  const visit = (p: Profile, depth: number) => {
    if (placed.has(p.id)) return
    placed.add(p.id)
    out.push({ person: p, depth })
    for (const r of profiles) if (r.id !== p.id && managerOf(r, profiles) === p.id) visit(r, depth + 1)
  }
  for (const p of profiles) if (!managerOf(p, profiles)) visit(p, 0)
  for (const p of profiles) visit(p, 0)  // anyone caught in a reporting loop
  return out
}

export function initials(p: Pick<Profile, 'full_name' | 'email'> | undefined | null) {
  if (!p) return '?'
  const name = (p.full_name ?? '').trim()
  if (name) {
    const parts = name.split(/\s+/)
    const first = parts[0][0] ?? ''
    const last = parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] ?? ''
    return (first + last).toUpperCase()
  }
  return (p.email[0] ?? '?').toUpperCase()
}

export function firstName(p: Profile | undefined | null) {
  if (!p) return 'Unassigned'
  return (p.full_name ?? p.email.split('@')[0]).split(' ')[0]
}

export function displayName(p: Profile | undefined | null) {
  if (!p) return 'Unassigned'
  return p.full_name ?? p.email.split('@')[0]
}

const PERSON_COLORS: Record<string, string> = {
  MK: '#1d4ed8',
  AF: '#0f766e',
  CT: '#9333ea',
}
const FALLBACK_COLORS = ['#b45309', '#be185d', '#0369a1', '#4d7c0f', '#7c3aed']

export function personColor(p: Pick<Profile, 'full_name' | 'email'> | undefined | null) {
  const key = initials(p)
  if (PERSON_COLORS[key]) return PERSON_COLORS[key]
  let h = 0
  for (const c of p?.email ?? key) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length]
}

// ---------- dates & quarters ----------

export function quarterLabel(q: number, year: number) {
  return `Q${q} ${year}`
}

export function currentQuarter() {
  const now = new Date()
  return { q: Math.ceil((now.getMonth() + 1) / 3), year: now.getFullYear() }
}

export function shortDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d.length === 10 ? d + 'T00:00' : d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function monthKey(d: Date = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// Monday of the week containing d, as YYYY-MM-DD (local time)
export function weekOf(d: Date = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
