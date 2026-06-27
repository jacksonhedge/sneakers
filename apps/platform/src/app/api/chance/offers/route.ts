// POST /api/chance/offers
// Body: { itemPrice: number, tiers?: ChanceTier[], mustMakeWhole?: boolean }
// Geo:  Vercel IP headers in prod; ?country=&region= override for local/demo.
//
// Returns the geo-gated, venue-branded list of Chance offers for the pop-up.

import { NextRequest, NextResponse } from 'next/server'
import { findChanceOffers, defaultTiers, type ChanceTier } from '@/lib/chance/engine'
import { resolveEligibility, venueBrand } from '@/lib/chance/eligibility'
import { loadVenueSnapshots } from '@/lib/chance/source'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let body: { itemPrice?: number; tiers?: ChanceTier[]; mustMakeWhole?: boolean } = {}
  try {
    body = await request.json()
  } catch {
    /* empty body ok */
  }

  const itemPrice = Number(body.itemPrice) > 0 ? Number(body.itemPrice) : 50

  // Geo: query override (demo) → Vercel edge headers (prod).
  const url = new URL(request.url)
  const country =
    url.searchParams.get('country') ?? request.headers.get('x-vercel-ip-country')
  const region =
    url.searchParams.get('region') ?? request.headers.get('x-vercel-ip-country-region')

  const elig = resolveEligibility(country, region)
  if (!elig.eligible || !elig.venue) {
    return NextResponse.json({
      eligible: false,
      reason: elig.reason,
      country: elig.country,
      region: elig.region,
      venue: null,
      offers: [],
    })
  }

  const brand = venueBrand(elig.venue)

  let offers
  try {
    const snapshots = await loadVenueSnapshots(elig.venue)
    const tiers = body.tiers?.length ? body.tiers : defaultTiers(itemPrice)
    offers = findChanceOffers({
      itemPrice,
      tiers,
      snapshots,
      filters: { mustMakeWhole: body.mustMakeWhole ?? true },
    })
  } catch (err) {
    return NextResponse.json(
      { eligible: true, venue: elig.venue, brand, offers: [], error: 'sourcing-failed', detail: String(err) },
      { status: 200 },
    )
  }

  return NextResponse.json({
    eligible: true,
    reason: elig.reason,
    country: elig.country,
    region: elig.region,
    venue: elig.venue,
    brand: { name: brand.name, verb: brand.verb },
    itemPrice,
    offers,
  })
}
