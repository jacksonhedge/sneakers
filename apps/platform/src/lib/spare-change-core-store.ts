import { parseBirthday } from './spare-change'
import type {
  GoStore,
  IngestStore,
  IssueLeg,
  LegResult,
  LogEvent,
  Member,
  MemberStatus,
  PayoutStore,
  RewardForPayout,
  SettleStore,
  StoredTicket,
  TicketRef,
  Wager,
  WagerStatus,
  WagerStore,
} from './spare-change-core'
import { getServerClient } from './supabase-server'

// The Supabase side of spare-change-core.ts: the small reads and writes those rules are handed. Server only (service role).
// Each function is one or two plain statements; there are no transactions, so every write is either an upsert on a unique key or a
// conditional update, and the rules above are written to be run again after a failure. Nothing here logs an email address, a token, a
// Venmo username or a slip.
const db = () => getServerClient()
const fail = (what: string, error: { code?: string } | null): never => {
  throw new Error(`${what} ${error?.code ?? 'failed'}`)
}
const UNIQUE = '23505'

const MEMBER_COLUMNS = 'id, age_at_signup, birth_date, status, tester, daily_reward_cents, reward_days, extra_reward_days, started_on, referred_by_member_id, venmo_handle'
type MemberRow = { id: string; age_at_signup: number; birth_date: string | null; status: MemberStatus; tester: boolean; daily_reward_cents: number; reward_days: number; extra_reward_days: number; started_on: string | null; referred_by_member_id: string | null; venmo_handle: string | null }
const toMember = (r: MemberRow): Member => ({
  id: r.id,
  // Their age today, from their birthday, so someone who turns 21 during the run gets the 21+ sites from that day. Rows from before
  // the form asked for a birthday have none: for them it is still the age they typed when they signed up.
  age: (r.birth_date ? parseBirthday(r.birth_date)?.age : undefined) ?? r.age_at_signup,
  status: r.status,
  tester: r.tester,
  dailyRewardCents: r.daily_reward_cents,
  rewardDays: r.reward_days,
  extraRewardDays: r.extra_reward_days,
  startedOn: r.started_on,
  referredByMemberId: r.referred_by_member_id,
  venmoHandle: r.venmo_handle,
})
async function memberWhere(column: 'id' | 'email' | 'link_token', value: string): Promise<Member | null> {
  const { data, error } = await db().from('newsletter_waitlist').select(MEMBER_COLUMNS).eq(column, value).maybeSingle()
  if (error) fail('member', error)
  return data ? toMember(data as MemberRow) : null
}

const TICKET_COLUMNS = 'id, issue_date, position, site, min_age, link'
type TicketRow = { id: string; issue_date: string; position: number; site: string; min_age: number; link: string | null }
const toTicket = (r: TicketRow): TicketRef => ({ id: r.id, issueDate: r.issue_date, position: r.position, site: r.site, minAge: r.min_age, link: r.link })
async function ticketById(id: string): Promise<TicketRef | null> {
  const { data, error } = await db().from('sc_tickets').select(TICKET_COLUMNS).eq('id', id).maybeSingle()
  if (error) fail('ticket', error)
  return data ? toTicket(data as TicketRow) : null
}

/** One audit row. Best effort: a failure is logged (code only) and swallowed, so it can never break the thing it describes. */
export const logEvent: LogEvent = async (e) => {
  try {
    const { error } = await db().from('sc_member_events').insert({ member_id: e.memberId, type: e.type, ticket_id: e.ticketId ?? null, meta: e.meta ?? {}, ip_country: e.ipCountry ?? null })
    if (error) console.error('[spare-change-core-store] event not written', error.code)
  } catch {
    console.error('[spare-change-core-store] event not written')
  }
}

// ------------------------------------------------------------------------------------------------ ingest
const legRow = (ticketId: string, l: IssueLeg) => ({
  ticket_id: ticketId,
  n: l.n,
  sport: l.sport,
  league: l.league,
  event: l.event,
  starts_at: l.startsAt,
  market: l.market,
  pick: l.pick,
  price_text: l.priceText,
  price_decimal: l.priceDecimal.toFixed(4),
  source_ref: l.sourceRef,
})

