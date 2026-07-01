/**
 * Shared auth redirect resolver.
 *
 * Logic copied verbatim from src/app/login/email-form.tsx (lines 70-84).
 * That file is the source of truth — keep in sync if it changes.
 *
 * Rules:
 *  1. Honor ?next= if present and safe (relative path starting with '/',
 *     not starting with '//', no backslash — prevents open-redirect attacks).
 *  2. Otherwise use a host-aware fallback:
 *       admin.* / app.* → '/'   (proxy rewrites to the subdomain root)
 *       apex / everything else  → '/dashboard'
 */
export function resolveAuthRedirect(
  searchParams: URLSearchParams | null,
  host: string,
): string {
  const nextRaw = searchParams?.get('next') ?? ''
  const safeNext =
    nextRaw.startsWith('/') && !nextRaw.startsWith('//') && !nextRaw.includes('\\')
      ? nextRaw
      : ''
  const normalizedHost = host.toLowerCase()
  const fallback =
    normalizedHost.startsWith('admin.') || normalizedHost.startsWith('app.')
      ? '/'
      : '/dashboard'
  return safeNext || fallback
}
