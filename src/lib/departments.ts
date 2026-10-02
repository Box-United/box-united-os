import type { Department, Profile } from '../types/database'
import { managerOf } from './team'

export const DEPARTMENTS: { id: Department; label: string; color: string; bg: string }[] = [
  { id: 'program', label: 'Program', color: '#047857', bg: '#d1fae5' },
  { id: 'development', label: 'Development', color: '#6d28d9', bg: '#ede9fe' },
  { id: 'operations', label: 'Operations', color: '#b45309', bg: '#fef3c7' },
  { id: 'marketing', label: 'Marketing', color: '#be185d', bg: '#fce7f3' },
  { id: 'finance', label: 'Finance', color: '#1d4ed8', bg: '#dbeafe' },
  { id: 'accounting', label: 'Accounting', color: '#0e7490', bg: '#cffafe' },
]

export function deptInfo(d: Department | null | undefined) {
  return DEPARTMENTS.find(x => x.id === d)
}

// A person's own departments plus those of everyone who reports up to them,
// so a manager sees what their team covers
export function departmentsOf(person: Profile, profiles: Profile[]): Department[] {
  const out = new Set<Department>(person.departments ?? [])
  const seen = new Set([person.id])
  const queue = [person.id]
  while (queue.length) {
    const id = queue.shift()!
    for (const p of profiles) {
      if (seen.has(p.id) || managerOf(p, profiles) !== id) continue
      seen.add(p.id)
      queue.push(p.id)
      for (const d of p.departments ?? []) out.add(d)
    }
  }
  return DEPARTMENTS.map(d => d.id).filter(d => out.has(d))
}

// Whether something tagged `dept` belongs on this person's Scorecard.
// Untagged = whole team; the executive director sees every department.
export function makeRelevant(me: Profile, profiles: Profile[]) {
  const mine = new Set(departmentsOf(me, profiles))
  return (dept: Department | null | undefined) =>
    !dept || me.role === 'executive_director' || mine.has(dept)
}

// Departments this person leads: theirs, where the person they report to isn't
// also in it. The executive director leads every department. Mirrors
// public.leads_department; leads add and remove their department's key metrics.
export function leadsOf(person: Profile, profiles: Profile[]): Department[] {
  if (person.role === 'executive_director') return DEPARTMENTS.map(d => d.id)
  const manager = profiles.find(p => p.id === managerOf(person, profiles))
  return (person.departments ?? []).filter(d => !(manager?.departments ?? []).includes(d))
}
