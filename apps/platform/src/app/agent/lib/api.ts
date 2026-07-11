// Thin client for /api/agent/* and /api/wallet. All calls are same-origin
// (cookie session) and return null on network/HTTP failure — callers
// reconcile by re-syncing rather than surfacing raw errors.
import type { AgentModel, CreateAgentInput, Decision, LedgerEntry } from './types'

async function j<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    })
    if (!res.ok) {
      console.warn('[agent/api]', path, res.status, await res.text().catch(() => ''))
      return null
    }
    return (await res.json()) as T
  } catch (err) {
    console.warn('[agent/api]', path, err)
    return null
  }
}

export interface StateRes {
  phase: string; title: string; sub: string; paused: boolean; paper: boolean
  equippedId: string; balanceCents: number; todayPnlCents: number
  lastDecision: Decision | null
}
export type SubscribeRes = { ok: true; status: string; testMode?: boolean } | { url: string }
export type DepositRes = { ok: true; balanceCents: number } | { clientSecret: string }

export const agentApi = {
  state: () => j<StateRes>('/api/agent/state'),
  activity: (limit = 30) => j<{ decisions: Decision[] }>(`/api/agent/activity?limit=${limit}`),
  models: () => j<{ models: AgentModel[]; subscribedIds: string[]; equippedId: string }>('/api/agent/models'),
  subscribe: (id: string) => j<SubscribeRes>(`/api/agent/models/${encodeURIComponent(id)}/subscribe`, { method: 'POST' }),
  equip: (id: string) => j<{ ok: true; equippedId: string }>(`/api/agent/models/${encodeURIComponent(id)}/equip`, { method: 'POST' }),
  pause: () => j<{ ok: true; paused: boolean }>('/api/agent/pause', { method: 'POST' }),
  resume: () => j<{ ok: true; paused: boolean }>('/api/agent/resume', { method: 'POST' }),
  createAgent: (input: CreateAgentInput) => j<{ model: AgentModel }>('/api/agent/models', { method: 'POST', body: JSON.stringify(input) }),
  submit: (id: string) => j<{ ok: true; status: string }>(`/api/agent/models/${encodeURIComponent(id)}/submit`, { method: 'POST' }),
  getConfig: () => j<{ name: string; emoji: string; color: string; prompt: string; preset: string }>('/api/agent/config'),
  saveConfig: (patch: Record<string, string>) => j<{ ok: true }>('/api/agent/config', { method: 'PUT', body: JSON.stringify(patch) }),
  wallet: () => j<{ balanceCents: number; spark: number[]; ledger: LedgerEntry[] }>('/api/wallet'),
  deposit: (amountCents: number) => j<DepositRes>('/api/wallet/deposit', { method: 'POST', body: JSON.stringify({ amountCents }) }),
  withdraw: (amountCents: number) => j<{ ok: true; balanceCents: number }>('/api/wallet/withdraw', { method: 'POST', body: JSON.stringify({ amountCents }) }),
}
