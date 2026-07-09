'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function AutoRefresh({ everyMs = 30_000 }: { everyMs?: number }) {
  const router = useRouter()
  useEffect(() => {
    if (typeof document === 'undefined') return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, everyMs)
    return () => clearInterval(id)
  }, [router, everyMs])
  return null
}
