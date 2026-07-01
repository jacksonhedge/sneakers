import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getAuthClient } from '@/lib/supabase-auth'
import { AuthShell } from '../(auth)/auth-shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Join — Sneakers Terminal',
}

// Minimal fallback that matches the shell's canvas colour to prevent a
// white flash while the client bundle hydrates useSearchParams() in the panels.
function ShellFallback() {
  return <div className="min-h-screen bg-[#0b0d13]" />
}

export default async function JoinPage() {
  const supabase = await getAuthClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user && user.email) redirect('/dashboard')

  return (
    // AuthShell's panels call useSearchParams() (client-side), so we must
    // wrap in a Suspense boundary to satisfy Next.js 16's static analysis.
    <Suspense fallback={<ShellFallback />}>
      <AuthShell entry="signup" />
    </Suspense>
  )
}
