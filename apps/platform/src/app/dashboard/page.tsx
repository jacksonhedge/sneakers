import { redirect } from 'next/navigation'
import { getAuthClient } from '@/lib/supabase-auth'
import { getTierIdentity } from '@/lib/require-tier'
import { loadMinuteMarkets, type Bucket } from '@/lib/minute-markets'
import { BalanceCard } from './balance-card'
import { QuickMarketsPanel } from './quick/quick-markets-panel'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const FREE_TIER_DEFAULT_BUCKET: Bucket = '15m'
const ALL_BUCKETS: Bucket[] = ['5m', '15m', '30m', '60m']

interface PageProps {
  searchParams: Promise<{ b?: string; asset?: string }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
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
    <div className="px-6 py-5 space-y-6">
      <section>
        <h2 className="text-[10px] text-stone-500 uppercase tracking-wider mb-3">Wallet</h2>
        <BalanceCard />
      </section>

      <section>
        <h2 className="text-[10px] text-stone-500 uppercase tracking-wider mb-3">Quick Markets</h2>
        <QuickMarketsPanel
          groups={groups}
          bucket={bucket}
          asset={asset}
          isPaid={isPaid}
          totalMarkets={result.totalMarkets}
          totalGroups={result.totalGroups ?? 0}
          assetsAvailable={result.assetsAvailable}
          compact={true}
        />
      </section>
    </div>
  )
}
