import { redirect } from 'next/navigation'
import { getAuthClient } from '@/lib/supabase-auth'
import { buildInitialUIState } from '@/lib/agent/service'
import { AgentProvider } from './lib/store'
import { AgentFrame } from './components/agent-frame'
import './agent.css'

export const dynamic = 'force-dynamic'

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const preview = process.env.NODE_ENV !== 'production' && process.env.AGENT_PREVIEW === '1'
  let userId: string | null = null
  if (!preview) {
    const supabase = await getAuthClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) redirect('/login')
    userId = data.user.id
  }

  const live = process.env.AGENT_API_LIVE === '1' && userId !== null
  const initial = live ? await buildInitialUIState(userId!) : undefined

  return (
    <AgentProvider live={live} initial={initial}>
      <AgentFrame>{children}</AgentFrame>
    </AgentProvider>
  )
}
