import { Pool, PoolClient } from 'pg'
import type { Venue, Asset, Side, Outcome } from '@sneakers/core'

export interface WindowSeed {
  venue: Venue
  asset: Asset
  intervalSec: number
  externalId: string
  opensAt: number
  closesAt: number
  referenceOracle: string
}

export interface WindowRow extends WindowSeed {
  id: number
  openRefPrice: number | null
  settleRefPrice: number | null
  outcome: Outcome | null
  status: 'upcoming' | 'live' | 'settled'
}

export interface BotConfigRow {
  id: number
  userId: string | null
  enabled: boolean
  mode: 'dry_run' | 'live'
  simDepositUsdc: number
  simLiquidityUsdc: number
  riskPreset: 'bunker' | 'cautious' | 'balanced' | 'aggressive' | 'max'
  assets: string[]
  enabledVenues: string[]
  paused: boolean
  createdAt: number
}

export interface SignalRow {
  id: number
  windowId: number
  kind: string
  side: Side
  edgeBps: number
  marketProb: number
  impliedProb: number
  secondsToClose: number
  createdAt: number
}

export interface TradeRow {
  id: number
  botConfigId: number
  windowId: number
  signalId: number | null
  mode: 'dry_run' | 'live'
  side: Side
  sizeUsdc: number
  entryPrice: number
  settlePrice: number | null
  pnlUsdc: number | null
  status: 'open' | 'won' | 'lost'
  createdAt: number
}

export interface PnlSummary {
  todayUsdc: number
  allTimeUsdc: number
  spentTodayUsdc: number
  windowsThisHour: number
}

export class AgentRepo {
  constructor(private pool: Pool) {}

  async upsertWindow(seed: WindowSeed): Promise<WindowRow> {
    const result = await this.pool.query(
      `INSERT INTO short_windows (venue, asset, interval_sec, external_id, opens_at, closes_at, reference_oracle)
       VALUES ($1, $2, $3, $4, to_timestamp($5/1000.0), to_timestamp($6/1000.0), $7)
       ON CONFLICT (venue, external_id) DO UPDATE SET
         interval_sec = EXCLUDED.interval_sec,
         opens_at = EXCLUDED.opens_at,
         closes_at = EXCLUDED.closes_at,
         reference_oracle = EXCLUDED.reference_oracle
       RETURNING
         id, venue, asset, interval_sec, external_id,
         extract(epoch from opens_at)*1000 as opens_at,
         extract(epoch from closes_at)*1000 as closes_at,
         reference_oracle, open_ref_price, settle_ref_price, outcome, status`,
      [seed.venue, seed.asset, seed.intervalSec, seed.externalId, seed.opensAt, seed.closesAt, seed.referenceOracle]
    )
    const row = result.rows[0]
    return {
      id: Number(row.id),
      venue: row.venue,
      asset: row.asset,
      intervalSec: row.interval_sec,
      externalId: row.external_id,
      opensAt: Number(row.opens_at),
      closesAt: Number(row.closes_at),
      referenceOracle: row.reference_oracle,
      openRefPrice: row.open_ref_price,
      settleRefPrice: row.settle_ref_price,
      outcome: row.outcome,
      status: row.status,
    }
  }

  async setOpenRef(id: number, price: number): Promise<void> {
    await this.pool.query(
      `UPDATE short_windows SET open_ref_price = $1 WHERE id = $2`,
      [price, id]
    )
  }

  async setSettle(id: number, price: number, outcome: Outcome): Promise<void> {
    await this.pool.query(
      `UPDATE short_windows SET settle_ref_price = $1, outcome = $2, status = 'settled' WHERE id = $3`,
      [price, outcome, id]
    )
  }

  async setStatus(id: number, status: 'upcoming' | 'live' | 'settled'): Promise<void> {
    await this.pool.query(
      `UPDATE short_windows SET status = $1 WHERE id = $2`,
      [status, id]
    )
  }

  async loadOpenWindows(nowMs: number): Promise<WindowRow[]> {
    const result = await this.pool.query(
      `SELECT
         id, venue, asset, interval_sec, external_id,
         extract(epoch from opens_at)*1000 as opens_at,
         extract(epoch from closes_at)*1000 as closes_at,
         reference_oracle, open_ref_price, settle_ref_price, outcome, status
       FROM short_windows
       WHERE status IN ('upcoming', 'live')
       AND closes_at > to_timestamp($1/1000.0)`,
      [nowMs]
    )
    return result.rows.map(row => ({
      id: Number(row.id),
      venue: row.venue,
      asset: row.asset,
      intervalSec: row.interval_sec,
      externalId: row.external_id,
      opensAt: Number(row.opens_at),
      closesAt: Number(row.closes_at),
      referenceOracle: row.reference_oracle,
      openRefPrice: row.open_ref_price,
      settleRefPrice: row.settle_ref_price,
      outcome: row.outcome,
      status: row.status,
    }))
  }

