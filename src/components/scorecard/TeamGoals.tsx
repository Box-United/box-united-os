import { useState, type ReactNode } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useAnnualGoals } from '../../hooks/useAnnualGoals'
import type { AnnualGoal, Department, GoalStatus } from '../../types/database'
import { useTeam, displayName } from '../../lib/team'
import { DEPARTMENTS, deptInfo, leadsOf } from '../../lib/departments'
import { SectionLabel } from '../layout/PageShell'
import { Avatar } from '../ui/Avatar'
import { StatusPill } from '../ui/StatusPill'
import { DeptSelect, DeptTag } from '../ui/DeptTag'
import { GoalRollup } from './GoalRollup'
import { useGoalChildren } from '../../hooks/useGoalLinks'
import { useKeyMetrics } from '../../hooks/useKeyMetrics'

const GOAL_OPTIONS: GoalStatus[] = ['not-started', 'in-progress', 'on-track', 'done']

interface Props {
  year: number
  // Limits which goals are listed (e.g. to the viewer's departments)
  filter?: (g: AnnualGoal) => boolean
  defaultDept?: Department | null
  footer?: ReactNode
}

// Team annual goals, each tagged with a department (or the whole team)
export function TeamGoals({ year, filter, defaultDept = null, footer }: Props) {
  const { me, profiles } = useTeam()
  // Department goals are managed by that department's lead (or the ED); whole-team goals by anyone
  const leads = leadsOf(me, profiles)
  const canManage = (g: AnnualGoal) => !g.department || leads.includes(g.department)
  const startDept = defaultDept && leads.includes(defaultDept) ? defaultDept : null
  const { goals: all, loading, error, addGoal, updateGoalStatus, updateGoal, deleteGoal } = useAnnualGoals(year, me.id)
  // Rocks / KPIs under each goal, and the key metric each goal moves
  const children = useGoalChildren('team', all.map(g => g.id))
  const metrics = useKeyMetrics().defs
  const goals = filter ? all.filter(filter) : all
  // Whole-team goals first, then each department's
  const groups = [null, ...DEPARTMENTS.map(d => d.id)]
    .map(dept => ({ id: dept ?? 'team', dept, goals: goals.filter(g => (g.department ?? null) === dept) }))
    .filter(g => g.goals.length > 0)

  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newOwner, setNewOwner] = useState('')
  const [newDept, setNewDept] = useState<Department | null>(startDept)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  async function handleAdd() {
    if (!newTitle.trim()) return
    const g = await addGoal(newTitle.trim(), newDesc.trim() || undefined, newOwner || undefined, newDept)
    if (!g) return
    setNote(filter && !filter(g)
      ? `Added. It's tagged ${deptInfo(g.department)?.label ?? 'to another department'}, so it shows on the Team Board rather than here.`
      : null)
    setNewTitle('')
    setNewDesc('')
    setNewOwner('')
    setNewDept(startDept)
    setShowAdd(false)
  }

  return (
    <section>
      <SectionLabel
        right={
          <button onClick={() => setShowAdd(v => !v)} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
            <Plus size={13} /> Add goal
          </button>
        }
      >
        Team annual goals · {year}
      </SectionLabel>
      {error && <p role="alert" className="text-xs text-red-600 mb-2">{error}</p>}
      {note && <p className="text-xs text-blue-700 mb-2">{note}</p>}

      {showAdd && (
        <div className="card p-5 mb-3 border border-blue-100">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_1fr] gap-3">
            <input autoFocus type="text" placeholder="Goal title…" value={newTitle} onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="text-sm text-gray-800 outline-none border border-gray-200 rounded-lg px-3 py-2" />
            <input type="text" placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)}
              className="text-sm text-gray-500 outline-none border border-gray-200 rounded-lg px-3 py-2" />
            <select value={newOwner} onChange={e => setNewOwner(e.target.value)} className="text-sm text-gray-700 outline-none border border-gray-200 rounded-lg px-3 py-2 bg-white">
              <option value="">Owner (optional)</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{displayName(p)}{p.id === me.id ? ' (me)' : ''}</option>)}
            </select>
            <select value={newDept ?? ''} onChange={e => setNewDept((e.target.value || null) as Department | null)} aria-label="Department"
              className="text-sm text-gray-700 outline-none border border-gray-200 rounded-lg px-3 py-2 bg-white">
              <option value="">Whole team</option>
              {DEPARTMENTS.filter(d => leads.includes(d.id)).map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end mt-3">
            <button onClick={() => setShowAdd(false)} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">Cancel</button>
            <button onClick={handleAdd} disabled={!newTitle.trim()} className="text-xs font-semibold text-white px-4 py-1.5 rounded-lg disabled:opacity-40" style={{ background: '#2563EB' }}>
              Save goal
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card h-14 animate-pulse" />
      ) : goals.length === 0 ? (
        <div className="card p-6 text-sm text-gray-400">
          {filter && all.length > 0 ? `No team goals for your departments in ${year}.` : `No goals for ${year} yet.`}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(group => (
            <div key={group.id}>
              <div className="flex items-center gap-2 mb-1.5">
                <DeptTag dept={group.dept} noneLabel="Whole team" />
                <span className="text-[11px] text-gray-400">{group.goals.length} goal{group.goals.length === 1 ? '' : 's'}</span>
              </div>
              <div className="card divide-y divide-gray-50">
                {group.goals.map(goal => {
                  const expanded = expandedId === goal.id
                  return (
                    <div key={goal.id} className="px-4 py-3 group">
                      <div className="flex flex-wrap items-center gap-3">
                        {goal.owner && <Avatar profile={goal.owner} size={24} />}
                        <p className="flex-1 min-w-[160px] text-sm font-medium text-gray-900 leading-snug">{goal.title}</p>
                        {canManage(goal)
                          ? <DeptSelect value={goal.department} only={leads} onChange={d => updateGoal(goal.id, { department: d })} />
                          : <DeptTag dept={goal.department} />}
                        <StatusPill status={goal.status} options={canManage(goal) ? GOAL_OPTIONS : undefined}
                          onChange={canManage(goal) ? s => updateGoalStatus(goal.id, s as GoalStatus) : undefined} />
                        {goal.description && (
                          <button onClick={() => setExpandedId(expanded ? null : goal.id)} aria-label="Show description" className="text-gray-300 hover:text-gray-500">
                            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        )}
                        {(goal.department ? canManage(goal) : goal.created_by === me.id || me.role === 'executive_director') && (
                          <button onClick={() => deleteGoal(goal.id)} aria-label="Delete goal" className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      {goal.description && expanded && <p className="text-xs text-gray-500 mt-2 leading-relaxed">{goal.description}</p>}
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-gray-500">
                        <span>Moves key metric:</span>
                        {canManage(goal) ? (
                          <select value={goal.metric_key ?? ''} onChange={e => updateGoal(goal.id, { metric_key: e.target.value || null })} aria-label="Key metric"
                            className="text-[11px] rounded-full px-2 py-0.5 bg-gray-50 text-gray-700 outline-none border-none cursor-pointer">
                            <option value="">None</option>
                            {metrics.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                          </select>
                        ) : (
                          <span className="font-semibold text-gray-700">{metrics.find(m => m.key === goal.metric_key)?.label ?? 'None'}</span>
                        )}
                      </div>
                      <GoalRollup {...children.under(goal.id)} />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {footer}
    </section>
  )
}
