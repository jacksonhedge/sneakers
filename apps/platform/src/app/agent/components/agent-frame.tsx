'use client'
import { TabBar } from './tab-bar'
import { Rail } from './rail'

export function AgentFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="agent-app agent-shell">
      <Rail />
      <main className="agent-main">{children}</main>
      <TabBar />
    </div>
  )
}
