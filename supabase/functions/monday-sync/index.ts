// monday-sync: connects Box United OS and Monday.com. One self-contained file so it
// can be pasted into the Supabase dashboard editor. Turn OFF "Enforce JWT
// verification" for this function: Monday's webhooks can't send a Supabase login,
// so signed-in calls are checked here instead.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   MONDAY_API_TOKEN       a Monday personal API token (Profile → Developers)
//   MONDAY_WEBHOOK_SECRET  any long random string
//
// What it does
//   OS → Monday: copies everyone's rocks, KPIs, personal goals and team goals onto
//     the shared "Box United OS · Rocks, KPIs & Goals" board (action "sync").
//   Monday → OS: a task on a connected My Tasks board comes into the OS when it's
//     linked to one of those items (Rock / KPI / Goal column) or its Team box is
//     ticked. Linked tasks show on the person's dashboard; Team tasks also go on
//     the Team Board. Unlink and untick it and it leaves the OS again.
//
// Signed-in actions (POST { action }):
//   list_boards · create_from_template · add_columns · link_board · sync · sync_os · disconnect
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// Monday setup (boards built for Box United)

const WORKSPACE_ID = 14605658  // "Employee"
const TEMPLATE_BOARD_ID = 18433915280  // "My Tasks · Template"
const OS_BOARD = {
  id: 18433914012,  // "Box United OS · Rocks, KPIs & Goals"
  cols: { type: 'color_mm7tdw61', owner: 'multiple_person_mm7t3d8e', period: 'text_mm7tg9ty', done: 'boolean_mm7tyrmb', osId: 'text_mm7tecjg' },
  groups: { rock: 'topics', kpi: 'group_mm7tyj83', goal: 'group_mm7t2ww6', team_goal: 'group_mm7t33wf' },
  typeLabel: { rock: 'Rock', kpi: 'KPI', goal: 'Goal', team_goal: 'Team goal' },
}
// Column titles on the template (and the ones "add_columns" creates)
const TITLES = { done: '✓ Done', due: 'Due date', link: 'Rock / KPI / Goal', team: 'Team' }
const EVENTS = ['create_item', 'change_column_value', 'change_name', 'item_deleted', 'item_archived', 'item_restored']

type Kind = 'rock' | 'kpi' | 'goal' | 'team_goal'
interface ColumnMap { done?: string; due?: string; link?: string; team?: string }
interface Connection { user_id: string; board_id: string; column_map: ColumnMap; webhook_ids: string[] }
interface ColumnValue { id: string; type: string; text: string | null; value: string | null; linked_item_ids?: string[] }
interface MondayItem { id: string; name: string; state?: string; column_values: ColumnValue[] }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

async function monday<T = Record<string, unknown>>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const token = Deno.env.get('MONDAY_API_TOKEN')
  if (!token) throw new Error("Monday isn't set up yet: add the MONDAY_API_TOKEN secret in Supabase.")
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token, 'API-Version': '2024-10' },
    body: JSON.stringify({ query, variables }),
  })
  const body = await res.json()
  if (!res.ok || body.errors?.length || body.error_message) {
    throw new Error(body.errors?.[0]?.message ?? body.error_message ?? `Monday API error ${res.status}`)
  }
  return body.data as T
}

const ITEM_FIELDS = `id name state column_values { id type text value ... on BoardRelationValue { linked_item_ids } }`
const parse = (c?: ColumnValue) => { try { return c?.value ? JSON.parse(c.value) : null } catch { return null } }
const checked = (c?: ColumnValue) => { const v = parse(c)?.checked; return v === true || v === 'true' }

function admin() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}

// ---------------------------------------------------------------------------
// Entry point

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = new URL(req.url)
  if (url.searchParams.has('key')) return handleWebhook(req, url)
  return handleAction(req)
})

// ---------------------------------------------------------------------------
// Signed-in actions from the OS

