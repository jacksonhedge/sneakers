import Link from 'next/link'
import { FooterNewsletter } from './footer-newsletter'

// Add a real URL to surface a social icon in the footer. Empty href = hidden,
// so we don't ship dead links to cold visitors. When you fill one in, drop
// the empty string for the actual URL — no other code changes needed.
const SOCIAL_LINKS: Array<{ name: string; href: string; icon: React.ReactNode }> = [
  {
    name: 'X',
    href: '',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    name: 'Instagram',
    href: '',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
        <path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.5 1s.8.9 1 1.5c.1.4.3 1 .4 2.2.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-1 1.5s-.9.8-1.5 1c-.4.1-1 .3-2.2.4-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.3-2.2-.4-.6-.2-1-.5-1.5-1s-.8-.9-1-1.5c-.1-.4-.3-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.3-1.8.4-2.2.2-.6.5-1 1-1.5s.9-.8 1.5-1c.4-.1 1-.3 2.2-.4C8.4 2.2 8.8 2.2 12 2.2M12 0C8.7 0 8.3 0 7.1.1 5.8.1 5 .3 4.2.6c-.8.3-1.5.7-2.2 1.4C1.3 2.7.9 3.4.6 4.2.3 5 .1 5.8.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.1 1.3.3 2.1.6 2.9.3.8.7 1.5 1.4 2.2.7.7 1.4 1.1 2.2 1.4.8.3 1.6.5 2.9.6 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c1.3-.1 2.1-.3 2.9-.6.8-.3 1.5-.7 2.2-1.4.7-.7 1.1-1.4 1.4-2.2.3-.8.5-1.6.6-2.9.1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.1-1.3-.3-2.1-.6-2.9-.3-.8-.7-1.5-1.4-2.2-.7-.7-1.4-1.1-2.2-1.4-.8-.3-1.6-.5-2.9-.6C15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 100 12.4 6.2 6.2 0 000-12.4zm0 10.2a4 4 0 110-8 4 4 0 010 8zm6.4-11.8a1.4 1.4 0 100 2.9 1.4 1.4 0 000-2.9z" />
      </svg>
    ),
  },
  {
    name: 'TikTok',
    href: '',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005.8 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1.84-.1z" />
      </svg>
    ),
  },
  {
    name: 'Discord',
    href: '',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0189 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
      </svg>
    ),
  },
]

export function Footer() {
  const year = new Date().getFullYear()
  const liveSocials = SOCIAL_LINKS.filter((s) => s.href)

  const productLinks = [
    { label: 'Markets', href: '/markets' },
    { label: 'Venues', href: '/venues' },
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Pricing', href: '/pricing' },
  ]
  const companyLinks = [
    { label: 'Students — 75% off', href: '/students' },
    { label: 'College', href: '/college' },
    { label: 'Hardware', href: '/hardware' },
    { label: 'Sign in', href: '/login' },
  ]

  return (
    <footer className="z-10 relative px-4 sm:px-6 lg:px-8 pb-6">
      <div className="max-w-6xl mx-auto rounded-2xl bg-[var(--footer-bg)] border border-blue-900/10 overflow-hidden">
        {/* Top: brand + link columns + newsletter */}
        <div className="px-6 sm:px-10 pt-12 pb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="lg:pr-6">
            <div className="font-display text-2xl tracking-tight text-blue-900">
              Sneakers Terminal
            </div>
            <p className="text-sm text-blue-900/60 mt-3 leading-relaxed max-w-xs">
              A trading terminal for prediction markets — built for college students and recent grads.
            </p>
            <a
              href="mailto:hello@sneakersterminal.com"
              className="inline-block text-sm text-blue-700 hover:text-blue-900 transition mt-4"
            >
              hello@sneakersterminal.com
            </a>
          </div>

          {/* Product */}
          <div>
            <div className="text-xs font-semibold tracking-[0.15em] text-blue-900/50 uppercase">
              Product
            </div>
            <ul className="mt-4 space-y-3">
              {productLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-blue-900/70 hover:text-blue-700 transition">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <div className="text-xs font-semibold tracking-[0.15em] text-blue-900/50 uppercase">
              Company
            </div>
            <ul className="mt-4 space-y-3">
              {companyLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-blue-900/70 hover:text-blue-700 transition">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <div className="text-xs font-semibold tracking-[0.15em] text-blue-900/50 uppercase">
              Newsletter
            </div>
            <p className="text-sm text-blue-900/60 mt-4 mb-3 leading-relaxed">
              Get market drops, invites &amp; early access.
            </p>
            <FooterNewsletter />
          </div>
        </div>

        {/* Illustration band — filled in Task 7 */}
        <div data-footer-illustration className="px-6 sm:px-10" />

        {/* Bottom bar */}
        <div className="border-t border-blue-900/10 px-6 sm:px-10 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {liveSocials.map((s) => (
              <a
                key={s.name}
                href={s.href}
                aria-label={s.name}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 flex items-center justify-center rounded-md border border-blue-900/15 text-blue-900/60 hover:text-blue-600 hover:border-blue-600/40 transition"
              >
                {s.icon}
              </a>
            ))}
          </div>
          <div className="text-xs text-blue-900/50 text-center sm:text-right">
            <div>© {year} Sneakers Terminal · Not a registered investment advisor. Educational use only.</div>
            <div className="mt-1">
              Trading prediction markets involves substantial risk of loss.
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
