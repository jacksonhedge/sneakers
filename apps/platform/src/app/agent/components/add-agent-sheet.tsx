'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from './sheet'
import { useAgent } from '../lib/store'
import type { OrbColor, AgentDest } from '../lib/types'

const EMOJIS = ['🤖', '🚀', '🧠', '🔥', '💎', '🐍']
const COLORS: { color: OrbColor; hex: string }[] = [
  { color: 'green', hex: '#2FD37A' }, { color: 'blue', hex: '#4EA8FF' },
  { color: 'purple', hex: '#a97dff' }, { color: 'gold', hex: '#e8c25a' },
  { color: 'cyan', hex: '#39C6D6' }, { color: 'red', hex: '#FF5C5C' },
]

export function AddAgentSheet({ open, onClose, onNavigate }: {
  open: boolean
  onClose: () => void
  onNavigate?: (dest: AgentDest) => void
}) {
  const { dispatch } = useAgent()
  const router = useRouter()
  const [kind, setKind] = useState<'prompt' | 'connected'>('prompt')
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(EMOJIS[0])
  const [color, setColor] = useState<OrbColor>('cyan')
  const [prompt, setPrompt] = useState('')
  const [endpointUrl, setEndpointUrl] = useState('')
  const [apiKey, setApiKey] = useState('')

  function create() {
    dispatch({ type: 'createAgent', input: { name, emoji, color, kind, prompt, endpointUrl, apiKey } })
    setName(''); setPrompt(''); setEndpointUrl(''); setApiKey('')
    setKind('prompt'); setEmoji(EMOJIS[0]); setColor('cyan')
    onClose()
    onNavigate ? onNavigate('agent') : router.push('/agent?center=new')
  }

  return (
    <Sheet open={open} onClose={onClose} label="Add agent">
      <div className="ag-row" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>Add Agent</div>
        <span className="ag-badge ag-badge--paper">PAPER</span>
      </div>
      <div className="ag-seg" role="tablist">
        <button className={kind === 'prompt' ? 'on' : ''} onClick={() => setKind('prompt')}>Build with prompt</button>
        <button className={kind === 'connected' ? 'on' : ''} onClick={() => setKind('connected')}>Connect your bot</button>
      </div>
      <input className="ag-fld" placeholder="Agent name" maxLength={18} value={name} onChange={e => setName(e.target.value)} />
      <div className="ag-picklab">Emoji</div>
      <div className="ag-pickrow">
        {EMOJIS.map(em => (
          <button key={em} className={'ag-epick' + (em === emoji ? ' ag-epick--on' : '')} onClick={() => setEmoji(em)}>{em}</button>
        ))}
      </div>
      <div className="ag-picklab">Color</div>
      <div className="ag-pickrow">
        {COLORS.map(c => (
          <button key={c.color} aria-label={c.color} style={{ background: c.hex }}
            className={'ag-cpick' + (c.color === color ? ' ag-cpick--on' : '')} onClick={() => setColor(c.color)} />
        ))}
      </div>
      {kind === 'prompt' ? (
        <textarea className="ag-fld" value={prompt} onChange={e => setPrompt(e.target.value)}
          placeholder="Strategy prompt — e.g. Trade 15-min ETH windows, buy Yes under 30¢ when momentum is up, max 3% per trade." />
      ) : (
        <>
          <input className="ag-fld" placeholder="https://your-bot.example.com/signals" value={endpointUrl} onChange={e => setEndpointUrl(e.target.value)} />
          <input className="ag-fld" placeholder="API key" value={apiKey} onChange={e => setApiKey(e.target.value)} />
          <div className="ag-sub" style={{ margin: '-2px 0 10px' }}>
            We send market signals; your bot returns orders. Runs against your paper balance until it clears review.
          </div>
        </>
      )}
      <button className="ag-pill ag-pill--primary" style={{ width: '100%' }} onClick={create}>Create agent</button>
    </Sheet>
  )
}
