import { addDays } from '@/lib/spare-change-core'
import { todayEastern } from '@/lib/spare-change'
import { listKeys, type AdminKeyRow } from '@/lib/spare-change-api-store'
import { NewKeyForm } from './new-key-form'
import { RevokeButton } from './revoke-button'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Picks API — Admin — Sneakers Terminal',
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'short', timeStyle: 'short' }) : '—')

export default async function PicksApiPage() {
  const today = todayEastern()
  let keys: AdminKeyRow[] = []
  let loadError = false
  try {
    keys = await listKeys(today, addDays(today, -6))
  } catch {
    loadError = true
  }
  const live = keys.filter((k) => !k.revoked_at)

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-[#004225] tracking-wider mb-1">{'>'} SPARE CHANGE PICKS API</div>
        <h1 className="text-2xl font-bold text-stone-900">
          {live.length.toLocaleString()} <span className="text-stone-500 text-base font-normal">live keys</span>
        </h1>
        <p className="text-sm text-stone-600 mt-1 max-w-2xl">
          Partners (Whop communities, parlay builders, Discord bots) pull each day&apos;s four tickets as JSON from{' '}
          <code className="bg-stone-100 px-1">GET /api/spare-change/v1/picks</code>. Slip links keep our partner code. Today&apos;s issue is
          served from midnight Eastern on its date, never earlier. Making and revoking keys is logged to the audit log.
        </p>
      </div>

      <NewKeyForm />

      {loadError ? (
        <div className="border border-red-300 bg-red-50 p-6 text-sm text-red-800">Could not read keys. Has migration 052_sc_api_keys.sql been applied?</div>
      ) : keys.length === 0 ? (
        <div className="border border-stone-300 bg-white p-6 text-sm text-stone-500">No keys yet. Make one above for each partner.</div>
      ) : (
        <div className="border border-stone-300 bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-stone-100 text-stone-600 tracking-wider">
              <tr>
                <th className="text-left px-3 py-2">PARTNER</th>
                <th className="text-left px-3 py-2 w-28">KEY</th>
                <th className="text-right px-3 py-2 w-24">TODAY</th>
                <th className="text-right px-3 py-2 w-20">7 DAYS</th>
                <th className="text-right px-3 py-2 w-24">LIMITS</th>
                <th className="text-left px-3 py-2 w-32">LAST USED</th>
                <th className="text-left px-3 py-2 w-32">MADE</th>
                <th className="px-3 py-2 w-40 text-right">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className={`border-t border-stone-200 ${k.revoked_at ? 'text-stone-400' : ''}`}>
                  <td className="px-3 py-2">
                    <div className="font-semibold">{k.name}</div>
                    {k.contact_email && <div className="text-stone-500">{k.contact_email}</div>}
                    {k.note && <div className="text-stone-500">{k.note}</div>}
                  </td>
                  <td className="px-3 py-2 font-mono">{k.key_prefix}…</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {k.today.toLocaleString()} / {k.daily_limit.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{k.last7.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-mono">{k.per_minute_limit}/min</td>
                  <td className="px-3 py-2">{when(k.last_used_at)}</td>
                  <td className="px-3 py-2">
                    {when(k.created_at)}
                    <div className="text-stone-500">{k.created_by}</div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {k.revoked_at ? (
                      <span title={`by ${k.revoked_by ?? '?'}`}>revoked {when(k.revoked_at)}</span>
                    ) : (
                      <RevokeButton id={k.id} name={k.name} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
