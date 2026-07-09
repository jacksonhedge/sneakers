import { getAuthClient } from '@/lib/supabase-auth'
import { getServerClient } from '@/lib/supabase-server'
import { VENUE_META } from '../lib/catalog'
import { ProfileView, type ProfileSection } from '../components/profile-view'

export const dynamic = 'force-dynamic'

// Server page for the agent-app Profile tab. Fetches real account data —
// mirroring src/app/dashboard/profile/page.tsx's queries exactly (same
// tables/columns, same service-role admin client) — and composes it into
// a data-driven `sections` prop so ProfileView stays presentational.
//
// Under AGENT_PREVIEW=1 the layout bypasses auth, so `user` can be null
// here. We do not redirect (this route must render standalone in preview);
// ProfileView renders "Not signed in" placeholders for that case.

function verificationLabel(status: string | null): string {
  switch (status) {
    case 'approved':
      return 'Approved'
    case 'rejected':
      return 'Rejected'
    case 'pending_reverification':
      return 'Reverify needed'
    case 'pending':
      return 'Pending'
    default:
      return 'Pending'
  }
}

export default async function ProfileTab() {
  const sb = await getAuthClient()
  const {
    data: { user },
  } = await sb.auth.getUser()

  let email: string | null = null
  let name: string | null = null
  let planTier = 'free'
  let verification: { status: string | null; university_name: string | null } | null = null
  let referrals = { direct: 0, indirect: 0 }

  if (user?.email) {
    email = user.email.toLowerCase()
    const admin = getServerClient()

    // Same three tables, same filter columns as dashboard/profile — just a
    // narrower column selection since this surface shows less detail.
    const [waitlistRes, profileRes, verifRes] = await Promise.all([
      admin
        .from('waitlist')
        .select('plan_tier, direct_referrals, indirect_referrals')
        .eq('email', email)
        .maybeSingle(),
      admin
        .from('user_profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle(),
      admin
        .from('student_verification')
        .select('status, university_name')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    planTier = waitlistRes.data?.plan_tier ?? 'free'
    name = profileRes.data?.display_name ?? null
    verification = verifRes.data ?? null
    referrals = {
      direct: waitlistRes.data?.direct_referrals ?? 0,
      indirect: waitlistRes.data?.indirect_referrals ?? 0,
    }
  }

  const planLabel = planTier.charAt(0).toUpperCase() + planTier.slice(1)

  const sections: ProfileSection[] = [
    {
      title: 'Your plan',
      note: 'Agent balance and trades are demo data until live trading opens.',
      rows: [
        {
          icon: '💳',
          iconBg: '#4EA8FF',
          label: `${planLabel} plan`,
          sub: 'Manage billing, upgrade, or cancel',
          href: '/dashboard/billing',
          action: 'Manage',
        },
      ],
    },
    {
      title: 'Trading venues',
      rows: [
        {
          icon: VENUE_META.kalshi.abbr,
          iconBg: VENUE_META.kalshi.bg,
          label: VENUE_META.kalshi.label,
          statusText: 'Connected · live prices',
          statusColor: '#2FD37A',
        },
        {
          icon: VENUE_META.polymarket.abbr,
          iconBg: VENUE_META.polymarket.bg,
          label: VENUE_META.polymarket.label,
          statusText: 'Connected · live prices',
          statusColor: '#2FD37A',
        },
        {
          icon: VENUE_META.prophetx.abbr,
          iconBg: VENUE_META.prophetx.bg,
          label: VENUE_META.prophetx.label,
          statusText: 'Available',
          statusColor: '#98A2A8',
          action: 'Soon',
        },
        {
          icon: '🔌',
          iconBg: '#a97dff',
          label: 'All connections (44 venues)',
          sub: 'Every platform Sneakers covers',
          href: '/dashboard/connections',
          action: 'Open',
        },
      ],
    },
    {
      title: 'Trading controls',
      rows: [
        { icon: '⚙️', iconBg: '#5c6570', label: 'Master switch & autotrade', href: '/dashboard/legacy' },
        { icon: '👛', iconBg: '#2FD37A', label: 'Wallet & execution', href: '/dashboard/settings/autotrade' },
        { icon: '📈', iconBg: '#4EA8FF', label: 'Strategies', href: '/dashboard/strategies' },
        { icon: '🔔', iconBg: '#e8c25a', label: 'Alerts', href: '/dashboard/alerts' },
      ],
    },
    {
      title: 'AI',
      rows: [
        { icon: '🤖', iconBg: '#7de0d6', label: "O'Toole co-pilot", href: '/dashboard/settings/otoole' },
        { icon: '🔑', iconBg: '#98A2A8', label: 'API keys', href: '/dashboard/settings/api-keys' },
      ],
    },
    {
      title: 'Student',
      rows: [
        {
          icon: '🎓',
          iconBg: '#e3c56b',
          label: 'Verification',
          statusText: verification
            ? verificationLabel(verification.status) +
              (verification.university_name ? ` · ${verification.university_name}` : '')
            : 'Not submitted',
          statusColor: verification?.status === 'approved' ? '#2FD37A' : verification ? '#e8c25a' : '#98A2A8',
        },
        ...(email
          ? [
              {
                icon: '👥',
                iconBg: '#8fb0ff',
                label: 'Referrals',
                statusText: `${referrals.direct} direct · ${referrals.indirect} indirect`,
                statusColor: '#98A2A8',
              },
            ]
          : []),
        {
          icon: '📇',
          iconBg: '#d98fff',
          label: 'Classic profile',
          sub: 'Full account page with avatar & captain tools',
          href: '/dashboard/profile',
          action: 'Open',
        },
      ],
    },
  ]

  return <ProfileView email={email} name={name} sections={sections} />
}
