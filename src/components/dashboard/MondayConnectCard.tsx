import { useState } from 'react'
import { LayoutTemplate, Link2 } from 'lucide-react'
import type { useMonday, MondayBoard } from '../../hooks/useMonday'

interface Props {
  monday: ReturnType<typeof useMonday>
}

const FIELDS: { key: 'owner' | 'due' | 'kpi' | 'team'; label: string; types: string[]; help: string }[] = [
  { key: 'owner', label: 'Owner', types: ['people', 'multiple-person'], help: 'People column' },
  { key: 'due', label: 'Due date', types: ['date'], help: 'Date column' },
  { key: 'kpi', label: 'KPI', types: ['text', 'dropdown', 'status', 'color'], help: 'optional' },
  { key: 'team', label: 'Team flag', types: ['checkbox', 'boolean'], help: 'Checkbox — ticked items sync here' },
]

// One-time setup, shown on your own dashboard until your Monday board is connected.
export function MondayConnectCard({ monday }: Props) {
  const [boards, setBoards] = useState<MondayBoard[] | null>(null)
  const [boardId, setBoardId] = useState('')
  const [map, setMap] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)

  const board = boards?.find(b => b.id === boardId)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try { await fn() } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }

  if (hidden) return null

  return (
    <section className="card p-5 mb-5 border border-blue-100">
      <div className="flex flex-wrap items-start gap-2 mb-4">
        <div className="flex-1 min-w-[220px]">
          <h2 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Archivo, sans-serif' }}>Connect your Monday board</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Only items you tick as <b>Team</b> (or that have 2+ people assigned) come onto the Team Board. Everything else stays in Monday.
          </p>
        </div>
        <button onClick={() => setHidden(true)} className="text-xs text-gray-400 hover:text-gray-600">Later</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-100 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><LayoutTemplate size={15} className="text-blue-600" /> Use the standard template</div>
          <p className="text-xs text-gray-500 flex-1">Creates "Box United · your name" with Status, Owner, Due date, KPI and Team columns already set up.</p>
          <button disabled={busy} onClick={() => run(monday.applyTemplate)} className="self-start text-xs font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-50" style={{ background: '#2563EB' }}>
            Use template
          </button>
        </div>

        <div className="rounded-xl border border-gray-100 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Link2 size={15} className="text-blue-600" /> Link a board you already use</div>
          {!boards ? (
            <>
              <p className="text-xs text-gray-500 flex-1">Pick your board, then tell us which columns hold the owner, due date, KPI and team flag.</p>
              <button disabled={busy} onClick={() => run(async () => setBoards(await monday.listBoards()))}
                className="self-start text-xs font-semibold text-blue-600 border border-blue-200 px-4 py-2 rounded-lg disabled:opacity-50">
                Choose board
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <select value={boardId} onChange={e => { setBoardId(e.target.value); setMap({}) }}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
                <option value="">Select a board…</option>
                {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {board && FIELDS.map(f => (
                <label key={f.key} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-20 shrink-0 font-medium">{f.label}</span>
                  <select value={map[f.key] ?? ''} onChange={e => setMap(m => ({ ...m, [f.key]: e.target.value }))}
                    className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                    <option value="">{f.help}</option>
                    {board.columns.filter(c => f.types.includes(c.type)).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </label>
              ))}
              {board && (
                <button disabled={busy || !map.team} onClick={() => run(() => monday.linkBoard(board.id, map))}
                  className="text-xs font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-50" style={{ background: '#2563EB' }}>
                  Connect board
                </button>
              )}
              {board && !map.team && <p className="text-[11px] text-gray-400">Choose the Team checkbox column to connect. Add one in Monday if the board doesn't have it.</p>}
            </div>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
    </section>
  )
}
