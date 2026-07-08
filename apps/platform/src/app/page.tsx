import Image from 'next/image'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { LandingAccess } from './landing-access'
import { VenueTicker } from './venue-ticker'
import { LandingSignupButton } from './landing-signup-button'
import { getWaitlistCount, displayedPosition } from '@/lib/waitlist'
import { isValidReferralCodeFormat } from '@/lib/referral-code'
import { VENUES } from '@/lib/venues'
import { loadMarketCount } from '@/lib/markets-data'
import { getSignupConfig } from '@/lib/signup-config'
import { getAuthClient } from '@/lib/supabase-auth'
import { LandingMobileNav } from './landing-mobile-nav'
import { HeroBackground } from './hero-background'
import { MeetYourAgent } from './meet-your-agent'

export const dynamic = 'force-dynamic'

export default async function LandingPage() {
  const realCount = await getWaitlistCount().catch(() => 0)
  const displayCount = displayedPosition(realCount)

  const cookieStore = await cookies()
  const rawRef = cookieStore.get('sneakers_ref')?.value ?? null
  const referralCode =
    rawRef && isValidReferralCodeFormat(rawRef) ? rawRef : null

  // Stats strip inputs — fail soft so a scraper blip doesn't blank the page.
  const venueCount = VENUES.length
  const marketCount = await loadMarketCount().catch(() => 0)
  // Kept friendly: round down to nearest 10 so it doesn't look like a ticker
  // that moves by one every minute.
  const roundedMarkets = marketCount >= 100 ? Math.floor(marketCount / 10) * 10 : marketCount

  const signupCfg = getSignupConfig()

  // Auth-aware nav: logged-in users get app entry points instead of the
  // signup funnel. Fail-soft — any auth hiccup renders the logged-out nav.
  // AGENT_PREVIEW=1 (local QA only) forces the authed variant.
  let authed = process.env.NODE_ENV !== 'production' && process.env.AGENT_PREVIEW === '1'
  if (!authed) {
    try {
      const supabase = await getAuthClient()
      const { data } = await supabase.auth.getUser()
      authed = Boolean(data.user)
    } catch {
      authed = false
    }
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-28 pb-32 overflow-hidden isolate">
      <HeroBackground />

      {/* Top nav: just LOG IN + SIGN UP. SIGN UP opens a small dropdown with
          Individual / Organization options so we don't clutter the bar with
          four separate buttons. */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2 justify-end">
        <div className="hidden sm:flex items-center gap-2">
          {authed ? (
            <>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs font-semibold tracking-wider text-white ring-1 ring-white/30 backdrop-blur-sm hover:bg-white/10 hover:ring-white/60 transition"
              >
                DASHBOARD
              </Link>
              <Link
                href="/agent"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold tracking-wider text-stone-950 transition hover:opacity-90"
                style={{ background: '#2FD37A' }}
              >
                OPEN APP →
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs font-semibold tracking-wider text-white ring-1 ring-white/30 backdrop-blur-sm hover:bg-white/10 hover:ring-white/60 transition"
              >
                LOG IN
              </Link>
              {(signupCfg.individualEnabled || signupCfg.organizationEnabled) && (
                <LandingSignupButton
                  referralCode={referralCode}
                  individualEnabled={signupCfg.individualEnabled}
                  organizationEnabled={signupCfg.organizationEnabled}
                />
              )}
            </>
          )}
        </div>
        {/* Mobile: hamburger + slide-down panel */}
        <LandingMobileNav referralCode={referralCode} signupCfg={signupCfg} authed={authed} />
      </div>

      <div className="max-w-2xl w-full space-y-8 text-center text-white">
        <div className="flex flex-col items-center">
          <div className="text-xs text-blue-300/80 mb-6 tracking-wider">
            SNEAKERS TERMINAL · FOR COLLEGE STUDENTS
          </div>
          <div className="mb-4 rounded-full bg-stone-950 p-6 ring-1 ring-blue-400/30 shadow-[0_8px_32px_rgba(0,0,0,0.55),0_0_48px_rgba(0,112,60,0.18)]">
            <Image
              src="/logo.png"
              alt="Sneakers"
              width={280}
              height={280}
              priority
              className="drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
            />
          </div>
          <h1 className="sr-only">Sneakers Terminal — the prediction market terminal for college</h1>
          <div className="text-blue-400 text-2xl md:text-3xl font-bold tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
            The prediction terminal for college.
          </div>
          <div className="mt-3 text-white/85 text-base md:text-lg drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] max-w-lg">
            Every market on Kalshi, Polymarket, NoVig, Opinion and 30+ sportsbooks — in one
            place, ranked against your classmates.
          </div>

          {/* Primary CTAs — moved up directly under the subtitle so the
              first action a visitor sees is "Get in", not "scroll to learn
              more". Same conditional rendering driven by signup-config. */}
          <div className="mt-7 w-full">
            {authed ? (
              <div className="flex justify-center">
                <Link
                  href="/agent"
                  className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold tracking-wide text-stone-950 transition hover:opacity-90 shadow-[0_8px_32px_rgba(47,211,122,0.3)]"
                  style={{ background: '#2FD37A' }}
                >
                  Open App →
                </Link>
              </div>
            ) : signupCfg.allClosed ? (
              <div className="rounded-lg ring-1 ring-amber-400/40 bg-amber-500/10 backdrop-blur-sm px-6 py-5 max-w-md mx-auto text-center">
                <div className="text-[10px] tracking-[0.2em] text-amber-300 font-semibold mb-1">
                  SIGNUPS PAUSED
                </div>
                <div className="text-sm text-white/85 leading-relaxed">
                  {signupCfg.banner ?? 'Signups are temporarily paused. Check back soon.'}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {signupCfg.banner && (
                  <div className="text-xs text-amber-200/90 max-w-md mx-auto px-4 py-2 rounded bg-amber-500/10 ring-1 ring-amber-400/30 text-center">
                    {signupCfg.banner}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                  {signupCfg.individualEnabled && (
                    <LandingAccess
                      referralCode={referralCode}
                      variant="hero"
                      mode="individual"
                      tone="primary"
                    />
                  )}
                  {signupCfg.organizationEnabled && (
                    <LandingAccess
                      referralCode={referralCode}
                      variant="hero"
                      mode="organization"
                      tone="secondary"
                    />
                  )}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Three pillars that make this a college-first product — directly
            below the CTAs so visitors scan value props after seeing the
            primary action. Stats strip lives after the pillars. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mx-auto max-w-xl text-left">
          <div className="rounded-lg bg-black/40 backdrop-blur-sm border border-blue-400/30 px-4 py-3">
            <div className="text-[10px] tracking-[0.15em] text-blue-300/80 font-semibold mb-1">
              75% OFF
            </div>
            <div className="text-xs text-white/85 leading-snug">
              Verified <span className="text-blue-300 font-semibold">.edu</span> students get
              2 weeks free, then 75% off forever.
            </div>
          </div>
          <div className="rounded-lg bg-black/40 backdrop-blur-sm border border-blue-400/30 px-4 py-3">
            <div className="text-[10px] tracking-[0.15em] text-blue-300/80 font-semibold mb-1">
              LEADERBOARDS
            </div>
            <div className="text-xs text-white/85 leading-snug">
              Compete on <span className="text-blue-300 font-semibold">rate of return</span>{' '}
              — per-school + national.
            </div>
          </div>
          <div className="rounded-lg bg-black/40 backdrop-blur-sm border border-blue-400/30 px-4 py-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="text-[10px] tracking-[0.15em] text-blue-300/80 font-semibold">
                GROUPS
              </div>
              <div className="text-[9px] tracking-[0.15em] text-amber-300/80 font-semibold bg-amber-500/10 ring-1 ring-amber-400/30 px-1.5 py-0.5 rounded">
                EARLY ACCESS
              </div>
            </div>
            <div className="text-xs text-white/85 leading-snug">
              Build a team with your{' '}
              <span className="text-blue-300 font-semibold">frat, dorm, or class</span>.
              Captains sign up now, members onboard as we ship.{' '}
              <Link
                href="/chapter-preview"
                className="text-blue-300/90 hover:text-blue-300 underline underline-offset-2 whitespace-nowrap"
              >
                See the preview →
              </Link>
            </div>
          </div>
        </div>

        {/* Live stats strip — real numbers, no theater. Lives after the
            pillars so it reads as supporting detail, not primary content. */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] tracking-wider drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono tabular-nums text-blue-300 font-bold text-sm">
              {venueCount}
            </span>
            <span className="text-white/60 uppercase">venues tracked</span>
          </div>
          <span className="text-white/20" aria-hidden>·</span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono tabular-nums text-blue-300 font-bold text-sm">
              {roundedMarkets > 0 ? `${roundedMarkets}+` : '—'}
            </span>
            <span className="text-white/60 uppercase">live markets</span>
          </div>
          <span className="text-white/20" aria-hidden>·</span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono tabular-nums text-blue-300 font-bold text-sm">
              10m
            </span>
            <span className="text-white/60 uppercase">refresh cadence</span>
          </div>
        </div>

        {referralCode && (
          <div className="mx-auto max-w-md border border-blue-400/50 bg-black/40 backdrop-blur-sm px-4 py-3 text-xs text-white/90">
            <div>
              {'>'} Referred by{' '}
              <span className="text-blue-400 tracking-wider font-semibold">{referralCode}</span>
            </div>
            <div className="text-white/60 mt-1">
              Your signup boosts them 5 positions in the queue.
            </div>
          </div>
        )}

        <div className="text-xs text-blue-300 tracking-wider drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
          {'>'} {displayCount} STUDENTS ON THE LIST
        </div>

        <div className="text-[11px] text-white/60 tracking-wide space-x-4">
          <a
            href="/students"
            className="text-blue-300/90 hover:text-blue-300 underline underline-offset-4"
          >
            How student verification works →
          </a>
          <span className="text-white/20">·</span>
          <a
            href="/venues"
            className="text-white/60 hover:text-white/90 underline underline-offset-4"
          >
            Venues we track
          </a>
        </div>
      </div>

      <MeetYourAgent
        authed={authed}
        referralCode={referralCode}
        individualEnabled={signupCfg.individualEnabled}
      />

      <VenueTicker />
    </main>
  )
}
