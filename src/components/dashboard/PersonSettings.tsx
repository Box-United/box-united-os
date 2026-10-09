import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Department, Profile } from '../../types/database'
import { useTeam, displayName, firstName, managerOf, reportsUnder, isExecutiveDirector } from '../../lib/team'
import { DEPARTMENTS } from '../../lib/departments'

// The executive director sets who someone reports to, their departments, title and
// the name they go by. Reporting to the executive director is stored as "no
// manager", so it follows the role rather than whoever holds it.
// Reporting lines decide who can see someone's check-ins and reviews; departments
// decide which metrics and team goals show on their Scorecard.
export function PersonSettings({ person, onDone }: { person: Profile; onDone: () => void }) {
  const { profiles, reloadProfiles } = useTeam()
  const isExecPerson = person.role === 'executive_director'
  const [title, setTitle] = useState(person.title ?? '')
  const [goesBy, setGoesBy] = useState(person.preferred_name ?? '')
  const [managerId, setManagerId] = useState(managerOf(person, profiles) ?? '')
  const [departments, setDepartments] = useState<Department[]>(person.departments ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Can't report to themselves or to anyone who reports up to them
  const below = reportsUnder(person.id, profiles)
  const options = profiles.filter(p => p.id !== person.id && !below.has(p.id))

  function toggle(d: Department) {
    setDepartments(ds => ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d])
  }

  async function save() {
    setSaving(true)
    setError(null)
    const patch: Partial<Profile> = {
      title: title.trim() || null,
      departments: DEPARTMENTS.map(d => d.id).filter(d => departments.includes(d)),
    }
    // only sent when set, so other settings still save before migration 017
    if (goesBy.trim() || person.preferred_name) patch.preferred_name = goesBy.trim() || null
    if (!isExecPerson) patch.manager_id = isExecutiveDirector(profiles.find(p => p.id === managerId)) ? null : managerId || null
    const { data, error } = await supabase.from('profiles').update(patch).eq('id', person.id).select('id')
    setSaving(false)
    if (error || !data?.length) {
      setError(error?.message.includes('column') || error?.message.includes('constraint')
        ? "Couldn't save: the database needs the latest updates (migrations 008, 009 and 017)."
        : "Couldn't save. Only the executive director can change reporting lines and departments.")
      return
    }
    await reloadProfiles()
    onDone()
  }

  return (
    <section className="card p-5 mb-5 border border-blue-100">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {!isExecPerson && (
          <label className="block">
            <span className="block text-xs font-semibold text-gray-700 mb-1">Reports to</span>
            <select value={managerId} onChange={e => setManagerId(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
              {options.map(p => <option key={p.id} value={p.id}>{isExecutiveDirector(p) ? `Executive Director (${firstName(p)})` : displayName(p)}</option>)}
            </select>
          </label>
        )}
        <label className="block">
          <span className="block text-xs font-semibold text-gray-700 mb-1">Goes by <span className="font-normal text-gray-400">(optional)</span></span>
          <input value={goesBy} onChange={e => setGoesBy(e.target.value)} placeholder={`e.g. ${(person.full_name ?? '').split(' ')[0] || 'first name'}`}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-700 mb-1">Title</span>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Program Coordinator"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
        </label>
        <fieldset className="md:col-span-2">
          <legend className="block text-xs font-semibold text-gray-700 mb-1.5">Departments they work in or oversee</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {DEPARTMENTS.map(d => (
              <label key={d.id} className="flex items-center gap-1.5 text-sm text-gray-700">
                <input type="checkbox" checked={departments.includes(d.id)} onChange={() => toggle(d.id)} className="accent-blue-600" />
                {d.label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 mt-4">
        {error && <p role="alert" className="text-xs text-red-600 mr-auto">{error}</p>}
        <button onClick={onDone} className="text-xs text-gray-500 px-3 py-1.5">Cancel</button>
        <button onClick={save} disabled={saving} className="text-xs font-semibold text-white px-4 py-1.5 rounded-lg disabled:opacity-40" style={{ background: '#2563EB' }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </section>
  )
}
