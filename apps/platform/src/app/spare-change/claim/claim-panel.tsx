'use client'
import { useEffect, useRef, useState } from 'react'
import { CLAIM_COPY, parseClaimToken, parseVenmoHandle } from '@/lib/spare-change-claim'
import { CREAM, NAVY } from '../../visuals'
import { ShareBlock, type Joined } from '../../launching-soon/waitlist-share'
import { Spinner } from '../newsletter-fields'
import { CheckBadge, cardStyle, useFocusOnMount } from '../saved-screen'

const peace = 'var(--font-peace), var(--font-open-sauce), sans-serif'
const sauce = 'var(--font-open-sauce), sans-serif'
const headingClass = 'text-[clamp(1.75rem,7vw,2.25rem)] leading-none'

type View =
  | { status: 'loading' }
  | { status: 'open' }
  | { status: 'claimed'; masked: string }
  | { status: 'saved'; handle: string; share: Joined | null }
  | { status: 'cap_reached' | 'unknown' | 'too_many' | 'error' }

/** A message card that takes focus and is read out when it appears. */
function Notice({ heading, check = false, children }: { heading?: string; check?: boolean; children: React.ReactNode }) {
  const ref = useFocusOnMount<HTMLDivElement>()
  return (
    <div ref={ref} tabIndex={-1} role="status" className="flex w-full flex-col gap-4 px-6 py-6 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white" style={cardStyle}>
      {heading ? (
        <div className="flex items-center gap-4">
          {check ? <CheckBadge /> : null}
          <h1 className={headingClass} style={{ fontFamily: peace }}>
            {heading}
          </h1>
        </div>
      ) : null}
      {children}
    </div>
  )
}

/**
 * Everything the claim page can show: the Venmo form for a good, unclaimed link; "You're all set" with the username masked for one
 * already claimed; one neutral line for a link that does not work (missing, malformed or unknown: all the same); the round being full;
 * and the saved screen. The same checks run again on the server; this only decides what to draw.
 */