export const ingestStore: IngestStore = {
  async ticketsForIssue(issueDate) {
    const { data: tickets, error } = await db().from('sc_tickets').select('id, position, site').eq('issue_date', issueDate)
    if (error) fail('tickets', error)
    const rows = (tickets ?? []) as Array<{ id: string; position: number; site: string }>
    if (rows.length === 0) return []
    const ids = rows.map((t) => t.id)
    const { data: legs, error: legsError } = await db().from('sc_legs').select('ticket_id, n, event, pick, source_ref').in('ticket_id', ids)
    if (legsError) fail('legs', legsError)
    const counts = await Promise.all(
      ids.map(async (id) => {
        const { count, error: countError } = await db().from('sc_wagers').select('id', { count: 'exact', head: true }).eq('ticket_id', id)
        if (countError || count === null) fail('wager count', countError)
        return count as number
      }),
    )
    return rows.map((t, i): StoredTicket => ({
      id: t.id,
      position: t.position,
      site: t.site,
      legs: ((legs ?? []) as Array<{ ticket_id: string; n: number; event: string; pick: string; source_ref: string | null }>).filter((l) => l.ticket_id === t.id).map((l) => ({ n: l.n, event: l.event, pick: l.pick, sourceRef: l.source_ref })),
      wagers: counts[i],
    }))
  },
  async upsertIssue(issue, source) {
    const { error } = await db()
      .from('sc_issues')
      .upsert({ issue_date: issue.issueDate, issue_no: issue.issueNo, subject: issue.subject, preheader: issue.preheader, from_name: issue.fromName, built_at: issue.builtAt, source }, { onConflict: 'issue_date' })
    if (error) fail('issue', error)
  },
  // result and settled_at are left out on purpose: posting an issue again never un-settles a ticket.
  async upsertTicket(issueDate, t) {
    const { data, error } = await db()
      .from('sc_tickets')
      .upsert(
        {
          issue_date: issueDate,
          position: t.position,
          site: t.site,
          name: t.name,
          buy_in_cents: t.buyInCents,
          est_payout_cents: t.estPayoutCents,
          headline_cents: t.headlineCents,
          one_in: t.oneIn,
          fair_one_in: t.fairOneIn,
          fee_cents: t.feeCents,
          min_age: t.minAge,
          link: t.link,
          estimated: t.estimated,
        },
        { onConflict: 'issue_date,position' },
      )
      .select('id')
      .single()
    if (error || !data) fail('ticket upsert', error)
    return (data as { id: string }).id
  },
  async replaceLegs(ticketId, legs) {
    const { error } = await db().from('sc_legs').upsert(legs.map((l) => legRow(ticketId, l)), { onConflict: 'ticket_id,n' })
    if (error) fail('legs upsert', error)
    const { error: trimError } = await db().from('sc_legs').delete().eq('ticket_id', ticketId).gt('n', legs.length)
    if (trimError) fail('legs trim', trimError)
  },
  // sc_wagers.ticket_id is ON DELETE RESTRICT, so even a mistake here cannot remove a ticket somebody has a wager on.
  async deleteTicket(ticketId) {
    const { error } = await db().from('sc_tickets').delete().eq('id', ticketId)
    if (error) fail('ticket delete', error)
  },
}

// ------------------------------------------------------------------------------------------------ the tracked link
export const goStore: GoStore = {
  ticketById,
  memberByLinkToken: (token) => memberWhere('link_token', token),
  // Read, then write. Two taps by the same person in the same instant could count as one; the unique (member_id, ticket_id) index means
  // they can never make two rows (the insert that loses is retried as an update).
  async recordTap(memberId, ticketId, nowIso) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data: row, error } = await db().from('sc_wagers').select('id, tap_count, tapped_at').eq('member_id', memberId).eq('ticket_id', ticketId).maybeSingle()
      if (error) fail('tap read', error)
      if (row) {
        const { error: updateError } = await db().from('sc_wagers').update({ tap_count: (row.tap_count ?? 0) + 1, tapped_at: row.tapped_at ?? nowIso }).eq('id', row.id)
        if (updateError) fail('tap update', updateError)
        return
      }
      const { error: insertError } = await db().from('sc_wagers').insert({ member_id: memberId, ticket_id: ticketId, status: 'tapped', source: 'tap', tapped_at: nowIso, tap_count: 1 })
      if (!insertError) return
      if (insertError.code !== UNIQUE) fail('tap insert', insertError)
    }
  },
  logEvent,
}