  async loadBotConfigs(): Promise<BotConfigRow[]> {
    const result = await this.pool.query(
      `SELECT
         id, user_id, enabled, mode, sim_deposit_usdc, sim_liquidity_usdc,
         risk_preset, assets, enabled_venues, paused,
         extract(epoch from created_at)*1000 as created_at
       FROM short_bot_configs`
    )
    return result.rows.map(row => ({
      id: Number(row.id),
      userId: row.user_id,
      enabled: row.enabled,
      mode: row.mode,
      simDepositUsdc: row.sim_deposit_usdc,
      simLiquidityUsdc: row.sim_liquidity_usdc,
      riskPreset: row.risk_preset,
      assets: row.assets,
      enabledVenues: row.enabled_venues,
      paused: row.paused,
      createdAt: Number(row.created_at),
    }))
  }

  async insertSignal(signal: Omit<SignalRow, 'id' | 'createdAt'>): Promise<number> {
    const result = await this.pool.query(
      `INSERT INTO short_signals (window_id, kind, side, edge_bps, market_prob, implied_prob, seconds_to_close)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [signal.windowId, signal.kind, signal.side, signal.edgeBps, signal.marketProb, signal.impliedProb, signal.secondsToClose]
    )
    return Number(result.rows[0].id)
  }

  async insertTrade(trade: Omit<TradeRow, 'id' | 'createdAt'>): Promise<number | null> {
    const result = await this.pool.query(
      `INSERT INTO short_trades (bot_config_id, window_id, signal_id, mode, side, size_usdc, entry_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (bot_config_id, window_id) DO NOTHING
       RETURNING id`,
      [trade.botConfigId, trade.windowId, trade.signalId, trade.mode, trade.side, trade.sizeUsdc, trade.entryPrice]
    )
    return result.rows.length > 0 ? Number(result.rows[0].id) : null
  }

  async openTradesForWindow(windowId: number): Promise<TradeRow[]> {
    const result = await this.pool.query(
      `SELECT
         id, bot_config_id, window_id, signal_id, mode, side, size_usdc, entry_price,
         settle_price, pnl_usdc, status,
         extract(epoch from created_at)*1000 as created_at
       FROM short_trades
       WHERE window_id = $1 AND status = 'open'`,
      [windowId]
    )
    return result.rows.map(row => ({
      id: Number(row.id),
      botConfigId: Number(row.bot_config_id),
      windowId: Number(row.window_id),
      signalId: row.signal_id ? Number(row.signal_id) : null,
      mode: row.mode,
      side: row.side,
      sizeUsdc: row.size_usdc,
      entryPrice: row.entry_price,
      settlePrice: row.settle_price,
      pnlUsdc: row.pnl_usdc,
      status: row.status,
      createdAt: Number(row.created_at),
    }))
  }

  async markTradeSettled(id: number, settlePrice: number, pnl: number, status: 'won' | 'lost'): Promise<void> {
    await this.pool.query(
      `UPDATE short_trades SET settle_price = $1, pnl_usdc = $2, status = $3 WHERE id = $4`,
      [settlePrice, pnl, status, id]
    )
  }

  async pnlSummary(botConfigId: number): Promise<PnlSummary> {
    const result = await this.pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN created_at >= now()::date THEN pnl_usdc ELSE 0 END), 0) as today_usdc,
         COALESCE(SUM(CASE WHEN status IN ('won', 'lost') THEN pnl_usdc ELSE 0 END), 0) as all_time_usdc,
         COALESCE(SUM(CASE WHEN created_at >= now()::date THEN size_usdc ELSE 0 END), 0) as spent_today_usdc,
         COUNT(CASE WHEN created_at >= now() - interval '1 hour' THEN 1 END) as windows_this_hour
       FROM short_trades
       WHERE bot_config_id = $1 AND status IN ('won', 'lost')`,
      [botConfigId]
    )
    const row = result.rows[0]
    return {
      todayUsdc: Number(row.today_usdc),
      allTimeUsdc: Number(row.all_time_usdc),
      spentTodayUsdc: Number(row.spent_today_usdc),
      windowsThisHour: Number(row.windows_this_hour),
    }
  }
}
