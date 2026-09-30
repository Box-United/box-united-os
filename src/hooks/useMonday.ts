import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MondayConnection } from '../types/database'

export interface MondayBoard {
  id: string
  name: string
  url: string
  columns: { id: string; title: string; type: string }[]
}

// Talks to the `monday-connect` edge function, which holds the Monday API token.
async function call<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('monday-connect', { body: { action, ...body } })
  if (error) {
    let msg = error.message
    try {
      const ctx = (error as { context?: Response }).context
      const j = ctx ? await ctx.json() : null
      if (j?.error) msg = j.error
    } catch { /* keep generic message */ }
    throw new Error(msg)
  }
  return data as T
}

export function useMonday(userId: string) {
  const [connection, setConnection] = useState<MondayConnection | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    supabase
      .from('monday_connections')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        setConnection((data as MondayConnection) ?? null)
        setLoading(false)
      })
  }, [userId])

  async function listBoards() {
    return (await call<{ boards: MondayBoard[] }>('list_boards')).boards
  }

  async function applyTemplate() {
    const r = await call<{ connection: MondayConnection }>('create_from_template')
    setConnection(r.connection)
  }

  async function linkBoard(boardId: string, columnMap: Record<string, string>) {
    const r = await call<{ connection: MondayConnection }>('link_board', { board_id: boardId, column_map: columnMap })
    setConnection(r.connection)
  }

  async function disconnect() {
    await call('disconnect')
    setConnection(null)
  }

  return { connection, loading, listBoards, applyTemplate, linkBoard, disconnect }
}
