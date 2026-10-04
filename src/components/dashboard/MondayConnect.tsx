import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, ExternalLink, LayoutTemplate, Link2, RefreshCw, X } from 'lucide-react'
import { useMonday, type ColumnMap, type MondayBoard, type MondayColumn } from '../../hooks/useMonday'
import { shortDate } from '../../lib/team'

const OS_BOARD_URL = 'https://boxunited.monday.com/boards/18433914012'

const FIELDS: { key: keyof ColumnMap; label: string; help: string; fits: (c: MondayColumn) => boolean }[] = [
  { key: 'link', label: 'Rock / KPI / Goal', help: 'Link column to the shared Rocks, KPIs & Goals board', fits: c => c.type === 'board_relation' && c.linksToOs },
  { key: 'team', label: 'Team', help: 'Checkbox: ticked tasks go on the Team Board', fits: c => c.type === 'checkbox' },
  { key: 'done', label: 'Done', help: 'Checkbox or status column', fits: c => c.type === 'checkbox' || c.type === 'status' || c.type === 'color' },
  { key: 'due', label: 'Due date', help: 'Date column', fits: c => c.type === 'date' },
]

// Best guess at which column is which, from titles and types
function guess(board: MondayBoard): ColumnMap {
  const cols = board.columns
  const title = (c: MondayColumn) => c.title.toLowerCase()
  return {
    link: cols.find(c => c.type === 'board_relation' && c.linksToOs)?.id,
    team: cols.find(c => c.type === 'checkbox' && title(c).trim() === 'team')?.id,
    done: (cols.find(c => c.type === 'checkbox' && /done|complete|✓/.test(title(c)))
      ?? cols.find(c => (c.type === 'status' || c.type === 'color') && title(c) === 'status'))?.id,
    due: (cols.find(c => c.type === 'date' && title(c).includes('due')) ?? cols.find(c => c.type === 'date'))?.id,
  }
}

