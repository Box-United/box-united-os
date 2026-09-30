// Shared Monday.com helpers for the monday-connect and monday-webhook functions.
// Requires the MONDAY_API_TOKEN secret (Supabase → Edge Functions → Secrets).

export async function monday<T = Record<string, unknown>>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const token = Deno.env.get('MONDAY_API_TOKEN')
  if (!token) throw new Error('Monday isn\'t set up yet: the MONDAY_API_TOKEN secret is missing in Supabase.')
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token, 'API-Version': '2024-10' },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (!res.ok || json.errors?.length || json.error_message) {
    const msg = json.errors?.[0]?.message ?? json.error_message ?? `Monday API error ${res.status}`
    throw new Error(msg)
  }
  return json.data as T
}

export function webhookUrl() {
  const secret = Deno.env.get('MONDAY_WEBHOOK_SECRET')
  if (!secret) throw new Error('The MONDAY_WEBHOOK_SECRET secret is missing in Supabase.')
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/monday-webhook?key=${encodeURIComponent(secret)}`
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
