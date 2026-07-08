'use client'
import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AgentTabView } from './components/agent-tab-view'

function AgentTabInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const startAtEnd = searchParams.get('center') === 'new'

  useEffect(() => {
    if (startAtEnd) router.replace('/agent', { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <AgentTabView startAtEnd={startAtEnd} />
}

export default function AgentTab() {
  return (
    <Suspense fallback={null}>
      <AgentTabInner />
    </Suspense>
  )
}
