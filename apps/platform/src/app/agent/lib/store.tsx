'use client'
import { createContext, useContext, useEffect, useReducer } from 'react'
import { agentReducer, currentStatus, initialState, isOwned, todayPnlCents } from './engine'
import type { AgentAction, AgentUIState } from './engine'

interface AgentCtx {
  state: AgentUIState
  status: ReturnType<typeof currentStatus>
  todayPnl: number
  owned: (id: string) => boolean
  dispatch: (a: AgentAction) => void
}

const Ctx = createContext<AgentCtx | null>(null)

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(agentReducer, undefined, initialState)

  useEffect(() => {
    const id = setInterval(() => dispatch({ type: 'tick' }), 4500)
    return () => clearInterval(id)
  }, [])

  return (
    <Ctx.Provider
      value={{
        state,
        status: currentStatus(state),
        todayPnl: todayPnlCents(state),
        owned: id => isOwned(state, id),
        dispatch,
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
