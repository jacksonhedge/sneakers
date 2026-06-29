'use client'

import { useEffect, useState } from 'react'

interface Offer {
  available: boolean
  premium: number
  targetProb: number
  oddsLabel: string
  itemPrice: number
  marketId: string | null
  question: string | null
  outcome: string | null
  price: number | null
  shares: number | null
  grossPayout: number | null
  netIfWin: number | null
  resolvesInHours: number | null
  liquidity: number | null
}
interface OffersResponse {
  eligible: boolean
  reason?: string
  venue: 'kalshi' | 'polymarket' | null
  brand?: { name: string; verb: string }
  country?: string | null
  region?: string | null
  offers: Offer[]
}

const VENUE_URL: Record<string, (id: string) => string> = {
  polymarket: (id) => `https://polymarket.com/market/${id}`,
  kalshi: (id) => `https://kalshi.com/markets/${id}`,
}

export function ChanceWidget({
  itemPrice,
  country,
  region,
}: {
  itemPrice: number
  country: string
  region: string
}) {
  const [open, setOpen] = useState(false)
  const [lens, setLens] = useState<'risk' | 'chance'>('risk')
  const [data, setData] = useState<OffersResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState<Offer | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setData(null)
    setPicked(null)
    setSubmitted(null)
    const qs = new URLSearchParams({ country, region }).toString()
    fetch(`/api/chance/offers?${qs}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itemPrice }),
    })
      .then((r) => r.json())
      .then((d: OffersResponse) => {
        setData(d)
        const first = d.offers?.findIndex((o) => o.available)
        if (first != null && first >= 0) setPicked(first)
      })
      .catch(() => setData({ eligible: false, reason: 'error', venue: null, offers: [] }))
      .finally(() => setLoading(false))
  }, [open, itemPrice, country, region])

  const available = data?.offers?.filter((o) => o.available) ?? []
  const selected = picked != null ? data?.offers?.[picked] : null
  const payNow = selected ? itemPrice + selected.premium : itemPrice

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group flex w-full items-center justify-between gap-3 rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-left transition hover:border-blue-500 hover:bg-blue-100"
      >
        <span className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            ⤺
          </span>
          <span>
            <span className="block text-sm font-semibold text-blue-900">
              Add Chance™ — pay nothing?
            </span>
            <span className="block text-xs text-blue-700">
              Pay a little more for a real shot at ${'​'}0
            </span>
          </span>
        </span>
        <span className="text-blue-600 transition group-hover:translate-x-0.5">→</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900">Chance™</h2>
                  {data?.eligible && data.brand && (
                    <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      {data.brand.verb} {data.brand.name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">Pay a little more for a shot at $0</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-gray-400 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
              {loading && (
                <div className="py-12 text-center text-sm text-gray-400">
                  Finding live markets…
                </div>
              )}

              {!loading && data && !data.eligible && (
                <div className="py-10 text-center">
                  <div className="mb-2 text-2xl">📍</div>
                  <p className="text-sm font-semibold text-gray-900">
                    Chance isn’t available in your area yet
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {data.reason === 'unknown-location'
                      ? 'We couldn’t confirm your location.'
                      : `Not offered in ${data.region ? data.region + ', ' : ''}${data.country ?? 'your region'} right now.`}
                  </p>
                </div>
              )}

              {!loading && data?.eligible && available.length === 0 && (
                <div className="py-10 text-center">
                  <div className="mb-2 text-2xl">🛰️</div>
                  <p className="text-sm font-semibold text-gray-900">
                    {data.venue === 'kalshi' ? 'Kalshi markets coming online' : 'No matching markets right now'}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Check back shortly — we look for soon-resolving, liquid markets.
                  </p>
                </div>
              )}

              {!loading && data?.eligible && available.length > 0 && (
                <>
                  {/* Portion 1: risk vs likelihood lens */}
                  <div className="mb-4 inline-flex rounded-lg bg-gray-100 p-0.5 text-xs font-medium">
                    {(['risk', 'chance'] as const).map((l) => (
                      <button
                        key={l}
                        onClick={() => setLens(l)}
                        className={`rounded-md px-3 py-1.5 transition ${
                          lens === l ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                        }`}
                      >
                        {l === 'risk' ? 'Amount to risk' : 'Likelihood'}
                      </button>
                    ))}
                  </div>

                  {/* Portion 2: pre-selected list of odds */}
                  <div className="space-y-2">
                    {data.offers.map((o, i) =>
                      !o.available ? null : (
                        <button
                          key={i}
                          onClick={() => setPicked(i)}
                          className={`flex w-full flex-col gap-1 rounded-xl border p-3 text-left transition ${
                            picked === i
                              ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-gray-900">
                              {lens === 'risk'
                                ? `Risk $${o.premium}`
                                : `${(o.targetProb * 100).toFixed(0)}% to pay $0`}
                            </span>
                            <span className="rounded-md bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
                              {o.oddsLabel}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600">
                            {lens === 'risk'
                              ? `${(o.targetProb * 100).toFixed(0)}% chance the order is free`
                              : `Pay $${o.premium} more`}
                            {' · '}wins ${o.grossPayout}
                          </div>
                          <div className="mt-1 line-clamp-1 text-xs text-gray-500">
                            “{o.question}” → <span className="font-medium">{o.outcome}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-gray-400">
                            <span>resolves ~{o.resolvesInHours}h</span>
                            {o.marketId && data.venue && (
                              <a
                                href={VENUE_URL[data.venue](o.marketId)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-blue-600 underline"
                              >
                                view on {data.brand?.name} ↗
                              </a>
                            )}
                          </div>
                        </button>
                      ),
                    )}
                  </div>

                  {submitted && (
                    <div className="mt-4 rounded-xl bg-blue-50 p-3 text-center text-xs text-blue-800">
                      Routing ${submitted.premium} to {data.brand?.name} on “{submitted.outcome}”.
                      <br />
                      <span className="text-blue-600">
                        (Execution coming next — this is the sourcing demo.)
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Portion 3: submit */}
            {!loading && data?.eligible && available.length > 0 && (
              <div className="border-t border-gray-100 px-5 py-4">
                <button
                  disabled={!selected}
                  onClick={() => selected && setSubmitted(selected)}
                  className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-40"
                >
                  Add Chance · Pay ${payNow.toFixed(2)}
                </button>
                <p className="mt-2 text-center text-[11px] text-gray-400">
                  Hedge routes your stake to {data.brand?.name} — we’re not the house.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
