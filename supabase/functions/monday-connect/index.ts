// monday-connect: lets a signed-in person link their Monday board to Box United OS.
// Actions: list_boards · create_from_template · link_board · disconnect
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json, monday, webhookUrl } from '../_shared/monday.ts'

// Board webhooks we register; the webhook function re-reads the item each time.
const EVENTS = ['create_item', 'change_column_value', 'change_name', 'item_deleted']

// Standard Box United board columns created by "Use template"
const TEMPLATE_COLUMNS: { key: string; title: string; type: string }[] = [
  { key: 'owner', title: 'Owner', type: 'people' },
  { key: 'due', title: 'Due date', type: 'date' },
  { key: 'kpi', title: 'KPI', type: 'text' },
  { key: 'team', title: 'Team', type: 'checkbox' },
  { key: 'status', title: 'Status', type: 'status' },
]

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Sign in again to connect Monday.' }, 401)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const body = await req.json().catch(() => ({}))

    switch (body.action) {
      case 'list_boards': {
        const data = await monday<{ boards: { id: string; name: string; url: string; columns: { id: string; title: string; type: string }[] }[] }>(
          `query { boards(limit: 200, state: active, order_by: used_at) { id name url columns { id title type } } }`,
        )
        return json({ boards: data.boards })
      }

      case 'create_from_template': {
        const { data: profile } = await admin.from('profiles').select('full_name, email').eq('id', user.id).single()
        const name = `Box United · ${(profile?.full_name ?? profile?.email ?? 'Team member').split(' ')[0]}`
        const created = await monday<{ create_board: { id: string; url: string } }>(
          `mutation ($name: String!) { create_board(board_name: $name, board_kind: private) { id url } }`,
          { name },
        )
        const boardId = created.create_board.id
        const columnMap: Record<string, string> = {}
        for (const c of TEMPLATE_COLUMNS) {
          const col = await monday<{ create_column: { id: string } }>(
            `mutation ($board: ID!, $title: String!, $type: ColumnType!) { create_column(board_id: $board, title: $title, column_type: $type) { id } }`,
            { board: boardId, title: c.title, type: c.type },
          )
          columnMap[c.key] = col.create_column.id
        }
        const connection = await saveConnection(admin, user.id, boardId, name, created.create_board.url, columnMap, true)
        return json({ connection })
      }

      case 'link_board': {
        if (!body.board_id || !body.column_map?.team) return json({ error: 'Pick a board and its Team checkbox column.' }, 400)
        const data = await monday<{ boards: { id: string; name: string; url: string }[] }>(
          `query ($ids: [ID!]) { boards(ids: $ids) { id name url } }`,
          { ids: [String(body.board_id)] },
        )
        const b = data.boards[0]
        if (!b) return json({ error: 'That board wasn\'t found, or the Monday token can\'t see it.' }, 404)
        const connection = await saveConnection(admin, user.id, b.id, b.name, b.url, body.column_map, false)
        return json({ connection })
      }

      case 'disconnect': {
        const { data: existing } = await admin.from('monday_connections').select('webhook_ids').eq('user_id', user.id).maybeSingle()
        for (const id of (existing?.webhook_ids ?? []) as string[]) {
          await monday(`mutation ($id: ID!) { delete_webhook(id: $id) { id } }`, { id }).catch(() => null)
        }
        await admin.from('monday_connections').delete().eq('user_id', user.id)
        return json({ ok: true })
      }

      default:
        return json({ error: 'Unknown action' }, 400)
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})

// deno-lint-ignore no-explicit-any
async function saveConnection(admin: any, userId: string, boardId: string, boardName: string, boardUrl: string, columnMap: Record<string, string>, fromTemplate: boolean) {
  // Replace any previous board's webhooks
  const { data: existing } = await admin.from('monday_connections').select('webhook_ids').eq('user_id', userId).maybeSingle()
  for (const id of (existing?.webhook_ids ?? []) as string[]) {
    await monday(`mutation ($id: ID!) { delete_webhook(id: $id) { id } }`, { id }).catch(() => null)
  }

  const url = webhookUrl()
  const webhookIds: string[] = []
  for (const event of EVENTS) {
    const r = await monday<{ create_webhook: { id: string } }>(
      `mutation ($board: ID!, $url: String!, $event: WebhookEventType!) { create_webhook(board_id: $board, url: $url, event: $event) { id } }`,
      { board: boardId, url, event },
    )
    webhookIds.push(r.create_webhook.id)
  }

  const row = {
    user_id: userId,
    board_id: String(boardId),
    board_name: boardName,
    board_url: boardUrl,
    column_map: columnMap,
    webhook_ids: webhookIds,
    from_template: fromTemplate,
  }
  const { data, error } = await admin.from('monday_connections').upsert(row).select('*').single()
  if (error) throw new Error(error.message)
  return data
}