// ------------------------------------------------------------------------------------------------ slips, verification, rewards
const WAGER_COLUMNS = 'id, member_id, ticket_id, status'
const toWager = (r: { id: string; member_id: string; ticket_id: string; status: WagerStatus }): Wager => ({ id: r.id, memberId: r.member_id, ticketId: r.ticket_id, status: r.status })

export const wagerStore: WagerStore = {
  memberById: (id) => memberWhere('id', id),
  memberByEmail: (email) => memberWhere('email', email),
  ticketById,
  async ticketByPosition(issueDate, position) {
    const { data, error } = await db().from('sc_tickets').select(TICKET_COLUMNS).eq('issue_date', issueDate).eq('position', position).maybeSingle()
    if (error) fail('ticket', error)
    return data ? toTicket(data as TicketRow) : null
  },
  async wagerById(id) {
    const { data, error } = await db().from('sc_wagers').select(WAGER_COLUMNS).eq('id', id).maybeSingle()
    if (error) fail('wager', error)
    return data ? toWager(data) : null
  },
  async wagerFor(memberId, ticketId) {
    const { data, error } = await db().from('sc_wagers').select(WAGER_COLUMNS).eq('member_id', memberId).eq('ticket_id', ticketId).maybeSingle()
    if (error) fail('wager', error)
    return data ? toWager(data) : null
  },
  async saveSlip(i) {
    const slip = { slip_ref: i.slipRef, slip_bet_id: i.slipBetId, stake_cents: i.stakeCents, slip_received_at: i.nowIso }
    for (let attempt = 0; attempt < 2; attempt++) {
      const existing = await wagerStore.wagerFor(i.memberId, i.ticketId)
      if (existing?.status === 'verified') return 'already_verified'
      if (existing) {
        const { data, error } = await db().from('sc_wagers').update({ ...slip, status: 'submitted', rejected_reason: null }).eq('id', existing.id).neq('status', 'verified').select('id')
        if (error?.code === UNIQUE) return 'duplicate_slip'
        if (error) fail('slip update', error)
        return (data?.length ?? 0) === 1 ? { wagerId: existing.id } : 'already_verified'
      }
      const { data, error } = await db().from('sc_wagers').insert({ ...slip, member_id: i.memberId, ticket_id: i.ticketId, status: 'submitted', source: 'slip' }).select('id').single()
      if (!error && data) return { wagerId: (data as { id: string }).id }
      if (error?.code !== UNIQUE) fail('slip insert', error)
      // 23505 is one of two things: this slip_bet_id is on another wager, or a tap just made this member's row. Look for the first.
      if (i.slipBetId) {
        const { data: other, error: otherError } = await db().from('sc_wagers').select('id').eq('slip_bet_id', i.slipBetId).maybeSingle()
        if (otherError) fail('slip lookup', otherError)
        if (other) return 'duplicate_slip'
      }
    }
    return fail('slip insert', null)
  },
  async markVerified(wagerId, verifiedBy, nowIso) {
    const { data, error } = await db().from('sc_wagers').update({ status: 'verified', verified_at: nowIso, verified_by: verifiedBy, rejected_reason: null }).eq('id', wagerId).eq('status', 'submitted').select('id')
    if (error) fail('verify', error)
    return (data?.length ?? 0) === 1
  },
  // Who rejected it and when are in sc_member_events (type 'wager_rejected'); updated_at is kept by the database.
  async markRejected(wagerId, reason) {
    const { data, error } = await db().from('sc_wagers').update({ status: 'rejected', rejected_reason: reason }).eq('id', wagerId).in('status', ['tapped', 'submitted']).select('id')
    if (error) fail('reject', error)
    return (data?.length ?? 0) === 1
  },
  async hasDailyReward(memberId, issueDate) {
    const { count, error } = await db().from('sc_rewards').select('id', { count: 'exact', head: true }).eq('member_id', memberId).eq('issue_date', issueDate).in('kind', ['daily', 'referral_day'])
    if (error || count === null) fail('reward count', error)
    return (count as number) > 0
  },
  async startRewardWindow(memberId, issueDate) {
    const { error } = await db().from('newsletter_waitlist').update({ started_on: issueDate }).eq('id', memberId).is('started_on', null)
    if (error) fail('start window', error)
    const { data, error: readError } = await db().from('newsletter_waitlist').select('started_on').eq('id', memberId).maybeSingle()
    if (readError || !data?.started_on) fail('start window read', readError)
    return data!.started_on as string
  },
  async insertDailyReward(i) {
    const { data, error } = await db().from('sc_rewards').insert({ member_id: i.memberId, kind: 'daily', issue_date: i.issueDate, amount_cents: i.amountCents, wager_id: i.wagerId, note: i.note, earned_at: i.nowIso }).select('id').single()
    if (error?.code === UNIQUE) return 'duplicate'
    if (error || !data) fail('reward insert', error)
    return { rewardId: (data as { id: string }).id }
  },
  async referralCredit(friendId) {
    const { data, error } = await db().from('sc_referral_credits').select('referrer_id, qualified_at, days_granted, cents_granted, wager_id').eq('friend_id', friendId).maybeSingle()
    if (error) fail('credit', error)
    return data ? { referrerId: data.referrer_id, qualifiedAt: data.qualified_at, daysGranted: data.days_granted, centsGranted: data.cents_granted, wagerId: data.wager_id } : null
  },
  async creditedFriends(referrerId) {
    const { count, error } = await db().from('sc_referral_credits').select('id', { count: 'exact', head: true }).eq('referrer_id', referrerId).not('qualified_at', 'is', null).or('cents_granted.gt.0,days_granted.gt.0')
    if (error || count === null) fail('credit count', error)
    return count as number
  },
  async qualifyReferral(i) {
    const { error: insertError } = await db().from('sc_referral_credits').insert({ referrer_id: i.referrerId, friend_id: i.friendId, wager_id: i.wagerId, qualified_at: i.nowIso, days_granted: i.daysGranted, cents_granted: i.centsGranted })
    if (!insertError) return true
    if (insertError.code !== UNIQUE) fail('credit insert', insertError)
    // The friend already has a row (unique friend_id): fill it in only if it has not qualified yet.
    const { data, error } = await db().from('sc_referral_credits').update({ wager_id: i.wagerId, qualified_at: i.nowIso, days_granted: i.daysGranted, cents_granted: i.centsGranted }).eq('friend_id', i.friendId).is('qualified_at', null).select('id')
    if (error) fail('credit update', error)
    return (data?.length ?? 0) === 1
  },
  async insertReferralReward(i) {
    // issue_date stays null: two friends qualifying on the same day must both pay (the (member, kind, date) unique key ignores nulls).
    const { data, error } = await db().from('sc_rewards').insert({ member_id: i.referrerId, kind: 'referral', amount_cents: i.amountCents, wager_id: i.wagerId, note: i.note, earned_at: i.nowIso }).select('id').single()
    if (error?.code === UNIQUE) return 'duplicate'
    if (error || !data) fail('referral reward insert', error)
    return { rewardId: (data as { id: string }).id }
  },
  async referralDaysGranted(referrerId) {
    const { data, error } = await db().from('sc_referral_credits').select('days_granted').eq('referrer_id', referrerId).not('qualified_at', 'is', null)
    if (error) fail('credit sum', error)
    return ((data ?? []) as Array<{ days_granted: number }>).reduce((sum, r) => sum + r.days_granted, 0)
  },
  async raiseExtraRewardDays(referrerId, days) {
    const { error } = await db().from('newsletter_waitlist').update({ extra_reward_days: days }).eq('id', referrerId).lt('extra_reward_days', days)
    if (error) fail('extra days', error)
  },
  logEvent,
}

