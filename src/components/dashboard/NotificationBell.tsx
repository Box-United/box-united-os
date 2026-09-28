import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import type { useNotifications } from '../../hooks/useNotifications'
import { shortDate } from '../../lib/team'

interface Props {
  notifications: ReturnType<typeof useNotifications>
}

export function NotificationBell({ notifications }: Props) {
  const { items, unread, markRead, discuss } = notifications
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={`Notifications (${unread.length} unread)`}
        className="relative w-10 h-10 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-800"
      >
        <Bell size={17} />
        {unread.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 text-[10px] font-bold text-white bg-red-500 rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
            {unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(340px,calc(100vw-32px))] card p-2 z-20 border border-gray-100">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500 px-2 pt-1 pb-2">Notifications</p>
          {items.length === 0 ? (
            <p className="text-sm text-gray-400 px-2 pb-3">
              Nothing yet. You'll hear here when someone adds a task to your board outside a meeting.
            </p>
          ) : (
            <div className="max-h-[360px] overflow-y-auto space-y-1">
              {items.map(n => (
                <div
                  key={n.id}
                  className="rounded-lg px-3 py-2.5 text-sm"
                  style={{ background: n.read_at ? 'transparent' : '#faf5ff', border: n.read_at ? '1px solid transparent' : '1px solid #ede9fe' }}
                >
                  <p className={n.read_at ? 'text-gray-500' : 'text-gray-800'}>{n.message}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs">
                    <span className="text-gray-400">{shortDate(n.created_at)}</span>
                    {!n.read_at && (
                      <>
                        <button onClick={() => markRead(n.id)} className="font-semibold text-blue-600 hover:underline">Accept</button>
                        <button onClick={() => discuss(n)} className="font-semibold text-violet-600 hover:underline" title="Flags the task for the next team meeting">
                          Discuss
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
