import { redirect } from 'next/navigation'
import { getAuthClient } from '@/lib/supabase-auth'
import { AgentProvider } from './lib/store'
import { AgentFrame } from './components/agent-frame'
import './agent.css'

export const dynamic = 'force-dynamic'

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  if (!(process.env.NODE_ENV !== 'production' && process.env.AGENT_PREVIEW === '1')) {
    const supabase = await getAuthClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) redirect('/login')
  }
  return (
    <AgentProvider>
      <AgentFrame>{children}</AgentFrame>
    </AgentProvider>
  )
}
