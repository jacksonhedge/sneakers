'use client'
import { useEffect, useState } from 'react'
import { useAgent } from '../lib/store'

const PRESET_LABELS: Record<string, string> = {
  longshot: 'Longshot 10–35¢',
  momentum: 'Momentum',
  fade: 'Fade the spike',
  conservative: 'Conservative',
}

const FALLBACK_PROMPT =
  'Trade 5 and 15-minute crypto markets only. Favor longshots priced 10–35¢ with momentum confirmation. ' +
  'Max 5% of bankroll per trade. Skip anything with a spread over 4¢.'

export function MyModelEditor() {
  const { live, api, dispatch } = useAgent()
  const [prompt, setPrompt] = useState(FALLBACK_PROMPT)
  const [preset, setPreset] = useState('longshot')
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!live) return
    void api.getConfig().then(cfg => {
      if (cfg) { setPrompt(cfg.prompt || FALLBACK_PROMPT); setPreset(cfg.preset) }
    })
  }, [live, api])

  function save() {
    dispatch({ type: 'updateConfig', patch: { prompt, preset } })
    setDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      <textarea
        className="mprompt"
        style={{ width: '100%', minHeight: 96, resize: 'vertical', fontFamily: 'inherit', display: 'block' }}
        value={prompt}
        maxLength={2000}
        aria-label="Strategy prompt"
        onChange={e => { setPrompt(e.target.value); setDirty(true) }}
      />
      <div className="mchips">
        {Object.entries(PRESET_LABELS).map(([key, label]) => (
          <button
            key={key}
            className={'mchip' + (preset === key ? ' mchip--on' : '')}
            onClick={() => { setPreset(key); setDirty(true) }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="ag-sub" style={{ marginTop: 12 }}>
        Your model re-reads this prompt before every window. Changes apply to the next scan.
      </div>
      {(dirty || saved) && (
        <button className="ag-pill ag-pill--primary" style={{ width: '100%', marginTop: 10, fontSize: 14 }} onClick={save} disabled={saved}>
          {saved ? 'Saved ✓' : 'Save prompt'}
        </button>
      )}
    </>
  )
}