// ------------------------------------------------------------------------------------------------ payouts
export interface PayoutDue {
  member_id: string
  name: string
  venmo_handle: string
  state: string
  age_at_signup: number
  unpaid_count: number
  unpaid_cents: number
  oldest_earned_at: string
}
export interface UnpaidReward {
  id: string
  member_id: string
  kind: string
  issue_date: string | null
  amount_cents: number
  earned_at: string
  note: string | null
}

/** The Friday list: who is owed (the sc_payouts_due view) and the unpaid ledger rows behind each of them (their ids are what gets marked paid). */
export async function payoutsDue(): Promise<{ due: PayoutDue[]; rewards: UnpaidReward[] }> {
  const { data: due, error } = await db().from('sc_payouts_due').select('member_id, name, venmo_handle, state, age_at_signup, unpaid_count, unpaid_cents, oldest_earned_at').order('oldest_earned_at')
  if (error) fail('payouts due', error)
  const members = ((due ?? []) as PayoutDue[]).map((d) => d.member_id)
  if (members.length === 0) return { due: [], rewards: [] }
  const { data: rewards, error: rewardsError } = await db().from('sc_rewards').select('id, member_id, kind, issue_date, amount_cents, earned_at, note').is('paid_at', null).in('member_id', members).order('earned_at').limit(5000)
  if (rewardsError) fail('unpaid rewards', rewardsError)
  return { due: (due ?? []) as PayoutDue[], rewards: (rewards ?? []) as UnpaidReward[] }
}

