import { TerminalLoadingSplash } from '@/components/terminal-loading-splash'

// Dedicated loading slot for /dashboard/markets (the listing page).
// Without this file, the route falls through to the parent
// /dashboard/loading.tsx — which works, but this local file ensures the
// Suspense boundary wraps exactly this segment's data fetch (loadMarketsPage)
// and not the entire dashboard layout.
export default function DashboardMarketsLoading() {
  return <TerminalLoadingSplash />
}
