// apps/platform/src/app/roundup-demo/configure-screen.tsx
'use client'

import { useState } from 'react'
import type { SessionState } from './page'

export function ConfigureScreen({
  rule,
  onConfigured,
}: {
  rule: SessionState['rule']
  onConfigured: () => void
}) {
  const [thresholdDollars, setThresholdDollars] = useState((rule.thresholdCents / 100).toFixed(2))
  const [multiplier, setMultiplier] = useState(rule.multiplier)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const thresholdCents = Math.round(parseFloat(thresholdDollars) * 100)
    if (!Number.isFinite(thresholdCents) || thresholdCents <= 0) {
      setError('Enter a valid threshold amount.')
      setSaving(false)
      return
    }
    try {
      const res = await fetch('/api/roundup-demo/rule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thresholdCents, multiplier }),
      })
      if (!res.ok) throw new Error('Could not save your round-up rule.')
      onConfigured()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Configure round-ups</h2>

      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
        Sweep to wallet at
      </label>
      <div className="mb-4 flex items-center rounded-xl border border-gray-200 px-3 py-2">
        <span className="mr-1 text-sm text-gray-500">$</span>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={thresholdDollars}
          onChange={(e) => setThresholdDollars(e.target.value)}
          className="w-full text-sm text-gray-900 outline-none"
        />
      </div>

      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
        Multiplier
      </label>
      <select
        value={multiplier}
        onChange={(e) => setMultiplier(Number(e.target.value))}
        className="mb-6 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900"
      >
        <option value={1}>1x</option>
        <option value={2}>2x</option>
        <option value={5}>5x</option>
      </select>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save and continue'}
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  )
}
