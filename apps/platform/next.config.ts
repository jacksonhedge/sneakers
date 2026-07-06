import type { NextConfig } from 'next'

// Security headers applied to every response. Closes audit LOW #5
// (no CSP / HSTS / clickjacking defense).
//
// CSP notes:
//   - script-src + style-src include 'unsafe-inline' / 'unsafe-eval' because
//     Next 16 + Tailwind emit inline scripts (hydration bootstrap) and inline
//     styles. Tightening to a nonce-based policy is a follow-up — would need
//     middleware to set a per-request nonce and the framework to honor it.
//   - connect-src is broad ('self' + https: + wss:) so Supabase realtime,
//     Stripe checkout redirect, and any Vercel-hosted backend calls just work.
//   - frame-ancestors 'none' blocks clickjacking. Combined with the legacy
//     X-Frame-Options: DENY this works across browser versions.
//   - form-action 'self' stops a phishing site from POSTing forms to our
//     domain to harvest sessions cross-origin.
//   - script-src allows https://js.stripe.com and frame-src allows
//     https://js.stripe.com + https://hooks.stripe.com because Stripe
//     Financial Connections (the round-up portal's bank-link flow) needs to
//     load Stripe.js and its embedded iframe. Without frame-src this would
//     fall back to default-src 'self', which blocks the iframe outright.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  // upgrade-insecure-requests breaks plain-http dev access (e.g. LAN IP):
  // every _next chunk gets upgraded to https where nothing listens.
  ...(process.env.NODE_ENV === 'development' ? [] : ['upgrade-insecure-requests']),
].join('; ')

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
]

const nextConfig: NextConfig = {
  // Next's dev server only trusts "localhost" for dev-mode resources (Fast
  // Refresh/HMR) by default -- 127.0.0.1 and other loopback aliases are
  // blocked even though they're the same machine, which silently hangs the
  // app on those origins in dev (no console error, just a stuck client
  // bundle). Only needed for local multi-origin testing (e.g. comparing two
  // isolated cookie sessions side by side); irrelevant in production.
  ...(process.env.NODE_ENV === 'development' ? { allowedDevOrigins: ['127.0.0.1', '[::1]'] } : {}),
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ]
  },
}

export default nextConfig
