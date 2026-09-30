import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Notification } from '../types/database'

export function useNotifications(userId: string) {
  const [items, setItems] = useState<Notification[]>([])

  useEffect(() => {
    if (!userId) return
    fetchItems()
    const t = setInterval(fetchItems, 60_000)
    return () => clearInterval(t)
  }, [userId])

  async function fetchItems() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)
    setItems((data as Notification[]) ?? [])
  }

  async function markRead(id: string) {
    const now = new Date().toISOString()
    setItems(n => n.map(x => x.id === id ? { ...x, read_at: now } : x))
    await supabase.from('notifications').update({ read_at: now }).eq('id', id)
  }

  // "Discuss" flags the task for the next team meeting and clears the notification
  async function discuss(n: Notification) {
    if (n.task_id) await supabase.from('team_tasks').update({ needs_discussion: true }).eq('id', n.task_id)
    await markRead(n.id)
  }

  const unread = items.filter(n => !n.read_at)
  return { items, unread, markRead, discuss, refetch: fetchItems }
}
