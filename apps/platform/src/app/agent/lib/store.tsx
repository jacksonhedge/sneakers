'use client'
import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react'
import { agentReducer, currentStatus, initialState, isOwned, todayPnlCents } from './engine'
import type { AgentAction, AgentUIState } from './engine'
import { agentApi } from './api'

interface AgentCtx {
  state: AgentUIState
  status: ReturnType<typeof currentStatus>
  todayPnl: number
  owned: (id: string) => boolean
  dispatch: (a: AgentAction) => void
  live: boolean
  api: typeof agentApi
}

const Ctx = createContext<AgentCtx | null>(null)

export function AgentProvider({ children, live = false, initial }: {
  children: React.ReactNode
  live?: boolean
  initial?: AgentUIState
}) {
  const [state, rawDispatch] = useReducer(agentReducer, initial, s => s ?? initialState())
  const stateRef = useRef(state)
  stateRef.current = state

  const resync = useCallback(async () => {
    const [st, models, wallet] = await Promise.all([agentApi.state(), agentApi.models(), agentApi.wallet()])
    rawDispatch({
      type: 'sync',
      patch: {
        ...(st ? { paused: st.paused, balanceCents: st.balanceCents, equippedId: st.equippedId, serverPnlCents: st.todayPnlCents } : {}),
        ...(models ? { models: models.models, subscribedIds: models.subscribedIds } : {}),
        ...(wallet ? { balanceCents: wallet.balanceCents, spark: wallet.spark, ledger: wallet.ledger } : {}),
      },
    })
  }, [])

  // Live side effects: optimistic local apply already happened; fire the
  // matching API call and reconcile. Components keep the same dispatch API.
  const dispatch = useCallback((a: AgentAction) => {
    const before = stateRef.current
    rawDispatch(a)
    if (!live) return
    switch (a.type) {
      case 'subscribe':
        void agentApi.subscribe(a.id).then(res => {
          if (res && 'url' in res) window.location.assign(res.url) // Stripe Checkout
          else if (!res) void resync() // revert optimistic sub on failure
        })
        break
      case 'equip':
        void agentApi.equip(a.id).then(res => { if (!res) void resync() })
        break
      case 'togglePaused':
        void (before.paused ? agentApi.resume() : agentApi.pause()).then(res => { if (!res) void resync() })
        break
      case 'deposit':
        // Live deposits go through ctx.api.deposit (Payment Element path);
        // this local action only fires in mock mode. Guard: resync to undo.
        void resync()
        break
      case 'createAgent':
        void agentApi.createAgent(a.input).then(res => {
          if (res?.model) rawDispatch({ type: 'modelCreated', model: res.model })
          else void resync()
        })
        break
      case 'updateConfig':
        void agentApi.saveConfig(a.patch as Record<string, string>).then(res => { if (!res) void resync() })
        break
    }
  }, [live, resync])

  // Mock ticker (phase animation) runs in both modes — the synthesized
  // server phase and this local cycle share the same copy + cadence.
  useEffect(() => {
    const id = setInterval(() => rawDispatch({ type: 'tick' }), 4500)
    return () => clearInterval(id)
  }, [])

  // Live polling: /api/agent/state every 5s while the tab is visible.
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void agentApi.state().then(st => {
        if (st) rawDispatch({
          type: 'sync',
          patch: { paused: st.paused, balanceCents: st.balanceCents, equippedId: st.equippedId, serverPnlCents: st.todayPnlCents },
        })
      })
    }, 5000)
    return () => clearInterval(id)
  }, [live])

  return (
    <Ctx.Provider
      value={{
        state,
        status: currentStatus(state),
        todayPnl: state.serverPnlCents ?? todayPnlCents(state),
        owned: id => isOwned(state, id),
        dispatch,
        live,
        api: agentApi,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useAgent(): AgentCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAgent outside AgentProvider')
  return ctx
}