export const payoutStore: PayoutStore = {
  async rewardsByIds(ids) {
    const { data: rewards, error } = await db().from('sc_rewards').select('id, member_id, amount_cents, paid_at').in('id', ids)
    if (error) fail('rewards', error)
    const rows = (rewards ?? []) as Array<{ id: string; member_id: string; amount_cents: number; paid_at: string | null }>
    if (rows.length === 0) return []
    const { data: members, error: membersError } = await db().from('newsletter_waitlist').select('id, venmo_handle').in('id', [...new Set(rows.map((r) => r.member_id))])
    if (membersError) fail('members', membersError)
    const venmo = new Map(((members ?? []) as Array<{ id: string; venmo_handle: string | null }>).map((m) => [m.id, m.venmo_handle]))
    return rows.map((r): RewardForPayout => ({ id: r.id, memberId: r.member_id, amountCents: r.amount_cents, paidAt: r.paid_at, venmoHandle: venmo.get(r.member_id) ?? null }))
  },
  async markPaid(rewardId, i) {
    const { data, error } = await db().from('sc_rewards').update({ paid_at: i.paidAt, pay_batch: i.batch, paid_to: i.paidTo }).eq('id', rewardId).is('paid_at', null).select('id')
    if (error) fail('mark paid', error)
    return (data?.length ?? 0) === 1
  },
  logEvent,
}

// ------------------------------------------------------------------------------------------------ settle
export const settleStore: SettleStore = {
  async ticketsWithLegs(issueDate) {
    const { data: tickets, error } = await db().from('sc_tickets').select('id, position').eq('issue_date', issueDate)
    if (error) fail('tickets', error)
    const rows = (tickets ?? []) as Array<{ id: string; position: number }>
    if (rows.length === 0) return []
    const { data: legs, error: legsError } = await db().from('sc_legs').select('ticket_id, n, price_decimal').in('ticket_id', rows.map((t) => t.id))
    if (legsError) fail('legs', legsError)
    const all = (legs ?? []) as Array<{ ticket_id: string; n: number; price_decimal: number | string }>
    return rows.map((t) => ({ id: t.id, position: t.position, legs: all.filter((l) => l.ticket_id === t.id).map((l) => ({ n: l.n, priceDecimal: Number(l.price_decimal) })) }))
  },
  // One statement per result (at most five), not one per leg.
  async setLegResults(ticketId, legs) {
    const byResult = new Map<LegResult, number[]>()
    for (const l of legs) byResult.set(l.result, [...(byResult.get(l.result) ?? []), l.n])
    for (const [result, ns] of byResult) {
      const { error } = await db().from('sc_legs').update({ result }).eq('ticket_id', ticketId).in('n', ns)
      if (error) fail('leg results', error)
    }
  },
  async setTicketResult(ticketId, result, settledAt) {
    const { error } = await db().from('sc_tickets').update({ result, settled_at: settledAt }).eq('id', ticketId)
    if (error) fail('ticket result', error)
  },
  async wagersForTicket(ticketId) {
    const { data, error } = await db().from('sc_wagers').select('id, stake_cents').eq('ticket_id', ticketId).limit(10000)
    if (error) fail('wagers', error)
    return ((data ?? []) as Array<{ id: string; stake_cents: number | null }>).map((w) => ({ id: w.id, stakeCents: w.stake_cents }))
  },
  async setWagerResults(wagerIds, result, payoutCents) {
    for (let i = 0; i < wagerIds.length; i += 200) {
      const { error } = await db().from('sc_wagers').update({ result, payout_cents: payoutCents }).in('id', wagerIds.slice(i, i + 200))
      if (error) fail('wager results', error)
    }
  },
}
