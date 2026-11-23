import type { PicksIssueRow, PicksLegRow, PicksTicketRow } from './spare-change-api'
import { getServerClient } from './supabase-server'

// The Supabase side of spare-change-api.ts (migration 052). Server only (service role). Never logs a key or a hash.
const db = () => getServerClient()
const fail = (what: string, error: { code?: string } | null): never => {
  throw new Error(`${what} ${error?.code ?? 'failed'}`)
}

export interface ApiKeyRow {
  id: string
  name: string
  per_minute_limit: number
  daily_limit: number
  revoked_at: string | null
}

export async function keyByHash(hash: string): Promise<ApiKeyRow | null> {
  const { data, error } = await db().from('sc_api_keys').select('id, name, per_minute_limit, daily_limit, revoked_at').eq('key_hash', hash).maybeSingle()
  if (error) fail('api key', error)
  return (data as ApiKeyRow | null) ?? null
}

/** Count one request for this key today and return today's total. */
export async function countRequest(keyId: string, day: string): Promise<number> {
  const { data, error } = await db().rpc('sc_api_count_request', { p_key_id: keyId, p_day: day })
  if (error) fail('api count', error)
  return Number(data)
}

/** The issue for that date, or the newest one dated on or before `today` when date is null. */
export async function issueFor(date: string | null, today: string): Promise<PicksIssueRow | null> {
  let q = db().from('sc_issues').select('issue_date, issue_no, subject')
  q = date ? q.eq('issue_date', date) : q.lte('issue_date', today).order('issue_date', { ascending: false }).limit(1)
  const { data, error } = await q.maybeSingle()
  if (error) fail('issue', error)
  return (data as PicksIssueRow | null) ?? null
}

export async function ticketsAndLegs(issueDate: string): Promise<{ tickets: PicksTicketRow[]; legs: PicksLegRow[] }> {
  const { data: tickets, error } = await db()
    .from('sc_tickets')
    .select('id, position, site, name, buy_in_cents, est_payout_cents, headline_cents, one_in, min_age, link, estimated, result')
    .eq('issue_date', issueDate)
  if (error) fail('tickets', error)
  const rows = (tickets ?? []) as PicksTicketRow[]
  if (rows.length === 0) return { tickets: [], legs: [] }
  const { data: legs, error: legError } = await db()
    .from('sc_legs')
    .select('ticket_id, n, sport, league, event, starts_at, market, pick, price_text, price_decimal, result')
    .in('ticket_id', rows.map((t) => t.id))
  if (legError) fail('legs', legError)
  return { tickets: rows, legs: (legs ?? []) as PicksLegRow[] }
}

// ------------------------------------------------------------------------------------------------ admin page
export interface AdminKeyRow {
  id: string
  name: string
  contact_email: string | null
  note: string | null
  key_prefix: string
  per_minute_limit: number
  daily_limit: number
  created_by: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
  revoked_by: string | null
  today: number
  last7: number
}

export async function listKeys(today: string, weekStart: string): Promise<AdminKeyRow[]> {
  const { data: keys, error } = await db()
    .from('sc_api_keys')
    .select('id, name, contact_email, note, key_prefix, per_minute_limit, daily_limit, created_by, created_at, last_used_at, revoked_at, revoked_by')
    .order('created_at', { ascending: false })
  if (error) fail('api keys', error)
  const { data: usage, error: usageError } = await db().from('sc_api_usage').select('key_id, day, requests').gte('day', weekStart)
  if (usageError) fail('api usage', usageError)
  const u = (usage ?? []) as { key_id: string; day: string; requests: number }[]
  return ((keys ?? []) as Omit<AdminKeyRow, 'today' | 'last7'>[]).map((k) => {
    const mine = u.filter((r) => r.key_id === k.id)
    return { ...k, today: mine.find((r) => r.day === today)?.requests ?? 0, last7: mine.reduce((s, r) => s + r.requests, 0) }
  })
}

export async function insertKey(row: {
  name: string
  contact_email: string | null
  note: string | null
  key_prefix: string
  key_hash: string
  per_minute_limit: number
  daily_limit: number
  created_by: string
}): Promise<string> {
  const { data, error } = await db().from('sc_api_keys').insert(row).select('id').single()
  if (error) fail('api key insert', error)
  return (data as { id: string }).id
}

/** Revoke a key. False when there is no such key or it was already revoked. */
export async function revokeKey(id: string, by: string): Promise<boolean> {
  const { data, error } = await db()
    .from('sc_api_keys')
    .update({ revoked_at: new Date().toISOString(), revoked_by: by })
    .eq('id', id)
    .is('revoked_at', null)
    .select('id')
  if (error) fail('api key revoke', error)
  return (data ?? []).length > 0
}
