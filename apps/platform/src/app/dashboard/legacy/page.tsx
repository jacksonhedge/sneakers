import { redirect } from 'next/navigation'
import { getAuthClient } from '@/lib/supabase-auth'
import { getTierIdentity } from '@/lib/require-tier'
import { loadMinuteMarkets, type Bucket } from '@/lib/minute-markets'
import { getAllHlPerps } from '@/lib/hyperliquid-data'
import { findVenue } from '@/lib/venues'
import { getCredentialMeta } from '@/lib/autotrade/credentials'
import { MoneyTracker } from '../money-tracker'
import { TradingSwitch } from '../trading-switch'
import { AutoTradePanel } from '../auto-trade-panel'
import { QuickMarketsPanel, ALL_BUCKETS } from '../quick/quick-markets-panel'
import { HyperliquidStrip } from '../hyperliquid-strip'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata = { title: 'Classic dashboard — Sneakers Terminal' }

const FREE_TIER_DEFAULT_BUCKET: Bucket = '15m'

interface PageProps {
  searchParams: Promise<{ b?: string; asset?: string }>
}

export default async function DashboardLegacyPage({ searchParams }: PageProps) {
  const supabase = await getAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) redirect('/signup')

  const me = await getTierIdentity()
  const isPaid = me.tier !== 'free'
  const sp = await searchParams

  const requestedBucket = (sp.b ?? '').toLowerCase() as Bucket | ''
  const bucket: Bucket = ALL_BUCKETS.includes(requestedBucket as Bucket)
    ? (requestedBucket as Bucket)
    : isPaid ? '15m' : FREE_TIER_DEFAULT_BUCKET
  const asset = isPaid ? (sp.asset?.toUpperCase() || null) : null

  const hlMode = isPaid ? 'live' : 'delayed'
  const [result, hlData, polyMeta] = await Promise.all([
    loadMinuteMarkets({
      within: 60,
      asset,
      grouped: true,
      cryptoOnly: true,
    }),
    getAllHlPerps({ mode: hlMode }).catch(() => ({ perps: [], fetchedAt: Date.now(), fromCache: false, mode: hlMode as 'live' | 'delayed' })),
    getCredentialMeta(user.id, 'polymarket'),
  ])

  const polymarketReadyToTrade = polyMeta?.hasPrivateKey === true

  const hlVenue = findVenue('hyperliquid')
  const hlTradeUrl = hlVenue?.affiliateUrl ?? 'https://app.hyperliquid.xyz/'

  const allGroups = result.groups ?? []
  const groups = allGroups
    .map((g) => ({ ...g, markets: g.markets.filter((m) => m.bucket === bucket) }))
    .filter((g) => g.markets.length > 0)

  return (
    <div className="px-6 py-6 space-y-6 max-w-4xl mx-auto">
      {/* 0. TRADING MASTER SWITCH — gates all O'Toole co-pilot proposals */}
      <section>
        <TradingSwitch polymarketReadyToTrade={polymarketReadyToTrade} />
      </section>

      {/* 1. MONEY TRACKER HERO — balance from /api/balance, honest $0 state */}
      <section>
        <h2 className="text-[10px] text-stone-400 uppercase tracking-widest mb-3">
          Money Tracker
        </h2>
        <MoneyTracker />
      </section>

      {/* 2. AUTO-TRADE BOT PANEL — real config from /api/otoole/autotrade-settings */}
      <section>
        <h2 className="text-[10px] text-stone-400 uppercase tracking-widest mb-3">
          Auto-Trade Bot
        </h2>
        <AutoTradePanel />
      </section>

      {/* 3. LIVE CRYPTO STRIP — minute markets, honest empty state if DB is empty */}
      <section>
        <h2 className="text-[10px] text-stone-400 uppercase tracking-widest mb-3">
          Live Crypto Markets
        </h2>
        {result.totalMarkets === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-10 text-center">
            <div className="text-sm font-medium text-stone-600 mb-1">
              Live markets are syncing — check back in a minute.
            </div>
            <div className="text-[11px] text-stone-400">
              BTC · ETH · SOL strikes will appear here once the scrapers feed the database.
            </div>
          </div>
        ) : (
          <QuickMarketsPanel
            groups={groups}
            bucket={bucket}
            asset={asset}
            isPaid={isPaid}
            totalMarkets={result.totalMarkets}
            totalGroups={result.totalGroups ?? 0}
            assetsAvailable={result.assetsAvailable}
            basePath="/dashboard/legacy"
            compact={true}
            polymarketReadyToTrade={polymarketReadyToTrade}
          />
        )}
      </section>

      {/* 4. HYPERLIQUID PERPS STRIP — live crypto prices direct from HL API (no Railway dep) */}
      <section>
        <h2 className="text-[10px] text-stone-400 uppercase tracking-widest mb-3">
          Crypto Perps
        </h2>
        <HyperliquidStrip
          perps={hlData.perps}
          fetchedAt={hlData.fetchedAt}
          isPaid={isPaid}
          tradeUrl={hlTradeUrl}
        />
      </section>
    </div>
  )
}