async function handleAction(req: Request) {
  try {
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Sign in again to use Monday.' }, 401)

    const db = admin()
    const body = await req.json().catch(() => ({}))

    switch (body.action) {
      case 'list_boards': {
        const data = await monday<{ boards: { id: string; name: string; url: string; columns: { id: string; title: string; type: string; settings_str: string }[] }[] }>(
          `query { boards(limit: 200, state: active, order_by: used_at) { id name url columns { id title type settings_str } } }`,
        )
        // Skip the shared OS board, the template and subitem boards
        const boards = data.boards
          .filter(b => Number(b.id) !== OS_BOARD.id && Number(b.id) !== TEMPLATE_BOARD_ID && !b.name.startsWith('Subitems of'))
          .map(b => ({
            ...b,
            columns: b.columns.map(c => ({ id: c.id, title: c.title, type: c.type, linksToOs: linksToOsBoard(c) })),
          }))
        return json({ boards })
      }

      case 'create_from_template': {
        const { data: profile } = await db.from('profiles').select('full_name, email').eq('id', user.id).single()
        const first = (profile?.full_name ?? profile?.email ?? 'Team member').split(/[\s@]/)[0]
        const dup = await monday<{ duplicate_board: { board: { id: string } } }>(
          `mutation ($id: ID!, $name: String!, $ws: ID!) {
            duplicate_board(board_id: $id, duplicate_type: duplicate_board_with_structure, board_name: $name, workspace_id: $ws) { board { id } }
          }`,
          { id: TEMPLATE_BOARD_ID, name: `My Tasks – ${first}`, ws: WORKSPACE_ID },
        )
        const boardId = dup.duplicate_board.board.id
        const columnMap = await mapByTitle(boardId)
        const connection = await saveConnection(db, user.id, boardId, columnMap, true)
        await syncOsItems(db)
        return json({ connection })
      }

      // Adds the Rock / KPI / Goal link and Team checkbox to a board someone already uses
      case 'add_columns': {
        const boardId = String(body.board_id ?? '')
        if (!boardId) return json({ error: 'Pick a board first.' }, 400)
        const have = await boardColumns(boardId)
        if (!have.some(c => c.type === 'board_relation' && linksToOsBoard(c))) {
          await monday(
            `mutation ($b: ID!, $t: String!, $d: JSON) { create_column(board_id: $b, title: $t, column_type: board_relation, defaults: $d) { id } }`,
            { b: boardId, t: TITLES.link, d: JSON.stringify({ boardIds: [OS_BOARD.id], allowMultipleItems: false }) },
          )
        }
        if (!have.some(c => c.type === 'checkbox' && c.title.trim().toLowerCase() === 'team')) {
          await monday(
            `mutation ($b: ID!, $t: String!) { create_column(board_id: $b, title: $t, column_type: checkbox) { id } }`,
            { b: boardId, t: TITLES.team },
          )
        }
        return json({ ok: true })
      }

      case 'link_board': {
        const boardId = String(body.board_id ?? '')
        const map = (body.column_map ?? {}) as ColumnMap
        if (!boardId || (!map.link && !map.team)) return json({ error: 'Pick a board and its Rock / KPI / Goal or Team column.' }, 400)
        const connection = await saveConnection(db, user.id, boardId, map, false)
        await syncOsItems(db)
        const imported = await importBoard(db, connection)
        return json({ connection, imported })
      }

      // Refresh just the shared board (after rocks, KPIs or goals change in the OS)
      case 'sync_os':
        return json({ synced: await syncOsItems(db) })

      // Refresh the shared board, and re-read this person's board
      case 'sync': {
        const synced = await syncOsItems(db)
        const { data: conn } = await db.from('monday_connections').select('*').eq('user_id', user.id).maybeSingle()
        const imported = conn ? await importBoard(db, conn as Connection) : 0
        return json({ synced, imported })
      }

      case 'disconnect': {
        const { data: conn } = await db.from('monday_connections').select('webhook_ids').eq('user_id', user.id).maybeSingle()
        for (const id of (conn?.webhook_ids ?? []) as string[]) {
          await monday(`mutation ($id: ID!) { delete_webhook(id: $id) { id } }`, { id }).catch(() => null)
        }
        await db.from('monday_connections').delete().eq('user_id', user.id)
        return json({ ok: true })
      }

      default:
        return json({ error: 'Unknown action' }, 400)
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
}

function linksToOsBoard(c: { type: string; settings_str?: string }) {
  if (c.type !== 'board_relation') return false
  try { return (JSON.parse(c.settings_str ?? '{}').boardIds ?? []).map(Number).includes(OS_BOARD.id) } catch { return false }
}

async function boardColumns(boardId: string) {
  const data = await monday<{ boards: { columns: { id: string; title: string; type: string; settings_str: string }[] }[] }>(
    `query ($ids: [ID!]) { boards(ids: $ids) { columns { id title type settings_str } } }`, { ids: [boardId] },
  )
  return data.boards[0]?.columns ?? []
}

async function mapByTitle(boardId: string): Promise<ColumnMap> {
  const cols = await boardColumns(boardId)
  const find = (title: string) => cols.find(c => c.title === title)?.id
  return { done: find(TITLES.done), due: find(TITLES.due), link: find(TITLES.link), team: find(TITLES.team) }
}

async function saveConnection(db: SupabaseClient, userId: string, boardId: string, columnMap: ColumnMap, fromTemplate: boolean) {
  // Replace any previous board's webhooks
  const { data: existing } = await db.from('monday_connections').select('webhook_ids').eq('user_id', userId).maybeSingle()
  for (const id of (existing?.webhook_ids ?? []) as string[]) {
    await monday(`mutation ($id: ID!) { delete_webhook(id: $id) { id } }`, { id }).catch(() => null)
  }

  const secret = Deno.env.get('MONDAY_WEBHOOK_SECRET')
  if (!secret) throw new Error('Add the MONDAY_WEBHOOK_SECRET secret in Supabase.')
  const hookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/monday-sync?key=${encodeURIComponent(secret)}`
  const webhookIds: string[] = []
  for (const event of EVENTS) {
    const r = await monday<{ create_webhook: { id: string } }>(
      `mutation ($b: ID!, $u: String!, $e: WebhookEventType!) { create_webhook(board_id: $b, url: $u, event: $e) { id } }`,
      { b: boardId, u: hookUrl, e: event },
    )
    webhookIds.push(r.create_webhook.id)
  }

  const info = await monday<{ boards: { name: string; url: string }[] }>(`query ($ids: [ID!]) { boards(ids: $ids) { name url } }`, { ids: [boardId] })
  const row = {
    user_id: userId,
    board_id: boardId,
    board_name: info.boards[0]?.name ?? null,
    board_url: info.boards[0]?.url ?? null,
    column_map: columnMap,
    webhook_ids: webhookIds,
    from_template: fromTemplate,
  }
  const { data, error } = await db.from('monday_connections').upsert(row).select('*').single()
  if (error) throw new Error(error.message)
  return data as Connection
}

// ---------------------------------------------------------------------------
// OS → Monday: keep the shared Rocks, KPIs & Goals board up to date

interface OsThing { kind: Kind; id: string; name: string; ownerId: string | null; period: string; done: boolean }

async function syncOsItems(db: SupabaseClient) {
  const year = new Date().getFullYear()
  const [profiles, rocks, kpis, areas, goals, teamGoals, mapped] = await Promise.all([
    db.from('profiles').select('id, full_name, email'),
    db.from('rocks').select('id, user_id, title, status, quarter'),
    db.from('kpis').select('id, user_id, area_id, title, status'),
    db.from('kpi_areas').select('id, name'),
    db.from('individual_goals').select('id, user_id, title, status, year').gte('year', year),
    db.from('annual_goals').select('id, owner_id, title, status, year').gte('year', year),
    db.from('monday_items').select('*'),
  ])

  const people = new Map((profiles.data ?? []).map(p => [p.id, p]))
  const first = (id: string | null) => {
    const p = id ? people.get(id) : null
    return p ? (p.full_name ?? p.email).split(/[\s@]/)[0] : null
  }
  const label = (who: string | null, title: string) => (who ? `${who} · ${title}` : title)
  const areaName = new Map((areas.data ?? []).map(a => [a.id, a.name]))
  // Rocks for this year and later ("Q4 2026")
  const currentRocks = (rocks.data ?? []).filter(r => Number(String(r.quarter).split(' ')[1]) >= year)

  const things: OsThing[] = [
    ...currentRocks.map(r => ({ kind: 'rock' as Kind, id: r.id, name: label(first(r.user_id), r.title), ownerId: r.user_id, period: r.quarter, done: r.status === 'done' })),
    ...(kpis.data ?? []).map(k => ({ kind: 'kpi' as Kind, id: k.id, name: label(first(k.user_id), k.title), ownerId: k.user_id, period: areaName.get(k.area_id) ?? '', done: k.status === 'done' })),
    ...(goals.data ?? []).map(g => ({ kind: 'goal' as Kind, id: g.id, name: label(first(g.user_id), g.title), ownerId: g.user_id, period: String(g.year), done: g.status === 'done' })),
    ...(teamGoals.data ?? []).map(g => ({ kind: 'team_goal' as Kind, id: g.id, name: label('Team', g.title), ownerId: g.owner_id, period: String(g.year), done: g.status === 'done' })),
  ]

  // Monday user ids by email, for the Owner column
  const users = await monday<{ users: { id: string; email: string }[] }>(`query { users(kind: non_guests, limit: 200) { id email } }`)
  const mondayUser = new Map(users.users.map(u => [u.email.toLowerCase(), u.id]))
  const ownerValue = (ownerId: string | null) => {
    const email = ownerId ? people.get(ownerId)?.email?.toLowerCase() : null
    const uid = email ? mondayUser.get(email) : null
    return uid ? { personsAndTeams: [{ id: Number(uid), kind: 'person' }] } : null
  }

  const byKey = new Map((mapped.data ?? []).map(m => [`${m.os_kind}:${m.os_id}`, m]))
  let changed = 0

  for (const t of things) {
    const columns = {
      [OS_BOARD.cols.type]: { label: OS_BOARD.typeLabel[t.kind] },
      [OS_BOARD.cols.owner]: ownerValue(t.ownerId),
      [OS_BOARD.cols.period]: t.period,
      [OS_BOARD.cols.done]: t.done ? { checked: 'true' } : null,
      [OS_BOARD.cols.osId]: `${t.kind}:${t.id}`,
    }
    const hash = JSON.stringify([t.name, columns])
    const existing = byKey.get(`${t.kind}:${t.id}`)
    byKey.delete(`${t.kind}:${t.id}`)
    if (existing?.synced_hash === hash) continue

    if (existing) {
      await monday(
        `mutation ($b: ID!, $i: ID!, $v: JSON!) { change_multiple_column_values(board_id: $b, item_id: $i, column_values: $v) { id } }`,
        { b: OS_BOARD.id, i: existing.monday_item_id, v: JSON.stringify({ ...columns, name: t.name }) },
      )
      await db.from('monday_items').update({ synced_hash: hash }).eq('monday_item_id', existing.monday_item_id)
    } else {
      const created = await monday<{ create_item: { id: string } }>(
        `mutation ($b: ID!, $g: String!, $n: String!, $v: JSON!) { create_item(board_id: $b, group_id: $g, item_name: $n, column_values: $v) { id } }`,
        { b: OS_BOARD.id, g: OS_BOARD.groups[t.kind], n: t.name, v: JSON.stringify(columns) },
      )
      await db.from('monday_items').insert({ os_kind: t.kind, os_id: t.id, monday_item_id: String(created.create_item.id), synced_hash: hash })
    }
    changed++
  }

  // Anything deleted in the OS (or a past quarter's rock) comes off the shared board
  for (const gone of byKey.values()) {
    await monday(`mutation ($i: ID!) { delete_item(item_id: $i) { id } }`, { i: gone.monday_item_id }).catch(() => null)
    await db.from('monday_items').delete().eq('monday_item_id', gone.monday_item_id)
    changed++
  }
  return changed
}

// ---------------------------------------------------------------------------
// Monday → OS: bring linked / Team tasks onto the OS

async function handleWebhook(req: Request, url: URL) {
  if (url.searchParams.get('key') !== Deno.env.get('MONDAY_WEBHOOK_SECRET')) return new Response('forbidden', { status: 403 })
  const body = await req.json().catch(() => ({}))
  // Monday checks a new webhook URL by sending a challenge to echo back
  if (body.challenge) return Response.json({ challenge: body.challenge })

  const event = body.event
  if (!event?.pulseId || !event?.boardId) return Response.json({ ok: true, skipped: 'no item' })
  const db = admin()
  const itemId = String(event.pulseId)

  try {
    const { data: conn } = await db.from('monday_connections').select('*').eq('board_id', String(event.boardId)).maybeSingle()
    if (!conn) return Response.json({ ok: true, skipped: 'board not connected' })

    if (['delete_pulse', 'item_deleted', 'archive_pulse', 'item_archived'].includes(event.type)) {
      await db.from('team_tasks').delete().eq('monday_item_id', itemId).eq('source', 'monday')
      return Response.json({ ok: true, removed: itemId })
    }

    const data = await monday<{ items: MondayItem[] }>(`query ($ids: [ID!]) { items(ids: $ids) { ${ITEM_FIELDS} } }`, { ids: [itemId] })
    const item = data.items[0]
    if (!item) return Response.json({ ok: true, skipped: 'item not found' })
    const result = await applyItem(db, conn as Connection, item)
    return Response.json({ ok: true, result })
  } catch (e) {
    console.error(e)
    // 200 so Monday doesn't retry-storm on a permanent error; details are in the function logs
    return Response.json({ ok: false, error: (e as Error).message })
  }
}

// Re-read every item on a connected board (on connect and "Sync now")
async function importBoard(db: SupabaseClient, conn: Connection) {
  type Page = { cursor: string | null; items: MondayItem[] }
  const first = await monday<{ boards: { items_page: Page }[] }>(
    `query ($ids: [ID!]) { boards(ids: $ids) { items_page(limit: 100) { cursor items { ${ITEM_FIELDS} } } } }`, { ids: [conn.board_id] },
  )
  let page: Page | undefined = first.boards[0]?.items_page
  let count = 0
  while (page) {
    for (const item of page.items) {
      if ((await applyItem(db, conn, item)) === 'synced') count++
    }
    if (!page.cursor) break
    page = (await monday<{ next_items_page: Page }>(
      `query ($c: String!) { next_items_page(limit: 100, cursor: $c) { cursor items { ${ITEM_FIELDS} } } }`, { c: page.cursor },
    )).next_items_page
  }
  await db.from('monday_connections').update({ last_synced_at: new Date().toISOString() }).eq('user_id', conn.user_id)
  return count
}

async function applyItem(db: SupabaseClient, conn: Connection, item: MondayItem) {
  const map = conn.column_map ?? {}
  const col = (id?: string) => (id ? item.column_values.find(c => c.id === id) : undefined)

  const linkedIds = (col(map.link)?.linked_item_ids ?? []).map(String)
  type Link = { os_kind: Kind; os_id: string }
  let link: Link | null = null
  if (linkedIds.length) {
    const { data } = await db.from('monday_items').select('os_kind, os_id').in('monday_item_id', linkedIds).limit(1)
    link = (data?.[0] as Link | undefined) ?? null
  }
  const team = checked(col(map.team))

  if (!link && !team) {
    // Not linked and not Team: it stays in Monday only
    await db.from('team_tasks').delete().eq('monday_item_id', item.id).eq('source', 'monday')
    return 'skipped'
  }

  const doneCol = col(map.done)
  const done = doneCol?.type === 'checkbox' ? checked(doneCol) : /^(done|complete|completed)$/i.test(doneCol?.text?.trim() ?? '')
  const row = {
    title: item.name,
    assigned_to: conn.user_id,
    due_date: parse(col(map.due))?.date ?? null,
    status: done ? 'done' : 'todo',
    source: 'monday',
    monday_item_id: item.id,
    on_team_board: team,
    rock_id: link?.os_kind === 'rock' ? link.os_id : null,
    kpi_id: link?.os_kind === 'kpi' ? link.os_id : null,
    goal_id: link?.os_kind === 'goal' ? link.os_id : null,
    team_goal_id: link?.os_kind === 'team_goal' ? link.os_id : null,
  }

  const { data: existing } = await db.from('team_tasks').select('id').eq('monday_item_id', item.id).maybeSingle()
  if (existing) await db.from('team_tasks').update(row).eq('id', existing.id)
  else await db.from('team_tasks').insert({ ...row, created_by: conn.user_id, assigned_in_meeting: false })
  return 'synced'
}