export function ClaimPanel({ token }: { token: string | null }) {
  const valid = parseClaimToken(token)
  const [view, setView] = useState<View>(valid ? { status: 'loading' } : { status: 'unknown' })
  const [venmo, setVenmo] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!valid) return
    const stop = new AbortController()
    fetch(`/api/spare-change-claim?t=${encodeURIComponent(valid)}`, { signal: stop.signal, cache: 'no-store' })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { status?: string; masked?: string }
        if (data.status === 'open') setView({ status: 'open' })
        else if (data.status === 'claimed' && data.masked) setView({ status: 'claimed', masked: data.masked })
        else if (data.status === 'cap_reached' || data.status === 'unknown' || data.status === 'too_many') setView({ status: data.status })
        else setView({ status: 'error' })
      })
      .catch(() => {
        if (!stop.signal.aborted) setView({ status: 'error' })
      })
    return () => stop.abort()
  }, [valid])

  const refuse = (text: string) => {
    setProblem(text)
    input.current?.focus()
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (busy.current || !valid) return
    if (!parseVenmoHandle(venmo)) return refuse(CLAIM_COPY.invalidVenmo)
    busy.current = true
    setProblem(null)
    setSaving(true)
    try {
      const res = await fetch('/api/spare-change-claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: valid, venmo }) })
      const data = (await res.json().catch(() => ({}))) as { status?: string; handle?: string; masked?: string; share?: Joined | null }
      if (data.status === 'saved' && data.handle) setView({ status: 'saved', handle: data.handle, share: data.share ?? null })
      else if (data.status === 'claimed' && data.masked) setView({ status: 'claimed', masked: data.masked })
      else if (data.status === 'cap_reached' || data.status === 'unknown') setView({ status: data.status })
      else if (data.status === 'invalid_venmo') refuse(CLAIM_COPY.invalidVenmo)
      else if (data.status === 'duplicate_venmo') refuse(CLAIM_COPY.duplicate)
      else refuse(res.status === 429 ? CLAIM_COPY.tooMany : CLAIM_COPY.error)
    } catch {
      refuse(CLAIM_COPY.error)
    } finally {
      busy.current = false
      setSaving(false)
    }
  }

  const back = (
    <a href="/spare-change" className="text-base font-bold underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white" style={{ fontFamily: sauce }}>
      Back to Spare Change Millionaire
    </a>
  )

  if (view.status === 'loading') {
    return (
      <p role="status" className="flex items-center gap-3 text-lg font-bold" style={{ fontFamily: sauce }}>
        <Spinner />
        Checking your link…
      </p>
    )
  }
  if (view.status === 'saved') {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <Notice heading="Saved." check>
          <p className="text-lg font-semibold [overflow-wrap:anywhere]">{CLAIM_COPY.saved(view.handle).replace(/^Saved\. /, '')}</p>
        </Notice>
        {view.share ? <ShareBlock joined={view.share} newsletter /> : back}
      </div>
    )
  }
  if (view.status === 'claimed') {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <Notice heading={CLAIM_COPY.claimedHeading} check>
          <p className="text-lg font-semibold">{CLAIM_COPY.claimedLine(view.masked)}</p>
          <p className="text-base font-semibold">{CLAIM_COPY.claimedNote}</p>
        </Notice>
        {back}
      </div>
    )
  }
  if (view.status !== 'open') {
    const text = { cap_reached: CLAIM_COPY.capReached, unknown: CLAIM_COPY.unknown, too_many: CLAIM_COPY.tooMany, error: CLAIM_COPY.error }[view.status]
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <Notice>
          <p className="text-lg font-bold">{text}</p>
        </Notice>
        {view.status === 'cap_reached' ? back : null}
      </div>
    )
  }
  return (
    <form onSubmit={save} noValidate aria-busy={saving || undefined} className="flex w-full max-w-md flex-col gap-4 px-6 py-6 text-left" style={cardStyle}>
      <h1 className={headingClass} style={{ fontFamily: peace }}>
        {CLAIM_COPY.heading}
      </h1>
      <label htmlFor="claim-venmo" className="text-base font-bold">
        {CLAIM_COPY.fieldLabel}
      </label>
      <div className="-mt-2 flex min-h-[3.25rem] items-center rounded-full bg-white pl-5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#0B1E3F]" style={{ border: `0.18rem solid ${NAVY}` }}>
        <span aria-hidden="true" className="text-lg font-bold">
          @
        </span>
        <input
          ref={input}
          id="claim-venmo"
          name="venmo"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={60}
          value={venmo}
          onChange={(e) => {
            // The @ is already drawn in front of the box, so one typed or pasted with the name is dropped.
            setVenmo(e.target.value.replace(/^\s*@+/, ''))
            if (problem) setProblem(null)
          }}
          placeholder={CLAIM_COPY.fieldPlaceholder}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? 'claim-venmo-error claim-venmo-note' : 'claim-venmo-note'}
          className="min-h-[3rem] w-full min-w-0 rounded-r-full bg-transparent pl-1 pr-5 text-lg outline-none"
          style={{ color: NAVY, fontFamily: sauce }}
        />
      </div>
      {problem ? (
        <p id="claim-venmo-error" role="alert" className="-mt-1 text-base font-bold" style={{ color: '#A61B1F' }}>
          {problem}
        </p>
      ) : null}
      <p id="claim-venmo-note" className="text-base font-semibold">
        {CLAIM_COPY.fieldNote}
      </p>
      <button type="submit" disabled={saving} className="inline-flex min-h-[3.25rem] items-center justify-center gap-3 rounded-full px-8 text-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0B1E3F] disabled:opacity-70" style={{ background: NAVY, color: CREAM, fontFamily: sauce }}>
        {saving ? (
          <>
            <Spinner />
            {CLAIM_COPY.saving}
          </>
        ) : (
          CLAIM_COPY.save
        )}
      </button>
    </form>
  )
}
