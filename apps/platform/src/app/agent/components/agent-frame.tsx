'use client'
import { TabBar } from './tab-bar'

export function AgentFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="agent-app">
      <main className="agent-main">{children}</main>
      <TabBar />
    </div>
  )
}
