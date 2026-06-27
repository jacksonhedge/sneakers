import Link from 'next/link'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { getServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

type WaitlistRow = {
  created_at: string
  invite_code: string | null
  invited_at: string | null
  invite_used_at: string | null
  referred_by_code: string | null
  plan_tier: string | null
  account_type: string | null
}

type StudentRow = { status: string; submitted_at: string }

type EnterpriseRow = {
  id: string
  created_at: string
  contact_name: string
  company_name: string | null
  status: string
  quoted_amount_usd: number | null
  hardware_interest: boolean | null
  hardware_form_factor: string | null
}

function countInRange(rows: { created_at: string }[], sinceHours: number) {
  const cutoff = Date.now() - sinceHours * 3600 * 1000
  return rows.filter((r) => {
    const v = r.created_at
    return typeof v === 'string' && new Date(v).getTime() >= cutoff
  }).length
}

function sparkline(rows: { created_at: string }[], days: number) {
  const buckets = new Array(days).fill(0)
  const now = Date.now()
  for (const r of rows) {
    const v = r.created_at
    if (typeof v !== 'string') continue
    const ts = new Date(v).getTime()
    const diffDays = Math.floor((now - ts) / (24 * 3600 * 1000))
    if (diffDays >= 0 && diffDays < days) {
      buckets[days - 1 - diffDays] += 1
    }
  }
  return buckets
}

function Bar({ value, max }: { value: number; max: number }) {
  const h = max === 0 ? 0 : Math.max(2, Math.round((value / max) * 48))
  return (
    <div className="flex flex-col items-center justify-end gap-1 flex-1 min-w-0">
      <div className="text-[9px] text-stone-500 tabular-nums">{value || ''}</div>
      <div
        className="w-full bg-gradient-to-t from-[#004225] to-[#00703c] rounded-t"
        style={{ height: `${h}px` }}
      />
    </div>
  )
}

async function safeSelect<T>(
  fn: () => Promise<{ data: T | null; error: unknown }>,
): Promise<T | null> {
  try {
    const { data, error } = await fn()
    if (error) return null
    return data
  } catch {
    return null
  }
}

async function loadScraperSummary(): Promise<{
  platforms: number
  rowsToday: number
  quotaRemaining: number | null
}> {
  const candidates = [
    path.join(process.cwd(), '..', 'trader', 'data'),
    path.join(process.cwd(), 'apps', 'trader', 'data'),
  ]
  let dataDir: string | null = null
  for (const d of candidates) {
    try {
      await fs.access(d)
      dataDir = d
      break
    } catch {}
  }
  if (!dataDir) return { platforms: 0, rowsToday: 0, quotaRemaining: null }

  const entries = await fs.readdir(dataDir, { withFileTypes: true }).catch(() => [])
  const platforms = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
    .map((e) => e.name)

  let platformsWithData = 0
  let rowsToday = 0
  for (const p of platforms) {
    const files = await fs.readdir(path.join(dataDir, p)).catch(() => [])
    const jsonl = files.filter((f) => f.endsWith('.jsonl')).sort()
    if (jsonl.length === 0) continue
    platformsWithData++
    const latest = path.join(dataDir, p, jsonl[jsonl.length - 1])
    const text = await fs.readFile(latest, 'utf8').catch(() => '')
    rowsToday += text ? text.split('\n').filter(Boolean).length : 0
  }

  let quotaRemaining: number | null = null
  const quotaFile = path.join(dataDir, 'oddsapi', '.quota.jsonl')
  try {
    const text = await fs.readFile(quotaFile, 'utf8')
    const lines = text.split('\n').filter(Boolean)
    if (lines.length > 0) {
      const last = JSON.parse(lines[lines.length - 1]) as { remaining?: number }
      if (typeof last.remaining === 'number') quotaRemaining = last.remaining
    }
  } catch {}

  return { platforms: platformsWithData, rowsToday, quotaRemaining }
}

export default async function AdminOverview() {
  const admin = getServerClient()

  const { loadScraperHealth, statusFor } = await import('@/lib/scraper-health')

  const [waitlistRows, studentRows, enterpriseRows, scraperSummary, scraperHealth] =
    await Promise.all([
      safeSelect<WaitlistRow[]>(async () =>
        admin
          .from('waitlist')
          .select('created_at, invite_code, invited_at, invite_used_at, referred_by_code, plan_tier, account_type')
          .order('created_at', { ascending: false }),
      ),
      safeSelect<StudentRow[]>(async () =>
        admin.from('student_verification').select('status, submitted_at'),
      ),
      safeSelect<EnterpriseRow[]>(async () =>
        admin
          .from('enterprise_inquiries')
          .select('id, created_at, contact_name, company_name, status, quoted_amount_usd, hardware_interest, hardware_form_factor')
          .order('created_at', { ascending: false }),
      ),
      loadScraperSummary(),
      loadScraperHealth(),
    ])

  if (!waitlistRows) {
    return (
      <div className="border border-red-400 bg-red-50 p-4 text-sm text-red-800">
        Failed to load waitlist — check Supabase connection + service role key.
      </div>
    )
  }

  // --- Waitlist headline stats ---
  // The three buckets are mutually exclusive so they sum to `total`:
  //   waitlistOnly = no invite_code yet
  //   invited      = has unburned invite_code (waiting to use)
  //   authed       = invite_used_at is set (burned + signed up)
  // Previously `invited` also counted authed rows (anyone with a code, used
  // or not), so the home tiles double-counted and didn't match /invites.
  const total = waitlistRows.length
  const authed = waitlistRows.filter((r) => r.invite_used_at).length
  const invited = waitlistRows.filter((r) => r.invite_code && !r.invite_used_at).length
  const waitlistOnly = total - invited - authed
  const last24 = countInRange(waitlistRows, 24)
  const last7d = countInRange(waitlistRows, 24 * 7)
  const paidTier = waitlistRows.filter((r) => r.plan_tier && r.plan_tier !== 'free').length
  const businessAccounts = waitlistRows.filter((r) => r.account_type === 'business').length
  const invitePending = invited

  const spark = sparkline(waitlistRows, 30)
  const sparkMax = Math.max(...spark, 1)

  // --- Students ---
  const studentCounts = { pending: 0, approved: 0, rejected: 0 }
  if (studentRows) {
    for (const r of studentRows) {
      if (r.status in studentCounts) studentCounts[r.status as keyof typeof studentCounts]++
    }
  }

  // --- Enterprise ---
  const enterprise = enterpriseRows ?? []
  const enterpriseCounts = {
    new: 0,
    contacted: 0,
    qualified: 0,
    negotiating: 0,
    won: 0,
    lost: 0,
  }
  for (const r of enterprise) {
    if (r.status in enterpriseCounts) enterpriseCounts[r.status as keyof typeof enterpriseCounts]++
  }
  const hardwareRequests = enterprise.filter((r) => r.hardware_interest === true)
  const openPipeline = enterprise.filter(
    (r) => r.status !== 'won' && r.status !== 'lost',
  )
  const pipelineValue = openPipeline.reduce((a, r) => a + (r.quoted_amount_usd ?? 0), 0)
  const wonTotal = enterprise
    .filter((r) => r.status === 'won')
    .reduce((a, r) => a + (r.quoted_amount_usd ?? 0), 0)

  return (
    <div className="space-y-10">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-stone-900">
            Admin overview
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Top-line state of waitlist, scrapers, students, and enterprise pipeline.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          LIVE
        </span>
      </header>

      {/* Scraper health — big boxes per platform, freshest first */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-stone-900 tracking-tight">
            Scraper health
          </h2>
          <Link
            href="/scrapers"
            className="text-[11px] text-[#00703c] hover:text-[#004225] hover:underline tracking-wider"
          >
            full status →
          </Link>
        </div>
        {scraperHealth.length === 0 ? (
          <div className="border border-amber-300 bg-amber-50 rounded-xl p-6 text-sm text-amber-900">
            No scraper writes detected. Either the database is unreachable from
            the admin app, or no scrapers have run recently.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {scraperHealth.map((h) => {
              const status = statusFor(h)
              const accentTop = {
                live: 'before:bg-emerald-500',
                lagging: 'before:bg-amber-500',
                stale: 'before:bg-orange-500',
                dead: 'before:bg-red-500',
              }[status]
              const dotCls = {
                live: 'bg-emerald-500 animate-pulse',
                lagging: 'bg-amber-500 animate-pulse',
                stale: 'bg-orange-500',
                dead: 'bg-red-500',
              }[status]
              const statusText = {
                live: 'text-emerald-700',
                lagging: 'text-amber-700',
                stale: 'text-orange-700',
                dead: 'text-red-700',
              }[status]
              const ageLabel =
                h.ageMinutes == null
                  ? 'never'
                  : h.ageMinutes < 1
                    ? 'just now'
                    : h.ageMinutes < 60
                      ? `${Math.round(h.ageMinutes)}m ago`
                      : h.ageMinutes < 1440
                        ? `${(h.ageMinutes / 60).toFixed(1)}h ago`
                        : `${Math.floor(h.ageMinutes / 1440)}d ago`
              return (
                <div
                  key={h.platform}
                  className={`relative bg-white rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition p-5 overflow-hidden before:absolute before:top-0 before:left-0 before:right-0 before:h-1 ${accentTop}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${dotCls}`}
                        aria-hidden
                      />
                      <span
                        className={`text-[10px] tracking-wider font-bold uppercase ${statusText}`}
                      >
                        {status}
                      </span>
                    </div>
                    <span className="text-[10px] text-stone-400 font-mono">{ageLabel}</span>
                  </div>
                  <div className="text-sm font-semibold text-stone-900 capitalize mb-3 truncate">
                    {h.platform.replace(/_/g, ' ')}
                  </div>
                  <div className="text-[28px] font-bold text-stone-900 tabular-nums leading-tight">
                    {h.rowsLast24h.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-stone-500">rows · last 24h</div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Row 1: core waitlist metrics. The first three are mutually exclusive
          and sum to the total — clarified labels so it's obvious. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Waitlist total" value={total.toLocaleString()} hint={`${waitlistOnly} on waitlist · ${invited} invited · ${authed} authed`} />
        <StatCard label="Invited (unused)" value={invited.toLocaleString()} hint="Has invite code, hasn't signed up" />
        <StatCard label="Authenticated" value={authed.toLocaleString()} hint={`${total > 0 ? ((authed / total) * 100).toFixed(1) : '0'}% of total`} />
        <StatCard label="Paid tier" value={paidTier.toLocaleString()} hint={`${businessAccounts} business accounts`} />
      </div>

      {/* Row 2: velocity */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Last 24h signups" value={last24.toLocaleString()} />
        <StatCard label="Last 7d signups" value={last7d.toLocaleString()} />
        <StatCard label="Invites pending" value={invitePending.toLocaleString()} hint="Issued, not yet used" />
        <StatCard
          label="Odds API quota"
          value={scraperSummary.quotaRemaining?.toLocaleString() ?? '—'}
          hint={scraperSummary.quotaRemaining == null ? 'No runs logged' : 'Credits left this month'}
          accent={
            scraperSummary.quotaRemaining != null && scraperSummary.quotaRemaining < 50
              ? 'amber'
              : 'default'
          }
        />
      </div>

      {/* Enterprise — Hardware + Pipeline (prominent because hardware is real money) */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-stone-900 tracking-tight">
          Enterprise pipeline
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-5 md:col-span-2">
            <div className="flex items-baseline justify-between mb-4">
              <div className="text-[11px] text-stone-500 tracking-wider font-semibold">
                STATUS BREAKDOWN
              </div>
              <Link
                href="/enterprise"
                className="text-[11px] text-emerald-700 hover:text-emerald-800 hover:underline tracking-wider"
              >
                view all →
              </Link>
            </div>
            <div className="grid grid-cols-6 gap-2 text-center">
              {(Object.keys(enterpriseCounts) as Array<keyof typeof enterpriseCounts>).map((k) => (
                <div key={k} className="rounded-lg py-2 hover:bg-stone-50 transition">
                  <div className="text-xl font-bold text-stone-900 tabular-nums">
                    {enterpriseCounts[k]}
                  </div>
                  <div className="text-[9px] text-stone-500 tracking-wider uppercase mt-0.5">
                    {k}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-stone-100 flex items-baseline justify-between text-xs">
              <span className="text-stone-600">
                Open pipeline:{' '}
                <span className="text-stone-900 font-bold tabular-nums">
                  ${pipelineValue.toLocaleString()}
                </span>
              </span>
              <span className="text-stone-600">
                Closed-won:{' '}
                <span className="text-emerald-700 font-bold tabular-nums">
                  ${wonTotal.toLocaleString()}
                </span>
              </span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 border border-emerald-200 rounded-xl shadow-sm p-5">
            <div className="text-[11px] text-emerald-800 tracking-wider font-semibold mb-2">
              HARDWARE REQUESTS
            </div>
            <div className="text-3xl font-bold text-emerald-900 tabular-nums">
              {hardwareRequests.length}
            </div>
            <div className="text-[11px] text-emerald-800/70 mt-1 leading-snug">
              Prospects asking for Mac Studio / MacBook Pro bundles
            </div>
            {hardwareRequests.length > 0 && (
              <div className="mt-3 pt-3 border-t border-emerald-200/60 text-[11px] text-emerald-900 space-y-1">
                {(() => {
                  const byFactor: Record<string, number> = {}
                  for (const r of hardwareRequests) {
                    const k = r.hardware_form_factor ?? 'unspecified'
                    byFactor[k] = (byFactor[k] ?? 0) + 1
                  }
                  return Object.entries(byFactor).map(([k, n]) => (
                    <div key={k} className="flex justify-between">
                      <span className="capitalize">{k.replace('_', ' ')}</span>
                      <span className="tabular-nums font-semibold">{n}</span>
                    </div>
                  ))
                })()}
              </div>
            )}
            {hardwareRequests.length === 0 && enterprise.length === 0 && (
              <div className="text-[11px] text-emerald-800/60 mt-3 leading-snug">
                Awaiting first inquiry. Form at /pricing → Contact Sales.
              </div>
            )}
          </div>
        </div>

        {hardwareRequests.length > 0 && (
          <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-stone-100 text-[11px] text-stone-500 tracking-wider font-semibold">
              RECENT HARDWARE REQUESTS
            </div>
            <div className="divide-y divide-stone-100">
              {hardwareRequests.slice(0, 5).map((r) => (
                <Link
                  key={r.id}
                  href="/enterprise"
                  className="px-4 py-3 flex items-center justify-between hover:bg-stone-50 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-stone-900">
                      {r.company_name ?? r.contact_name}
                      <span className="text-[10px] text-stone-400 tracking-wider ml-2">
                        {(r.hardware_form_factor ?? 'unspecified').replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {r.quoted_amount_usd != null && (
                        <span className="ml-2 text-stone-700 font-mono">
                          ${r.quoted_amount_usd.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] text-stone-600 tracking-wider uppercase px-2 py-0.5 rounded-full bg-stone-100">
                    {r.status}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Per-surface status cards */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-stone-900 tracking-tight">By surface</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <SurfaceCard
            href="/users"
            title="Users"
            metrics={[
              { label: 'waitlist', value: total },
              { label: 'authed', value: authed },
              { label: 'business', value: businessAccounts },
            ]}
          />
          <SurfaceCard
            href="/invites"
            title="Invites"
            metrics={[
              { label: 'issued', value: invited },
              { label: 'used', value: authed },
              { label: 'pending', value: invitePending },
            ]}
          />
          <SurfaceCard
            href="/students"
            title="Students"
            metrics={[
              { label: 'pending', value: studentCounts.pending, highlight: studentCounts.pending > 0 },
              { label: 'approved', value: studentCounts.approved },
              { label: 'rejected', value: studentCounts.rejected },
            ]}
            hint={studentRows ? undefined : 'Table not migrated yet'}
          />
          <SurfaceCard
            href="/enterprise"
            title="Enterprise"
            metrics={[
              { label: 'inquiries', value: enterprise.length },
              { label: 'in progress', value: openPipeline.length },
              { label: 'hardware', value: hardwareRequests.length, highlight: hardwareRequests.length > 0 },
            ]}
            hint={enterpriseRows ? undefined : 'Table not migrated yet'}
          />
          <SurfaceCard
            href="/scrapers"
            title="Scrapers"
            metrics={[
              { label: 'platforms', value: scraperSummary.platforms },
              { label: 'rows today', value: scraperSummary.rowsToday },
              { label: 'quota left', value: scraperSummary.quotaRemaining ?? 0 },
            ]}
          />
          <SurfaceCard
            href="/alerts"
            title="Alerts"
            pending
            briefRef="HANDOFF_NOTIFICATIONS.md"
          />
          <SurfaceCard
            href="/autotrade"
            title="AutoTrade"
            pending
            briefRef="HANDOFF_AUTOTRADE.md"
          />
          <SurfaceCard
            href="/otoole"
            title="O'Toole AI"
            pending
            briefRef="HANDOFF_STRIPE_SUBSCRIPTIONS.md (8e)"
          />
        </div>
      </section>

      {/* Signup velocity */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-stone-900 tracking-tight">
            Signup velocity
          </h2>
          <span className="text-[11px] text-stone-500">last 30 days</span>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-5">
          <div className="flex items-end gap-1 h-16">
            {spark.map((v, i) => (
              <Bar key={i} value={v} max={sparkMax} />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-stone-400 mt-2">
            <span>30d ago</span>
            <span>today</span>
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-stone-900 tracking-tight">Quick actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link
            href="/users"
            className="group bg-white border border-stone-200 rounded-xl shadow-sm hover:shadow-md hover:border-stone-300 p-5 transition"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-stone-900">Users</div>
              <span className="text-stone-400 group-hover:text-[#00703c] group-hover:translate-x-0.5 transition-all">
                →
              </span>
            </div>
            <div className="text-xs text-stone-500 mt-1.5">
              Search, view referral trees, manage invites
            </div>
          </Link>
          <Link
            href="/invites"
            className="group bg-white border border-stone-200 rounded-xl shadow-sm hover:shadow-md hover:border-stone-300 p-5 transition"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-stone-900">Issue invites</div>
              <span className="text-stone-400 group-hover:text-[#00703c] group-hover:translate-x-0.5 transition-all">
                →
              </span>
            </div>
            <div className="text-xs text-stone-500 mt-1.5">
              Unblock the 100-testers recruitment push
            </div>
          </Link>
          <Link
            href="/analytics"
            className="group bg-white border border-stone-200 rounded-xl shadow-sm hover:shadow-md hover:border-stone-300 p-5 transition"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-stone-900">Analytics</div>
              <span className="text-stone-400 group-hover:text-[#00703c] group-hover:translate-x-0.5 transition-all">
                →
              </span>
            </div>
            <div className="text-xs text-stone-500 mt-1.5">
              Funnel, top referrers, geo, cohort
            </div>
          </Link>
        </div>
      </section>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  accent = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  accent?: 'default' | 'amber'
}) {
  const cls =
    accent === 'amber'
      ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/40'
      : 'border-stone-200 bg-white'
  return (
    <div
      className={`border ${cls} rounded-xl shadow-sm p-4 hover:shadow-md transition`}
    >
      <div className="text-[10px] text-stone-500 tracking-wider mb-1.5 font-semibold">
        {label.toUpperCase()}
      </div>
      <div
        className={`text-2xl font-bold tabular-nums ${
          accent === 'amber' ? 'text-amber-800' : 'text-stone-900'
        }`}
      >
        {value}
      </div>
      {hint && <div className="text-[10px] text-stone-500 mt-1.5 leading-snug">{hint}</div>}
    </div>
  )
}

function SurfaceCard({
  href,
  title,
  metrics,
  hint,
  pending,
  briefRef,
}: {
  href: string
  title: string
  metrics?: Array<{ label: string; value: number; highlight?: boolean }>
  hint?: string
  pending?: boolean
  briefRef?: string
}) {
  return (
    <Link
      href={href}
      className={`group block rounded-xl border shadow-sm hover:shadow-md transition p-5 ${
        pending
          ? 'border-stone-200 bg-stone-50/40 hover:bg-stone-50'
          : 'border-stone-200 bg-white hover:border-stone-300'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-stone-900">{title}</div>
          {pending && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 tracking-wider">
              WIP
            </span>
          )}
        </div>
        <span className="text-stone-400 group-hover:text-[#00703c] group-hover:translate-x-0.5 transition-all">
          →
        </span>
      </div>
      {pending ? (
        <div className="text-[11px] text-stone-500 leading-snug">
          Scaffolded. Implemented in{' '}
          <code className="bg-stone-100 px-1 py-0.5 rounded text-[10px]">{briefRef}</code>.
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-3 gap-2">
          {metrics.map((m) => (
            <div key={m.label}>
              <div
                className={`text-lg font-bold tabular-nums ${
                  m.highlight ? 'text-amber-700' : 'text-stone-900'
                }`}
              >
                {m.value.toLocaleString()}
              </div>
              <div className="text-[9px] text-stone-500 tracking-wider uppercase mt-0.5">
                {m.label}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {hint && <div className="text-[10px] text-amber-700 mt-2">{hint}</div>}
    </Link>
  )
}
