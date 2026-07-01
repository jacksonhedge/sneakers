import { loadUserCredentials, touchLastUsed } from '../../autotrade/credentials'
import { fetchBalance } from '../../autotrade/limitless'
import type { BalanceAdapter } from '../adapters'

export const limitlessBalanceAdapter: BalanceAdapter = {
  venue: 'limitless',
  async fetch(userId) {
    const creds = await loadUserCredentials(userId, 'limitless')
    if (!creds) return { status: 'no_credentials' }
    const { cents } = await fetchBalance(creds)
    await touchLastUsed(userId, 'limitless')
    return { status: 'ok', cents }
  },
}
