'use client'
import { useState } from 'react'
import { AgentProvider, useAgent } from '../lib/store'
import { AgentTabView } from './agent-tab-view'
import { ModelsTabView } from './models-tab-view'
import { BalanceTabView } from './balance-tab-view'
import { ORB_ICON, MODELS_ICON } from './tab-bar'
import { formatMoneyWhole } from '../lib/format'
import type { AgentDest } from '../lib/types'
import '../agent.css'

type DemoTab = 'agent' | 'models' | 'balance'

function DemoTabBar({ tab, onTab }: { tab: DemoTab; onTab: (t: DemoTab) => void }) {
  const { state } = useAgent()
  const tabs: { key: DemoTab; label: string; icon: React.ReactNode }[] = [
    { key: 'agent', label: 'Agent', icon: ORB_ICON },
    { key: 'models', label: 'Models', icon: MODELS_ICON },
    { key: 'balance', label: 'Balance', icon: <span className="ag-tabnum ag-num">{formatMoneyWhole(state.balanceCents)}</span> },
  ]
  return (
    <nav className="ag-tabbar" style={{ position: 'relative', paddingBottom: 10 }}>
      {tabs.map(t => (
        <button key={t.key} type="button"
          aria-current={tab === t.key ? 'page' : undefined}
          className={'ag-tabbtn' + (tab === t.key ? ' ag-tabbtn--on' : '')}
          onClick={() => onTab(t.key)}>
          {t.icon}
          {t.label}
        </button>
      ))}
    </nav>
  )
}

function DemoInner() {
  const [tab, setTab] = useState<DemoTab>('agent')
  const [centerNew, setCenterNew] = useState(false)

  function go(dest: AgentDest) {
    if (dest === 'profile') return // not in the demo
    setCenterNew(false)
    setTab(dest)
  }

  // AddAgentSheet's navigate means "a new agent was just created" — center it.
  // centerNew relies on AgentTabView reading startAtEnd in a lazy useState initializer AND on the conditional render below remounting the view per tab switch — keep both if refactoring.
  function goAfterCreate() {
    setCenterNew(true)
    setTab('agent')
  }

  return (
    <div className="agdemo-screen">
      <div className="agdemo-island" />
      <div className="agdemo-main">
        {tab === 'agent' && <AgentTabView startAtEnd={centerNew} badge="LIVE DEMO" onNavigate={go} />}
        {tab === 'models' && <ModelsTabView badge="LIVE DEMO" onNavigate={go} onCreateNavigate={goAfterCreate} />}
        {tab === 'balance' && <BalanceTabView />}
      </div>
      <DemoTabBar tab={tab} onTab={t => { setCenterNew(false); setTab(t) }} />
    </div>
  )
}

export function AgentDemo() {
  return (
    <div className="agdemo-frame agent-app" style={{ minHeight: 0, border: 'none', maxWidth: 'none' }}>
      <AgentProvider>
        <DemoInner />
      </AgentProvider>
    </div>
  )
}
