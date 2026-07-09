import { redirect } from 'next/navigation'

// The app IS the dashboard now (spec: 2026-07-08-app-first-redesign.md).
// The classic home lives at /dashboard/legacy until its remaining jobs
// (master switch, autotrade panel) are absorbed into the app.
export default function DashboardHome() {
  redirect('/agent')
}
