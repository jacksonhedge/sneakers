'use client'

import { useState } from 'react'
import { ChanceWidget } from './chance-widget'

const ITEM_PRICE = 50

// Demo-only location presets so you can watch venue branding + the geo gate
// switch. In production this comes from Vercel IP headers, not a selector.
const LOCATIONS = [
  { label: 'United States — California (Kalshi)', country: 'US', region: 'CA' },
  { label: 'United States — Washington (blocked)', country: 'US', region: 'WA' },
  { label: 'Brazil (Polymarket)', country: 'BR', region: '' },
  { label: 'United Kingdom (Polymarket)', country: 'GB', region: '' },
  { label: 'Unknown location', country: '', region: '' },
]

export default function ChanceDemoPage() {
  const [loc, setLoc] = useState(LOCATIONS[2]) // default to an intl/Polymarket preset (live data)

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-1 text-xl font-bold text-gray-900">Checkout</h1>
      <p className="mb-6 text-sm text-gray-500">Chance™ widget demo</p>

      {/* Mock order summary */}
      <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 text-2xl">
            👕
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900">Campus Hoodie</div>
            <div className="text-xs text-gray-500">Heavyweight · Forest Green · L</div>
          </div>
          <div className="text-sm font-bold text-gray-900">${ITEM_PRICE.toFixed(2)}</div>
        </div>
      </div>

      {/* Payment options */}
      <div className="mb-4 space-y-2">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
          💳 Card ···· 4242
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
           Apple Pay
        </div>
        <ChanceWidget itemPrice={ITEM_PRICE} country={loc.country} region={loc.region} />
      </div>

      {/* Demo location tester */}
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3">
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Test location (demo only)
        </label>
        <select
          value={loc.label}
          onChange={(e) => setLoc(LOCATIONS.find((l) => l.label === e.target.value) ?? LOCATIONS[0])}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
        >
          {LOCATIONS.map((l) => (
            <option key={l.label} value={l.label}>
              {l.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-[11px] text-gray-400">
          US → Kalshi · non-US → Polymarket · blocked/unknown → hidden. Open the Chance option to see it switch.
        </p>
      </div>
    </div>
  )
}
