import { redirect } from 'next/navigation'
import { getAuthClient } from '@/lib/supabase-auth'
import { MarketsListingBody, type MarketsListingParams } from '@/app/markets/markets-listing-body'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Markets — Sneakers Terminal',
}

// In-app markets listing. Auth + chrome (topbar + OToole panel) come
// from the dashboard layout. This route exists so the topbar filter
// pills (Sports / Politics / Crypto / etc.) can stay inside the
// dashboard layout instead of jumping the user to the public-style
// /markets route — that jump was the "looks like I got logged out"
// shift the user kept hitting.
//
// Auth check happens at the top of THIS page (in addition to the
// layout's check) because Next 16 renders layout + page concurrently —
// without the early redirect here, the body's data loaders run for
// ~10s on every unauthed request before the layout's redirect lands,
// turning what should be an instant bounce into a usability cliff.

export default async function DashboardMarketsPage({
  searchParams,
}: {
  searchParams: Promise<MarketsListingParams>
}) {
  const supabase = await getAuthClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !user.email) redirect('/signup')

  const sp = await searchParams
  return (
    <div className="px-6 py-5">
      <MarketsListingBody searchParams={sp} hrefBase="/dashboard/markets" />
    </div>
  )
}