// "Connect Monday" button for the top of your dashboard, and the window it opens
export function MondayButton({ userId, onSynced }: { userId: string; onSynced: () => void }) {
  const monday = useMonday(userId)
  const [open, setOpen] = useState(false)
  if (monday.loading) return null
  const conn = monday.connection

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border shadow-sm bg-white hover:bg-gray-50"
        style={{ borderColor: conn ? '#bbf7d0' : '#e5e7eb', color: conn ? '#15803d' : '#374151' }}>
        {conn ? <CheckCircle2 size={14} /> : <Link2 size={14} />}
        {conn ? 'Monday connected' : 'Connect Monday'}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="monday-title" className="card w-full max-w-2xl p-6 max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-1">
                <h2 id="monday-title" className="text-base font-bold text-gray-900" style={{ fontFamily: 'Archivo, sans-serif' }}>Monday.com</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Tasks on your Monday board come here when they're linked to a rock, KPI or goal, or ticked <b>Team</b>.
                  Everything else stays in Monday.
                </p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            {conn ? <Connected monday={monday} onSynced={onSynced} /> : <Connect monday={monday} onDone={onSynced} />}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

function Connected({ monday, onSynced }: { monday: ReturnType<typeof useMonday>; onSynced: () => void }) {
  const conn = monday.connection!
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirm, setConfirm] = useState(false)

  async function run(fn: () => Promise<string>) {
    setBusy(true)
    setMsg(null)
    try { setMsg({ ok: true, text: await fn() }) } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
    setBusy(false)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-100 p-4 flex flex-wrap items-center gap-3">
        <CheckCircle2 size={18} className="text-green-600" />
        <div className="flex-1 min-w-[180px]">
          <p className="text-sm font-semibold text-gray-900">{conn.board_name ?? 'Your Monday board'}</p>
          <p className="text-xs text-gray-400">{conn.last_synced_at ? `Last full sync ${shortDate(conn.last_synced_at)}` : 'Changes come over as you make them'}</p>
        </div>
        {conn.board_url && (
          <a href={conn.board_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
            Open board <ExternalLink size={11} />
          </a>
        )}
      </div>
      <ul className="text-xs text-gray-600 space-y-1 list-disc pl-5">
        <li>In Monday, pick a rock, KPI or goal in the <b>Rock / KPI / Goal</b> column and the task shows on your dashboard.</li>
        <li>Tick <b>Team</b> to also put it on the Team Board.</li>
        <li>Your rocks, KPIs and goals are kept up to date on the shared <a href={OS_BOARD_URL} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Rocks, KPIs &amp; Goals</a> board.</li>
      </ul>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-xs ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {confirm ? (
          <>
            <span className="text-xs text-gray-600 mr-auto">Stop syncing this board? Your Monday board isn't changed.</span>
            <button onClick={() => setConfirm(false)} className="text-xs text-gray-500 px-3 py-1.5">Keep</button>
            <button disabled={busy} onClick={() => run(async () => { await monday.disconnect(); onSynced(); return 'Disconnected.' })}
              className="text-xs font-semibold text-red-600 border border-red-200 px-3 py-1.5 rounded-lg">Disconnect</button>
          </>
        ) : (
          <>
            <button onClick={() => setConfirm(true)} className="text-xs text-gray-500 hover:text-red-600 px-3 py-1.5 mr-auto">Disconnect</button>
            <button disabled={busy} onClick={() => run(async () => {
              const r = await monday.sync()
              onSynced()
              return `Synced. ${r.imported} task${r.imported === 1 ? '' : 's'} from your board ${r.imported === 1 ? 'is' : 'are'} in the OS.`
            })} className="flex items-center gap-1.5 text-xs font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-50" style={{ background: '#2563EB' }}>
              <RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> Sync now
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Connect({ monday, onDone }: { monday: ReturnType<typeof useMonday>; onDone: () => void }) {
  const [boards, setBoards] = useState<MondayBoard[] | null>(null)
  const [boardId, setBoardId] = useState('')
  const [map, setMap] = useState<ColumnMap>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const board = boards?.find(b => b.id === boardId)
  const missing = board && (!board.columns.some(c => c.type === 'board_relation' && c.linksToOs) || !board.columns.some(c => c.type === 'checkbox' && c.title.trim().toLowerCase() === 'team'))

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try { await fn() } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }

  function pick(id: string, list = boards) {
    setBoardId(id)
    const b = list?.find(x => x.id === id)
    setMap(b ? guess(b) : {})
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-100 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><LayoutTemplate size={15} className="text-blue-600" /> Start a new board</div>
          <p className="text-xs text-gray-500 flex-1">Creates "My Tasks – your name" from the Box United template: ✓ Done, Due date, Priority, Rock / KPI / Goal, Team and Notes.</p>
          <button disabled={busy} onClick={() => run(async () => { await monday.createFromTemplate(); onDone() })}
            className="self-start text-xs font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-50" style={{ background: '#2563EB' }}>
            {busy ? 'Working…' : 'Create my board'}
          </button>
        </div>

        <div className="rounded-xl border border-gray-100 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Link2 size={15} className="text-blue-600" /> Use a board I already have</div>
          {!boards ? (
            <>
              <p className="text-xs text-gray-500 flex-1">Keep your current board. We'll add a Rock / KPI / Goal link and a Team checkbox if it doesn't have them.</p>
              <button disabled={busy} onClick={() => run(async () => setBoards(await monday.listBoards()))}
                className="self-start text-xs font-semibold text-blue-600 border border-blue-200 px-4 py-2 rounded-lg disabled:opacity-50">
                {busy ? 'Loading…' : 'Choose board'}
              </button>
            </>
          ) : (
            <select value={boardId} onChange={e => pick(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
              <option value="">Select a board…</option>
              {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {board && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-2">
          {missing && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700 mb-2">
              <span className="flex-1">This board needs a <b>Rock / KPI / Goal</b> link and a <b>Team</b> checkbox.</span>
              <button disabled={busy} onClick={() => run(async () => {
                await monday.addColumns(board.id)
                const fresh = await monday.listBoards()
                setBoards(fresh)
                pick(board.id, fresh)
              })} className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: '#2563EB' }}>
                Add them for me
              </button>
            </div>
          )}
          {FIELDS.map(f => (
            <label key={f.key} className="flex items-center gap-2 text-xs text-gray-600">
              <span className="w-32 shrink-0 font-medium">{f.label}</span>
              <select value={map[f.key] ?? ''} onChange={e => setMap(m => ({ ...m, [f.key]: e.target.value || undefined }))}
                className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                <option value="">{f.help}</option>
                {board.columns.filter(f.fits).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
          ))}
          <div className="flex justify-end pt-1">
            <button disabled={busy || (!map.link && !map.team)} onClick={() => run(async () => { await monday.linkBoard(board.id, map); onDone() })}
              className="text-xs font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-50" style={{ background: '#2563EB' }}>
              {busy ? 'Connecting…' : 'Connect this board'}
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
