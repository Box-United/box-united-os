import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MondayConnection } from '../types/database'

export interface MondayColumn { id: string; title: string; type: string; linksToOs: boolean }
export interface MondayBoard { id: string; name: string; url: string; columns: MondayColumn[] }
export interface ColumnMap { done?: string; due?: string; link?: string; team?: string }

// Talks to the `monday-sync` edge function, which holds the Monday API token.
async function call<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('monday-sync', { body: { action, ...body } })
  if (error) {
    let msg = "Couldn't reach the Monday connector. It may not be set up in Supabase yet."
    try {
      const ctx = (error as { context?: Response }).context
      const j = ctx ? await ctx.json() : null
      if (j?.error) msg = j.error
    } catch { /* keep the generic message */ }
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

  return {
    connection,
    loading,
    listBoards: async () => (await call<{ boards: MondayBoard[] }>('list_boards')).boards,
    createFromTemplate: async () => setConnection((await call<{ connection: MondayConnection }>('create_from_template')).connection),
    addColumns: (boardId: string) => call('add_columns', { board_id: boardId }),
    linkBoard: async (boardId: string, columnMap: ColumnMap) => {
      const r = await call<{ connection: MondayConnection; imported: number }>('link_board', { board_id: boardId, column_map: columnMap })
      setConnection(r.connection)
      return r.imported
    },
    sync: () => call<{ synced: number; imported: number }>('sync'),
    disconnect: async () => {
      await call('disconnect')
      setConnection(null)
    },
  }
}
