'use client'
import { useState } from 'react'
import { referralLink, referralShareText } from '@/lib/waitlist-referral'
import { CREAM, NAVY } from '../visuals'

export interface Joined {
  code: string
  referrals: number
  position: number | null
}

const sauce = 'var(--font-open-sauce), sans-serif'

/** What a person sees after joining: the confirmation, and (for someone new to the Sneakers waitlist) their own link, a share button and their real standing. */
export function WaitlistShare({ text, joined }: { text: string; joined: Joined | null }) {
  const [note, setNote] = useState<string | null>(null)
  const link = joined ? referralLink(window.location.origin, joined.code) : null
  const share = async () => {
    if (!link) return
    const text = referralShareText(link)
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        setNote('Copied. Paste it in a text.')
      }
    } catch {
      // cancelled or blocked: the link stays on screen to copy by hand
    }
  }
  return (
    <div role="status" className="flex w-full max-w-md flex-col items-center gap-4">
      <p className="rounded-3xl px-6 py-4 text-lg font-bold" style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, boxShadow: `0.25rem 0.3rem 0 ${NAVY}`, fontFamily: sauce }}>
        {text}
      </p>
      {link && joined ? (
        <>
          <p className="text-lg font-bold" style={{ fontFamily: sauce }}>
            Friends who join with your link move you up the list.
          </p>
          <input readOnly aria-label="Your link" value={link} onFocus={(e) => e.currentTarget.select()} className="min-h-[3.25rem] w-full rounded-full px-5 text-base" style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, fontFamily: sauce }} />
          <button type="button" onClick={share} className="min-h-[3.25rem] rounded-full px-8 text-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white" style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, boxShadow: `0.25rem 0.3rem 0 ${NAVY}`, fontFamily: sauce }}>
            Share your link
          </button>
          {note ? <p style={{ fontFamily: sauce }}>{note}</p> : null}
          <p className="text-base font-semibold" style={{ fontFamily: sauce }}>
            {joined.position !== null ? `You are #${joined.position} in line. ` : ''}
            {joined.referrals === 1 ? '1 friend joined with your link.' : `${joined.referrals} friends joined with your link.`}
          </p>
        </>
      ) : null}
    </div>
  )
}
