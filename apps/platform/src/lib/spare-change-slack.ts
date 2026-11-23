import { getServerClient } from './supabase-server'

// A Slack message for every NEW Spare Change Millionaire subscriber (a repeat signup with the same email sends nothing), posted to the
// Incoming Webhook in SPARE_CHANGE_SLACK_WEBHOOK_URL (#spare-change-signups). Unset = off. Best effort: it runs after the signup has
// answered (next/server `after`), and a failure is logged without the webhook address and never touches the signup.
//
// What it shows: first name and last initial, state, age, who referred them, and how many subscribers there are now. Never the email
// address or the birthday.

export interface NewSubscriber {
  name: string
  state: string
  age: number
  referredByMemberId: string | null
  /** The name typed in "who told you about us", when there was no referral link. */
  referredByName: string | null
}

/** "Sam Lee" -> "Sam L." Only the first name and an initial go to Slack. */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Someone'
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
}

/** Slack mrkdwn treats & < > as markup: escape anything a person typed. */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function signupSlackText(s: NewSubscriber, extra: { referrerName: string | null; total: number | null }): string {
  const who = `*${esc(shortName(s.name))}* (${esc(s.state)}, ${s.age})`
  const via = extra.referrerName
    ? ` · referred by *${esc(shortName(extra.referrerName))}* (link)`
    : s.referredByName
      ? ` · says ${esc(s.referredByName)} told them (no link, match by hand)`
      : ''
  const total = extra.total !== null ? ` · ${extra.total.toLocaleString('en-US')} subscribers` : ''
  return `:moneybag: New Spare Change subscriber: ${who}${via}${total}`
}

/** Only a Slack Incoming Webhook address is ever posted to. */
export function webhookOk(url: string | undefined): url is string {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname === 'hooks.slack.com' && u.pathname.startsWith('/services/')
  } catch {
    return false
  }
}

export async function postSlack(url: string, text: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(5000), redirect: 'error' })
    if (!res.ok) console.error('[spare-change-slack] post failed', res.status)
    return res.ok
  } catch {
    console.error('[spare-change-slack] post failed')
    return false
  }
}

/** Look up the referrer's name and the subscriber count, then post. Never throws. */
export async function notifyNewSubscriber(s: NewSubscriber, env: Record<string, string | undefined> = process.env): Promise<void> {
  const url = env.SPARE_CHANGE_SLACK_WEBHOOK_URL?.trim()
  if (!webhookOk(url)) return
  let referrerName: string | null = null
  let total: number | null = null
  try {
    const db = getServerClient()
    const [ref, count] = await Promise.all([
      s.referredByMemberId ? db.from('newsletter_waitlist').select('name').eq('id', s.referredByMemberId).maybeSingle() : Promise.resolve(null),
      db.from('newsletter_waitlist').select('id', { count: 'exact', head: true }).neq('status', 'removed'),
    ])
    referrerName = typeof ref?.data?.name === 'string' ? ref.data.name : null
    total = count.error ? null : count.count
  } catch {
    // The message still goes, just without the extras.
  }
  await postSlack(url, signupSlackText(s, { referrerName, total }))
}
