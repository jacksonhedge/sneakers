'use client'

import { useEffect, useRef, type ReactNode } from 'react'

// Squishy letters (Jackson's pick from the logo lab, 2026-10-26): tap a letter and it squashes like a sneaker sole, then springs
// back; with a mouse, the letters near the cursor lift as it passes. Each squishable unit is every element inside this root with
// the same data-sq key (an SVG letter's drop, outline and fill move together). Reduced motion: a small pop, no lift.
export function Squish({ children, className, follow = false }: { children: ReactNode; className?: string; follow?: boolean }) {
  const root = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const host = root.current
    if (!host) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const units = () => {
      const map = new Map<string, Element[]>()
      host.querySelectorAll('[data-sq]').forEach((n) => {
        const key = n.getAttribute('data-sq') as string
        map.set(key, [...(map.get(key) ?? []), n])
      })
      return map
    }
    // SVG lengths are the drawing's own units (the wordmark is 1950 wide); HTML letters move by their own height.
    const rise = (n: Element) => (n instanceof SVGElement ? 90 : (n as HTMLElement).getBoundingClientRect().height * 0.3)
    const squash = (parts: Element[]) => {
      for (const n of parts) {
        const up = rise(n)
        n.animate(
          reduce
            ? [{ transform: 'scale(1.06)' }, { transform: 'none' }]
            : [
                { transform: 'none' },
                { transform: 'scale(1.2, 0.7)', offset: 0.22 },
                { transform: `translateY(${-up}px) scale(0.9, 1.14)`, offset: 0.5 },
                { transform: 'scale(1.05, 0.96)', offset: 0.78 },
                { transform: 'none' },
              ],
          { duration: reduce ? 160 : 560, easing: 'ease-out', composite: 'add' },
        )
      }
    }
    const down = (e: PointerEvent) => {
      const hit = (e.target as Element).closest('[data-sq]')
      const key = hit?.getAttribute('data-sq')
      if (key) squash(units().get(key) ?? [])
    }
    // With a mouse a passing cursor also squashes the letter it enters, once.
    let last: string | null = null
    const over = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const key = (e.target as Element).closest('[data-sq]')?.getAttribute('data-sq') ?? null
      if (key && key !== last && !follow) squash(units().get(key) ?? [])
      last = key
    }
    host.addEventListener('pointerdown', down)
    host.addEventListener('pointerover', over)

    // Follow: letters near a mouse cursor lift a little, eased each frame.
    let raf = 0
    let targets = new Map<HTMLElement, number>()
    const now = new Map<HTMLElement, number>()
    const frame = () => {
      raf = 0
      let moving = false
      targets.forEach((t, n) => {
        const v = now.get(n) ?? 0
        const next = v + (t - v) * 0.22
        now.set(n, next)
        if (Math.abs(next - t) > 0.2) moving = true
        n.style.transform = next > 0.2 ? `translateY(${-next}px) rotate(${(-next / Math.max(1, n.offsetHeight)) * 40}deg)` : ''
      })
      if (moving) raf = requestAnimationFrame(frame)
    }
    const move = (e: PointerEvent) => {
      if (!follow || reduce || e.pointerType !== 'mouse') return
      const next = new Map<HTMLElement, number>()
      host.querySelectorAll<HTMLElement>('[data-sq]').forEach((n) => {
        const r = n.getBoundingClientRect()
        if (r.width === 0) return
        const dx = (r.left + r.width / 2 - e.clientX) / (r.height * 1.6)
        const dy = (r.top + r.height / 2 - e.clientY) / (r.height * 1.1)
        next.set(n, r.height * 0.2 * Math.exp(-(dx * dx + dy * dy)))
      })
      targets = next
      if (!raf) raf = requestAnimationFrame(frame)
    }
    const leave = () => {
      targets = new Map([...targets.keys()].map((n) => [n, 0]))
      if (!raf) raf = requestAnimationFrame(frame)
    }
    host.addEventListener('pointermove', move)
    host.addEventListener('pointerleave', leave)
    return () => {
      host.removeEventListener('pointerdown', down)
      host.removeEventListener('pointerover', over)
      host.removeEventListener('pointermove', move)
      host.removeEventListener('pointerleave', leave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [follow])

  return (
    // A span, so it can sit inside the headline; give it `block` where it needs to be one.
    <span ref={root} className={className}>
      {children}
    </span>
  )
}
