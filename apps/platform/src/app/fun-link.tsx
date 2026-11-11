'use client'

import { useRef, type AnchorHTMLAttributes, type MouseEvent } from 'react'

// A sticker button that feels good to press: it lifts and tilts on hover, drops flat onto its shadow when pressed, and a click throws
// a burst of confetti (and a short buzz on phones) before the page moves on. A modified click (new tab) or reduced motion skips the
// wait and just goes. The look lives in .fun-btn (page.tsx MOTION); this adds the burst.
const COLORS = ['#E03A3E', '#1B4DE4', '#FFF3D6', '#0B1E3F', '#FFC83D']

export function burst(origin: HTMLElement, x: number, y: number, kind: 'confetti' | 'shoes' = 'confetti') {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) return 0
  const count = 18
  for (let i = 0; i < count; i++) {
    const shoe = kind === 'shoes' && i % 3 === 0
    const bit = document.createElement(shoe ? 'img' : 'span')
    const size = shoe ? 30 + Math.random() * 12 : 6 + Math.random() * 7
    if (shoe) {
      ;(bit as HTMLImageElement).src = '/sneakers-shoes-s.png'
      ;(bit as HTMLImageElement).alt = ''
    }
    Object.assign(bit.style, shoe ? { position: 'fixed', left: `${x}px`, top: `${y}px`, width: `${size}px`, height: 'auto', pointerEvents: 'none', zIndex: '9999' } : {
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      width: `${size}px`,
      height: `${size * (Math.random() > 0.5 ? 1 : 0.5)}px`,
      background: COLORS[i % COLORS.length],
      border: '1.5px solid #0B1E3F',
      borderRadius: Math.random() > 0.5 ? '50%' : '2px',
      pointerEvents: 'none',
      zIndex: '9999',
    })
    document.body.appendChild(bit)
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4
    const dist = 60 + Math.random() * 70
    const dx = Math.cos(angle) * dist
    const dy = Math.sin(angle) * dist - 30
    bit
      .animate(
        [
          { transform: 'translate(-50%, -50%) scale(1) rotate(0)', opacity: 1 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: 0.55 },
          { transform: `translate(calc(-50% + ${dx * 1.1}px), calc(-50% + ${dy + 70}px)) scale(0.6) rotate(${Math.random() * 540}deg)`, opacity: 0 },
        ],
        { duration: 650 + Math.random() * 200, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)', fill: 'forwards' },
      )
      .finished.then(() => bit.remove())
  }
  origin.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.08, 0.92)', offset: 0.3 }, { transform: 'scale(0.97, 1.04)', offset: 0.65 }, { transform: 'scale(1)' }],
    { duration: 380, easing: 'ease-out', composite: 'add' },
  )
  try {
    navigator.vibrate?.(12)
  } catch {
    // Not every browser has it; the burst is enough.
  }
  return 240
}

export function FunLink({ className = '', onClick, children, shoes = false, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { shoes?: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null)
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    const a = ref.current
    if (e.defaultPrevented || !a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const rect = a.getBoundingClientRect()
    // Keyboard activation reports 0,0; throw from the middle of the button then.
    const x = e.clientX || rect.left + rect.width / 2
    const y = e.clientY || rect.top + rect.height / 2
    const wait = burst(a, x, y, shoes ? 'shoes' : 'confetti')
    if (wait && a.href) {
      e.preventDefault()
      window.setTimeout(() => {
        window.location.href = a.href
      }, wait)
    }
  }
  return (
    <a ref={ref} className={`fun-btn ${className}`} onClick={go} {...rest}>
      <span className="fun-label inline-block">{children}</span>
    </a>
  )
}
