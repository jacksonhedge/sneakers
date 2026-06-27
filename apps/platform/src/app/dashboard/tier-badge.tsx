import Link from 'next/link'

// Small tier pill — gives the user constant-visible signal of their plan
// state without burying it in /dashboard/billing. Click → billing page.
// Free is muted so it doesn't compete visually; paid tiers earn the
// emerald/gold/navy accents. Hidden on mobile (handled inline via Tailwind).
//
// Lives in its own file so Turbopack HMR can re-evaluate it cleanly —
// previously co-located with DashboardTopbarV2, which produced
// transient `TierBadge is not defined` ReferenceErrors during hot
// reloads when only one of the two had re-bound.

export function TierBadge({ tier }: { tier?: string }) {
  const t = (tier ?? 'free').toLowerCase()
  const variant: { label: string; cls: string; href: string } =
    t === 'business' || t === 'fraternity'
      ? {
          label: t === 'fraternity' ? 'FRAT' : 'BUSINESS',
          cls: 'bg-stone-900 text-stone-100 ring-stone-900',
          href: '/dashboard/billing',
        }
      : t === 'elite'
        ? {
            label: 'ELITE',
            cls: 'bg-amber-50 text-amber-900 ring-amber-300',
            href: '/dashboard/billing',
          }
        : t === 'pro'
          ? {
              label: 'PRO',
              cls: 'bg-emerald-50 text-emerald-800 ring-emerald-300',
              href: '/dashboard/billing',
            }
          : {
              label: 'FREE · UPGRADE',
              cls: 'bg-stone-50 text-stone-600 ring-stone-200 hover:bg-stone-100 hover:text-stone-900',
              href: '/pricing',
            }
  return (
    <Link
      href={variant.href}
      prefetch={false}
      className={`hidden md:inline-flex items-center text-[10px] font-semibold tracking-[0.12em] px-2 py-0.5 rounded ring-1 transition ${variant.cls}`}
      title={`Plan: ${variant.label}`}
    >
      {variant.label}
    </Link>
  )
}
