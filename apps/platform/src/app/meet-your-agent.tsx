import Link from 'next/link'
import { AgentDemo } from '@/app/agent/components/agent-demo'
import { LandingAccess } from './landing-access'

// "Meet your Agent" — live interactive demo of the /agent app on the public
// landing. The demo runs the same mock engine as the app; state resets on
// reload, which is fine for a demo.
export function MeetYourAgent({ authed, referralCode, individualEnabled }: {
  authed: boolean
  referralCode: string | null
  individualEnabled: boolean
}) {
  return (
    <section id="meet-your-agent" className="mt-20 w-full max-w-5xl mx-auto px-2">
      <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-14">
        <div className="flex-1 text-center lg:text-left">
          <div className="text-xs tracking-[0.25em] font-semibold" style={{ color: '#2FD37A' }}>
            MEET YOUR AGENT
          </div>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold text-white tracking-tight">
            It trades. You watch.
          </h2>
          <ul className="mt-6 space-y-3 text-white/85 text-sm md:text-base max-w-md mx-auto lg:mx-0 text-left">
            <li className="flex gap-3">
              <span style={{ color: '#2FD37A' }}>●</span>
              Works Bitcoin &amp; crypto up/down markets around the clock — 5 and 15-minute windows on Kalshi and Polymarket.
            </li>
            <li className="flex gap-3">
              <span style={{ color: '#2FD37A' }}>●</span>
              Subscribe to better models — or build your own with a plain-English prompt.
            </li>
            <li className="flex gap-3">
              <span style={{ color: '#2FD37A' }}>●</span>
              Every trade explained: the signal it saw, or the gate that stopped it.
            </li>
          </ul>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start items-center">
            {authed ? (
              <Link
                href="/agent"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold tracking-wide text-stone-950 transition hover:opacity-90"
                style={{ background: '#2FD37A' }}
              >
                Open App →
              </Link>
            ) : (
              individualEnabled && (
                <LandingAccess
                  referralCode={referralCode}
                  variant="hero"
                  mode="individual"
                  tone="primary"
                  label="Get your agent →"
                />
              )
            )}
            <span className="text-white/50 text-xs">← it&rsquo;s live, try it</span>
          </div>
        </div>
        <AgentDemo />
      </div>
    </section>
  )
}
