// monday-webhook: receives Monday board events and mirrors team items onto the Team Board.
// An item syncs when its Team checkbox is ticked OR it has 2+ people assigned.
// Deploy with verify_jwt = false; requests are authenticated by the ?key= secret.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { monday } from '../_shared/monday.ts'

interface ColumnValue { id: string; type: string; text: string | null; value: string | null }

Deno.serve(async req => {
  const url = new URL(req.url)
  if (url.searchParams.get('key') !== Deno.env.get('MONDAY_WEBHOOK_SECRET')) {
    return new Response('forbidden', { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  // Monday verifies a new webhook URL by sending a challenge to echo back
  if (body.challenge) return Response.json({ challenge: body.challenge })

  const event = body.event
  if (!event?.pulseId || !event?.boardId) return Response.json({ ok: true, skipped: 'no item' })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const itemId = String(event.pulseId)

  try {
    const { data: conn } = await admin.from('monday_connections').select('*').eq('board_id', String(event.boardId)).maybeSingle()
    if (!conn) return Response.json({ ok: true, skipped: 'board not connected' })

    if (event.type === 'delete_pulse' || event.type === 'item_deleted') {
      await admin.from('team_tasks').delete().eq('monday_item_id', itemId)
      return Response.json({ ok: true, deleted: itemId })
    }

    const data = await monday<{ items: { id: string; name: string; column_values: ColumnValue[] }[] }>(
      `query ($ids: [ID!]) { items(ids: $ids) { id name column_values { id type text value } } }`,
      { ids: [itemId] },
    )
    const item = data.items[0]
    if (!item) return Response.json({ ok: true, skipped: 'item not found' })

    const map = conn.column_map as Record<string, string>
    const col = (id?: string) => (id ? item.column_values.find(c => c.id === id) : undefined)
    const parse = (c?: ColumnValue) => { try { return c?.value ? JSON.parse(c.value) : null } catch { return null } }

    const teamFlag = parse(col(map.team))?.checked === true || parse(col(map.team))?.checked === 'true'
    const peopleCol = col(map.owner) ?? item.column_values.find(c => c.type === 'people' || c.type === 'multiple-person')
    const peopleCount = (parse(peopleCol)?.personsAndTeams ?? []).length
    const isTeamItem = teamFlag || peopleCount >= 2

    if (!isTeamItem) {
      // Unticked: take it back off the Team Board if it was there
      await admin.from('team_tasks').delete().eq('monday_item_id', itemId).eq('source', 'monday')
      return Response.json({ ok: true, skipped: 'not a team item' })
    }

    const due = parse(col(map.due))?.date ?? null
    const statusCol = col(map.status) ?? item.column_values.find(c => c.type === 'status' || c.type === 'color')
    const done = /^(done|complete|completed)$/i.test(statusCol?.text ?? '')
    const kpiText = col(map.kpi)?.text?.trim() || null

    // Match a KPI by title on the board owner's KPIs, if the KPI column is filled in
    let kpiId: string | null = null
    if (kpiText) {
      const { data: k } = await admin.from('kpis').select('id').eq('user_id', conn.user_id).ilike('title', `%${kpiText}%`).limit(1)
      kpiId = k?.[0]?.id ?? null
    }

    const { data: existing } = await admin.from('team_tasks').select('id, kpi_id').eq('monday_item_id', itemId).maybeSingle()
    const row = {
      title: item.name,
      assigned_to: conn.user_id,
      due_date: due,
      status: done ? 'done' : 'todo',
      source: 'monday',
      monday_item_id: itemId,
      // don't wipe a link someone set by hand in the app
      kpi_id: kpiId ?? existing?.kpi_id ?? null,
    }

    if (existing) await admin.from('team_tasks').update(row).eq('id', existing.id)
    else await admin.from('team_tasks').insert({ ...row, created_by: conn.user_id, assigned_in_meeting: false })

    return Response.json({ ok: true, synced: itemId })
  } catch (e) {
    console.error(e)
    // 200 so Monday doesn't retry-storm on a permanent error; details are in the function logs
    return Response.json({ ok: false, error: (e as Error).message })
  }
})
