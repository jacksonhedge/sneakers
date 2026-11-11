'use client'

import { useEffect, useRef, useState } from 'react'
import { burst } from './fun-link'

// The two buttons on the phone's screen really work. Pay Sam slaps down a "Paid" stamp (play money) and then resets; Make it free?
// flips to the joke. Both press like the real buttons and throw confetti. Sized in em, like the rest of the drawing.
const RED = '#E03A3E'
const CREAM = '#FFF3D6'
const NAVY = '#0B1E3F'

export function PhoneButtons() {
  const [paid, setPaid] = useState(false)
  const [free, setFree] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const reset = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setPaid(false)
      setFree(false)
    }, 2600)
  }
  const fire = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    burst(e.currentTarget, e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2)
  }

  return (
    <div className="mt-auto flex flex-col items-stretch" style={{ gap: '0.65em', padding: '0 1.1em 1.5em' }}>
      <button
        type="button"
        className="fun-btn text-center"
        aria-live="polite"
        onClick={(e) => {
          fire(e)
          setPaid(true)
          setFree(false)
          reset()
        }}
        style={{ background: paid ? NAVY : RED, color: CREAM, borderRadius: '99em', padding: '0.85em 0', fontSize: '1em', fontWeight: 700, boxShadow: `0.12em 0.18em 0 ${paid ? RED : NAVY}`, border: 0, cursor: 'pointer', ['--fun-shadow' as string]: paid ? RED : NAVY }}
      >
        {paid ? 'Paid Sam $12.00 ✓' : 'Pay Sam'}
      </button>
      <button
        type="button"
        className="fun-btn text-center"
        aria-live="polite"
        onClick={(e) => {
          fire(e)
          setFree(true)
          setPaid(false)
          reset()
        }}
        style={{ background: free ? CREAM : 'transparent', border: `0.12em solid ${NAVY}`, borderRadius: '99em', padding: '0.6em 0', fontSize: '0.85em', fontWeight: 700, color: NAVY, cursor: 'pointer', boxShadow: free ? `0.1em 0.14em 0 ${NAVY}` : 'none' }}
      >
        {free ? 'Sam picks right: it’s free' : 'Make it free?'}
      </button>
    </div>
  )
}
