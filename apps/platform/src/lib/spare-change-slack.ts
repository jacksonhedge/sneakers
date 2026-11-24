import { getServerClient } from './supabase-server'

// Slack messages to the Incoming Webhook in SPARE_CHANGE_SLACK_WEBHOOK_URL (#spare-change-signups). Unset = off. Best effort: they run
// after the request has answered (next/server `after`), and a failure is logged without the webhook address and never touches the request.
//
// 1. Every NEW Spare Change Millionaire subscriber (a repeat signup with the same email sends nothing): first name and last initial,
//    state, age, who referred them, and how many subscribers there are now.
// 2. Every referral that pays out (a referred friend's first slip verified, the referrer's $5 granted): both first names and initials,
//    the amount, and how many of the referrer's friends now count.
// Never an email address, a birthday or a Venmo username.

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

/** 500 -> "$5", 250 -> "$2.50". */
const usd = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`

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

export interface ReferralEarned {
  referrerId: string
  friendId: string
  amountCents: number
}

export function referralSlackText(i: { referrerName: string | null; friendName: string | null; amountCents: number; counted: number | null; max: number }): string {
  const referrer = i.referrerName ? `*${esc(shortName(i.referrerName))}*` : 'a referrer'
  const friend = i.friendName ? ` *${esc(shortName(i.friendName))}*` : ''
  const of = i.counted !== null ? ` (${i.counted} of ${i.max} friends)` : ''
  return `:handshake: Referral earned: ${referrer} gets ${usd(i.amountCents)}. Their friend${friend} had a first slip verified${of}`
}

/** Look up both names and how many of the referrer's friends count now, then post. Never throws. */
export async function notifyReferralEarned(i: ReferralEarned, max: number, env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): Promise<void> {
  const url = env.SPARE_CHANGE_SLACK_WEBHOOK_URL?.trim()
  if (!webhookOk(url)) return
  let referrerName: string | null = null
  let friendName: string | null = null
  let counted: number | null = null
  try {
    const db = getServerClient()
    const [people, credits] = await Promise.all([
      db.from('newsletter_waitlist').select('id, name').in('id', [i.referrerId, i.friendId]),
      // The same count the referral rule uses (creditedFriends): qualified friends who earned something.
      db.from('sc_referral_credits').select('id', { count: 'exact', head: true }).eq('referrer_id', i.referrerId).not('qualified_at', 'is', null).or('cents_granted.gt.0,days_granted.gt.0'),
    ])
    const rows = (people.data ?? []) as Array<{ id: string; name: unknown }>
    const nameOf = (id: string) => {
      const n = rows.find((r) => r.id === id)?.name
      return typeof n === 'string' ? n : null
    }
    referrerName = nameOf(i.referrerId)
    friendName = nameOf(i.friendId)
    counted = credits.error ? null : credits.count
  } catch {
    // The message still goes, just without the names.
  }
  await postSlack(url, referralSlackText({ referrerName, friendName, amountCents: i.amountCents, counted, max }), fetchImpl)
}
