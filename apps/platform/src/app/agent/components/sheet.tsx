'use client'
import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Sheet({ open, onClose, label, children }: {
  open: boolean; onClose: () => void; label?: string; children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const el = ref.current
    if (!el) return
    const prevFocus = document.activeElement as HTMLElement | null
    el.focus()

    // Lock the surrounding scroller, not the body — inside the landing demo the
    // sheet lives in the phone frame and the page itself must keep scrolling.
    const scroller = el.closest<HTMLElement>('.agent-main, .ag-demo-main')
    const prevOverflow = scroller ? scroller.style.overflow : ''
    if (scroller) scroller.style.overflow = 'hidden'

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); return }
      if (e.key !== 'Tab' || !el) return
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) { e.preventDefault(); el.focus(); return }
      const first = items[0], last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === el)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
      else if (active && !el.contains(active)) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (scroller) scroller.style.overflow = prevOverflow
      prevFocus?.focus?.()
    }
  }, [open])

  if (!open) return null
  return (
    <>
      <div className="ag-sheet-veil" onClick={onClose} aria-hidden="true" />
      <div className="ag-sheet" role="dialog" aria-modal="true" aria-label={label} ref={ref} tabIndex={-1}>
        <div className="ag-sheet__grab" aria-hidden="true" />
        {children}
      </div>
    </>
  )
}
