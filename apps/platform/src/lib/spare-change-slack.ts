import { parseLinkToken, parseUuid } from './spare-change-core'
import { getServerClient } from './supabase-server'

// Slack messages, each kind to its own Incoming Webhook (webhookFor). Unset = that kind is off. Best effort: they run after the request has
// answered (next/server `after`), and a failure is logged without the webhook address and never touches the request.
//
// 1. Every NEW Spare Change Millionaire subscriber (a repeat signup with the same email sends nothing): first name and last initial,
//    state, age, who referred them, and how many subscribers there are now. SPARE_CHANGE_SLACK_WEBHOOK_URL (#spare-change-subscribers).
// 2. Every referral that pays out (a referred friend's first slip verified, the referrer's $5 granted): both first names and initials,
//    the amount, and how many of the referrer's friends now count. SPARE_CHANGE_SLACK_REFERRALS_WEBHOOK_URL (#spare-change-referrals),
//    falling back to the subscribers webhook.
// 3. Every parlay click through a tracked link (/go): who (first name and initial, or "Someone"), which ticket, its buy-in and headline,
//    the site. SPARE_CHANGE_SLACK_CLICKS_WEBHOOK_URL (#spare-change-parlay-clicks) only: too many for the other channels.
// Never an email address, a birthday, a Venmo username or a link token.

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

/** 500 -> "$5", 250 -> "$2.50", 180000 -> "$1,800". */
const usd = (cents: number) => {
  const digits = cents % 100 ? 2 : 0
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

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

export type SlackKind = 'subscribers' | 'referrals' | 'clicks'

/** The webhook for one kind of message, or null when that kind is off (or the address isn't a Slack Incoming Webhook). */
export function webhookFor(kind: SlackKind, env: Record<string, string | undefined> = process.env): string | null {
  const subscribers = env.SPARE_CHANGE_SLACK_WEBHOOK_URL?.trim()
  const url =
    kind === 'subscribers' ? subscribers : kind === 'referrals' ? env.SPARE_CHANGE_SLACK_REFERRALS_WEBHOOK_URL?.trim() || subscribers : env.SPARE_CHANGE_SLACK_CLICKS_WEBHOOK_URL?.trim()
  return webhookOk(url) ? url : null
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
  const url = webhookFor('subscribers', env)
  if (!url) return
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
  const url = webhookFor('referrals', env)
  if (!url) return
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

export interface ClickTicket {
  name: string
  site: string
  buyInCents: number
  headlineCents: number
  /** YYYY-MM-DD */
  issueDate: string
}

export function clickSlackText(i: { memberName: string | null; ticket: ClickTicket | null }): string {
  const who = i.memberName ? `*${esc(shortName(i.memberName))}*` : 'Someone'
  if (!i.ticket) return `:dart: Parlay click: ${who} opened a ticket`
  const t = i.ticket
  const day = new Date(`${t.issueDate}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `:dart: Parlay click: ${who} opened ${esc(t.name)} (${usd(t.buyInCents)} → ${usd(t.headlineCents)}) on ${esc(t.site)} · issue of ${day}`
}

/** After a tracked-link redirect: look up the ticket and (when the link carried one) the member, then post. Never throws. */
export async function notifyParlayClick(i: { ticketId: string; token: string | null }, env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): Promise<void> {
  const url = webhookFor('clicks', env)
  const ticketId = parseUuid(i.ticketId)
  if (!url || !ticketId) return
  const token = parseLinkToken(i.token)
  let ticket: ClickTicket | null = null
  let memberName: string | null = null
  try {
    const db = getServerClient()
    const [t, m] = await Promise.all([
      db.from('sc_tickets').select('name, site, buy_in_cents, headline_cents, issue_date').eq('id', ticketId).maybeSingle(),
      token ? db.from('newsletter_waitlist').select('name').eq('link_token', token).maybeSingle() : Promise.resolve(null),
    ])
    const r = t.data as { name: string; site: string; buy_in_cents: number; headline_cents: number | string; issue_date: string } | null
    if (r) ticket = { name: r.name, site: r.site, buyInCents: r.buy_in_cents, headlineCents: Number(r.headline_cents), issueDate: r.issue_date }
    memberName = typeof m?.data?.name === 'string' ? m.data.name : null
  } catch {
    // The message still goes, just with less in it.
  }
  await postSlack(url, clickSlackText({ memberName, ticket }), fetchImpl)
}
