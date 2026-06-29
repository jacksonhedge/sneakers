import { getTierIdentity } from '@/lib/require-tier'
import {
  loadMinuteMarkets,
  type Bucket,
} from '@/lib/minute-markets'
import { QuickMarketsPanel } from './quick-markets-panel'

// Quick markets — consumer surface for short-duration prediction markets
// (≤ 60 min to resolution). Same data as /dashboard/minute, different
// audience: shoppable, big TRADE buttons, no terminal styling.
//
// Move B (round-up journeys) plugs into this surface — each round-up
// becomes a journey that deploys legs into these same markets. For now
// it's pure discovery + affiliate routing.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Quick markets — Sneakers Terminal' }

const FREE_TIER_DEFAULT_BUCKET: Bucket = '15m'
const ALL_BUCKETS: Bucket[] = ['5m', '15m', '30m', '60m']

interface PageProps {
  searchParams: Promise<{ b?: string; asset?: string }>
}

export default async function QuickMarketsPage({ searchParams }: PageProps) {
  const me = await getTierIdentity()
  const isPaid = me.tier !== 'free'
  const sp = await searchParams

  const requestedBucket = (sp.b ?? '').toLowerCase() as Bucket | ''
  const bucket: Bucket = ALL_BUCKETS.includes(requestedBucket as Bucket)
    ? (requestedBucket as Bucket)
    : isPaid
      ? '15m'
      : FREE_TIER_DEFAULT_BUCKET
  const asset = isPaid ? (sp.asset?.toUpperCase() || null) : null

  // Load the full 60m window once; bucket filter applies post-load so the
  // user sees what's in their picked window without re-querying.
  const result = await loadMinuteMarkets({
    within: 60,
    asset,
    grouped: true,
    cryptoOnly: true,
  })

  const allGroups = result.groups ?? []
  const groups = allGroups
    .map((g) => ({ ...g, markets: g.markets.filter((m) => m.bucket === bucket) }))
    .filter((g) => g.markets.length > 0)

  return (
    <main className="min-h-full bg-gradient-to-b from-stone-50 via-stone-50 to-white text-stone-900">
      <div className="max-w-5xl mx-auto px-6 py-6">
        <QuickMarketsPanel
          groups={groups}
          bucket={bucket}
          asset={asset}
          isPaid={isPaid}
          totalMarkets={result.totalMarkets}
          totalGroups={result.totalGroups ?? 0}
          assetsAvailable={result.assetsAvailable}
          compact={false}
        />
      </div>
    </main>
  )
}
