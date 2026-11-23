'use client'
import { useState } from 'react'
import { NEWSLETTER_NAME, REFERRAL_CAP_NOTE, REFERRAL_SHARE_LINE, friendsJoinedText } from '@/lib/spare-change'
import { emailShareHref, newsletterReferralLink, newsletterShareText, referralLink, referralShareText, smsShareHref } from '@/lib/waitlist-referral'
import { CREAM, NAVY } from '../visuals'

export interface Joined {
  code: string
  referrals: number
  position: number | null
}

const sauce = 'var(--font-open-sauce), sans-serif'

/**
 * A person's own link, a share button and their real standing. Shown to someone new to the Sneakers waitlist (nothing for anyone else).
 * `newsletter` is true only for someone on the newsletter list: their link then goes to /spare-change (not /launching-soon), the share
 * text is about the newsletter, and their friends line is the credited number out of 5. Everyone else
 * sees the plain Sneakers waitlist count, exactly as before.
 */
export function ShareBlock({ joined, newsletter = false }: { joined: Joined | null; newsletter?: boolean }) {
  const [note, setNote] = useState<string | null>(null)
  // A newsletter member shares the newsletter page: a friend only counts for them once that friend is a member too.
  const link = joined ? (newsletter ? newsletterReferralLink : referralLink)(window.location.origin, joined.code) : null
  const share = async () => {
    if (!link) return
    const text = (newsletter ? newsletterShareText : referralShareText)(link)
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
  if (!link || !joined) return null
  return (
    <>
      <p className="text-lg font-bold" style={{ fontFamily: sauce }}>
        {newsletter ? REFERRAL_SHARE_LINE : 'Friends who join with your link move you up the list.'}
      </p>
      <input readOnly aria-label="Your link" value={link} onFocus={(e) => e.currentTarget.select()} className="min-h-[3.25rem] w-full rounded-full px-5 text-base" style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, fontFamily: sauce }} />
      <button type="button" onClick={share} className="min-h-[3.25rem] rounded-full px-8 text-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white" style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, boxShadow: `0.25rem 0.3rem 0 ${NAVY}`, fontFamily: sauce }}>
        Share your link
      </button>
      {newsletter ? (
        <div className="flex w-full gap-3">
          <a href={smsShareHref(newsletterShareText(link))} className="flex min-h-[3.25rem] flex-1 items-center justify-center rounded-full px-4 text-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white" style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, boxShadow: `0.25rem 0.3rem 0 ${NAVY}`, fontFamily: sauce }}>
            Text a friend
          </a>
          <a href={emailShareHref(NEWSLETTER_NAME, newsletterShareText(link))} className="flex min-h-[3.25rem] flex-1 items-center justify-center rounded-full px-4 text-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white" style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, boxShadow: `0.25rem 0.3rem 0 ${NAVY}`, fontFamily: sauce }}>
            Email a friend
          </a>
        </div>
      ) : null}
      {note ? <p style={{ fontFamily: sauce }}>{note}</p> : null}
      <p className="text-base font-semibold" style={{ fontFamily: sauce }}>
        {joined.position !== null ? `You are #${joined.position} in line. ` : ''}
        {newsletter ? `${friendsJoinedText(joined.referrals)} ${REFERRAL_CAP_NOTE}` : joined.referrals === 1 ? '1 friend joined with your link.' : `${joined.referrals} friends joined with your link.`}
      </p>
    </>
  )
}

/** What a person sees after joining without the newsletter: the confirmation line, then their share block. */
export function WaitlistShare({ text, joined, newsletter = false }: { text: string; joined: Joined | null; newsletter?: boolean }) {
  return (
    <div role="status" className="flex w-full max-w-md flex-col items-center gap-4">
      <p className="rounded-3xl px-6 py-4 text-lg font-bold" style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, boxShadow: `0.25rem 0.3rem 0 ${NAVY}`, fontFamily: sauce }}>
        {text}
      </p>
      <ShareBlock joined={joined} newsletter={newsletter} />
    </div>
  )
}
