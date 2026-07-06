// apps/platform/src/app/api/roundup-demo/state/route.ts
import { NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { ensureSession, attachSessionCookie } from '@/lib/roundup/session'
import { fetchPolymarketPrice } from '@/lib/roundup/polymarket-price'
import { computePositionPnlCents } from '@sneakers/core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  let sessionId: string
  let isNew: boolean
  try {
    ;({ sessionId, isNew } = await ensureSession())
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'session_init_failed', message }, { status: 500 })
  }
  const sb = getServerClient()

  const { data: session, error: sessionErr } = await sb
    .from('roundup_demo_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single()
  if (sessionErr || !session) {
    return NextResponse.json({ error: 'session_not_found', message: sessionErr?.message }, { status: 500 })
  }

  const { data: txns, error: txnsErr } = await sb
    .from('roundup_demo_txns')
    .select('*')
    .eq('session_id', sessionId)
    .order('occurred_on', { ascending: false })
  if (txnsErr) {
    return NextResponse.json({ error: 'txns_load_failed', message: txnsErr.message }, { status: 500 })
  }

  const { data: positions, error: positionsErr } = await sb
    .from('roundup_demo_positions')
    .select('*')
    .eq('session_id', sessionId)
    .order('opened_at', { ascending: false })
  if (positionsErr) {
    return NextResponse.json({ error: 'positions_load_failed', message: positionsErr.message }, { status: 500 })
  }

  // Live price is fetched fresh on every call (same "server is authoritative,
  // recomputed on read" pattern as pendingAccruedCents below) -- the client never
  // calls Polymarket directly. A failed live-price lookup degrades gracefully to
  // showing the entry price only (currentPrice/pnlCents null) rather than failing
  // the whole state load.
  const positionsWithLivePrice = await Promise.all(
    (positions ?? []).map(async (p) => {
      let currentPrice: number | null = null
      try {
        const live = await fetchPolymarketPrice(p.market_id)
        currentPrice = live.price
      } catch {
        currentPrice = null
      }
      const entryPrice = Number(p.entry_price)
      return {
        id: p.id,
        marketId: p.market_id,
        marketQuestion: p.market_question,
        entryPrice,
        sizeCents: p.size_cents,
        currentPrice,
        pnlCents: currentPrice !== null ? computePositionPnlCents(entryPrice, currentPrice, p.size_cents) : null,
      }
    }),
  )

  const totalRoundUpCents = (txns ?? []).reduce((sum, t) => sum + t.round_up_cents, 0)
  const pendingAccruedCents = Math.max(0, totalRoundUpCents - session.facilitated_cents)

  const body = {
    session: {
      sessionId,
      bank: {
        linked: Boolean(session.bank_account_id),
        institution: session.bank_institution,
        last4: session.bank_last4,
      },
      rule: {
        roundToCents: session.round_to_cents,
        multiplier: session.multiplier,
        thresholdCents: session.threshold_cents,
        weeklyCapCents: session.weekly_cap_cents,
      },
      pendingAccruedCents,
      walletCents: session.wallet_cents,
      txns: (txns ?? []).map((t) => ({
        id: t.txn_id,
        merchant: t.merchant,
        amountCents: t.amount_cents,
        roundUpCents: t.round_up_cents,
        date: t.occurred_on,
      })),
      positions: positionsWithLivePrice,
    },
  }

  const res = NextResponse.json(body)
  return isNew ? attachSessionCookie(res, sessionId) : res
}
