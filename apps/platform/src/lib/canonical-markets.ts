/**
 * CanonicalMarket — the top-level entity that collapses per-venue MarketSnapshot
 * rows (same underlying event, priced by multiple books) into one logical
 * "market" for the UI.
 *
 * Two-phase grouping:
 *   Phase 1 — exact normalized-question match. Catches rare cases where two
 *     scrapers happen to emit identical text (e.g., Polymarket + Kalshi for
 *     some prediction-market questions).
 *   Phase 2 — sports signature: (sport, market-type, resolve-date, teams).
 *     Each scraper writes sport markets differently; the signature lets us
 *     collapse "Moneyline — LAL @ BOS" + "LAL vs BOS moneyline" + "Cleveland @
 *     Toronto — Cleveland" into the same canonical row.
 *
 * Anything still ungrouped after Phase 2 is treated as a singleton canonical
 * market. The analyzer in scripts/analyze-canonical-overlap.ts produces
 * histograms so we can tune heuristics against real data.
 */

import { createHash } from 'node:crypto'
import {
  loadAllLatestSnapshots,
  dbRowsToSnapshot,
  type DbRow,
  type MarketSnapshot,
  type MarketSort,
  type MarketPhase,
} from './markets-data'
import { safeQuery } from './db'
import { categoryOf, type TerminalCategory } from './market-stats'
import { canonicalizeTeams, TEAM_LOOKUP, TEAM_PATTERNS } from './team-aliases'

export interface CanonicalMarket {
  id: string // stable signature-derived key
  question: string // display label — first-venue phrasing for now
  category: TerminalCategory
  sport?: string
  marketType?: string // moneyline | spread_X | total_X | futures | prop | ...
  teams?: string[] // normalized team tokens, sorted
  resolveDate?: string // YYYY-MM-DD
  resolves_at?: string // full ISO from first venue
  starts_at?: string
  venueCount: number
  venues: string[] // platform ids participating
  quotes: MarketSnapshot[] // all per-venue snapshots in this group
  groupedBy: 'exact' | 'sport' | 'singleton'
}

export interface GroupingStats {
  totalSnapshots: number
  canonicalCount: number
  singleVenue: number
  twoVenue: number
  threePlus: number
  largestGroup: number
  phase1GroupedSnapshots: number
  phase2GroupedSnapshots: number
  untouchedSingletons: number
}

export interface GroupingResult {
  canonical: CanonicalMarket[]
  stats: GroupingStats
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Stronger normalization that absorbs common phrasing differences across
 * books. Uses the team alias registry (when a sport is known) to replace
 * city-only / city+mascot / mascot-only variants with a single canonical
 * mascot key. Then strips interrogatives, light verb forms, and articles.
 *
 * Goal: "Will the Oklahoma City Thunder win the 2026 NBA Finals?" and
 * "Oklahoma City wins 2026 NBA Finals" both collapse to the same string so
 * Phase 1 groups them without needing Phase 2.
 */
// Precompiled `g` (global) flag patterns for question-level replacement.
// Separate from team-aliases.ts TEAM_PATTERNS (which use `i` flag for
// single-test lookups) because we need `g` to replace every occurrence.
// Built once at module load.
const QUESTION_PATTERNS: Record<string, Array<[RegExp, string]>> = {}
for (const sport of Object.keys(TEAM_PATTERNS)) {
  const entries = [...TEAM_LOOKUP[sport].entries()].sort(
    (a, b) => b[0].length - a[0].length,
  )
  QUESTION_PATTERNS[sport] = entries.map(([alias, canonical]) => [
    new RegExp(`\\b${escapeRegex(alias)}\\b`, 'gi'),
    canonical,
  ])
}

function canonicalQuestion(q: string, sport?: string): string {
  let s = q.toLowerCase()

  const canonSport = normalizeSport(sport)
  if (canonSport && QUESTION_PATTERNS[canonSport]) {
    for (const [pattern, canonical] of QUESTION_PATTERNS[canonSport]) {
      s = s.replace(pattern, canonical)
    }
  }

  // Strip leading interrogative + article
  s = s.replace(/^(will\s+(?:the\s+)?|does\s+(?:the\s+)?|can\s+(?:the\s+)?|is\s+(?:the\s+)?|are\s+(?:the\s+)?)/, '')

  // Light verb normalization: wins/winning → win
  s = s.replace(/\bwins\b/g, 'win').replace(/\bwinning\b/g, 'win')

  // Strip articles everywhere
  s = s.replace(/\b(the|a|an)\s+/g, '')

  // Final alphanumeric collapse
  s = s.replace(/[^a-z0-9]+/g, ' ').trim()

  return s
}

// Sport aliasing so Kalshi's `nba` + OddsAPI's `basketball` produce the same
// signature. Keep conservative — football is intentionally left alone because
// "football" means NFL on OddsAPI but potentially soccer elsewhere.
const SPORT_ALIASES: Record<string, string> = {
  basketball: 'basketball',
  nba: 'basketball',
  wnba: 'basketball',
  ncaab: 'basketball',
  baseball: 'baseball',
  mlb: 'baseball',
  hockey: 'hockey',
  ice_hockey: 'hockey',
  nhl: 'hockey',
  // `football` on OddsAPI means NFL/US football. On some other feeds it
  // means soccer. Keep `soccer` distinct — crossing them would produce
  // false positives (Man City FC ≠ Manchester United ≠ anyone in NFL).
  football: 'football_us',
  nfl: 'football_us',
  ncaaf: 'football_us',
  football_us: 'football_us',
  mma: 'mma',
  ufc: 'mma',
  soccer: 'soccer',
}

function normalizeSport(s: string | undefined): string | null {
  if (!s) return null
  const lower = s.toLowerCase().replace(/\s+/g, '_')
  return SPORT_ALIASES[lower] ?? lower
}

function dateKey(iso: string | undefined): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  return new Date(t).toISOString().slice(0, 10)
}

// Market-type detection. Order matters — more specific patterns first so
// "Spread 14.5 — LAL @ BOS" doesn't get swallowed by the futures fallback.
function detectMarketType(q: string): string | null {
  const lower = q.toLowerCase()

  // OddsAPI-style: "Spread -1.5 —" / "Total 216.5 —"
  // Use absolute value so Kalshi's "wins by over 14.5" (always positive) can
  // match OddsAPI's "Spread -14.5" (sign indicates side). The canonical
  // market is the spread line itself; the sign identifies which side you
  // took, not which market you're in.
  const spread1 = lower.match(/\bspread\s*([+-]?\d+(?:\.\d+)?)/)
  if (spread1) return `spread_${Math.abs(parseFloat(spread1[1]))}`
  const total1 = lower.match(/\btotal\s*([+-]?\d+(?:\.\d+)?)/)
  if (total1) return `total_${Math.abs(parseFloat(total1[1]))}`

  // Kalshi-style one-sided spread: "wins by over 14.5 points?"
  const spread2 = lower.match(/by over (\d+(?:\.\d+)?)/)
  if (spread2) return `spread_${Math.abs(parseFloat(spread2[1]))}`

  // Kalshi-style total mislabeled as "Spread" in the question text:
  //   "Game 3: Denver at Minnesota: Spread — Over 217.5 points scored"
  // Anchor on the `: spread — over|under N` shape specifically so we don't
  // over-match prop-style "over N points" phrases that appear in player
  // markets. Keep this narrow — if the book uses different phrasing, let
  // the snapshot stay ungrouped rather than risk a false canonical merge.
  const total2 = lower.match(/:\s*spread\s*—\s*(?:over|under)\s+(\d+(?:\.\d+)?)\s+(?:points?|runs?|goals?)/)
  if (total2) return `total_${Math.abs(parseFloat(total2[1]))}`

  // NoVig-style: "AL_WINNER", "NL_WINNER", "NBA_CHAMP"
  if (/_winner\b|_champ\b|_mvp\b/.test(lower)) return 'futures'

  // Moneyline
  if (/\bmoneyline\b|\bml\b/.test(lower)) return 'moneyline'

  // Futures / outrights — "wins the X", "championship", "title"
  if (
    /\bwins?\s+(?:the\s+)?\w+\s+(?:finals?|championship|cup|title|open|classic)\b/i.test(q) ||
    /\bwill\s+.+\s+win\b/i.test(q) ||
    /\bchampion\b|\bwinner\b/i.test(q)
  ) {
    return 'futures'
  }

  // Player prop — "<Name> <Stat> <Number>"
  if (/\b\d+\.?\d*\b/.test(q) && /\bfantasy|\bpra\b|\bpoints\b|\bassists\b|\brebounds\b/i.test(q)) {
    return 'prop'
  }

  return null
}

// Tokens that appear in Title Case but aren't team/entity names. Without this
// blocklist the signature collapses unrelated futures into one (e.g., every
// "Will Player X win NBA MVP" Polymarket row gets grouped together because
// the only non-stopword tokens are "Player" and "NBA").
const TEAM_STOPWORDS = new Set([
  'will', 'the', 'win', 'wins', 'winner', 'won',
  'moneyline', 'spread', 'total', 'over', 'under', 'points',
  'player', 'coach', 'rookie', 'mvp', 'champion', 'champ',
  'year', 'yr', 'season', 'final', 'finals', 'cup', 'title',
  'game', 'match', 'tournament', 'championship',
  'eastern', 'western', 'conference', 'division', 'league',
  'most', 'improved', 'sixth', 'man', 'defensive',
  'nba', 'nfl', 'mlb', 'nhl', 'ncaa', 'wnba',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
])

// Extract team/entity tokens from a question. Two-pass:
//   1. If the sport has a team registry (NBA/NFL/MLB/NHL), try alias lookup.
//      This is the authoritative path — "Minnesota" → `timberwolves`,
//      "Minnesota Timberwolves" → `timberwolves`, "Los Angeles Lakers" and
//      "Lakers" both → `lakers`. Handles the biggest class of false-negatives
//      (city-only vs city+mascot strings).
//   2. Fall back to heuristic title-case extraction. Used for sports without
//      a registry (tennis, golf, soccer, prediction-market outrights).
function extractTeams(q: string, sport?: string): string[] {
  const canonicalSport = normalizeSport(sport)

  // Pass 1 — alias registry (authoritative for major US sports)
  if (canonicalSport && TEAM_LOOKUP[canonicalSport]) {
    const hits = canonicalizeTeams(q, canonicalSport)
    if (hits.length > 0) return hits
  }

  // Pass 2 — heuristic title-case extraction
  const raw: string[] = []

  const cleaned = q
    .replace(/^(moneyline|spread\s*[+-]?\d+(?:\.\d+)?|total\s*\d+(?:\.\d+)?)\s*—\s*/i, '')
    .trim()

  const m = cleaned.match(
    /([A-Z][A-Za-z .'-]+?)\s+(?:@|vs\.?|at)\s+([A-Z][A-Za-z .'-]+?)(?:\s*—|\s*$|\s*\?)/i,
  )
  if (m) {
    raw.push(m[1], m[2])
  } else {
    const tokens = cleaned.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{1,})*\b/g) ?? []
    for (const t of tokens) {
      const lt = t.toLowerCase()
      if (TEAM_STOPWORDS.has(lt)) continue
      raw.push(t)
    }
  }

  const normalized = raw
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length >= 2)
    .map((t) => t.replace(/\s+/g, '_'))

  return [...new Set(normalized)].sort()
}

function sportsSignature(s: MarketSnapshot): string | null {
  const sport = normalizeSport(s.sport)
  const date = dateKey(s.resolves_at) ?? dateKey(s.starts_at)
  const marketType = detectMarketType(s.question)
  const teams = extractTeams(s.question, s.sport)

  if (!sport || !date || !marketType || teams.length === 0) return null
  return `${sport}|${marketType}|${date}|${teams.join('+')}`
}

/**
 * Stable short ID per canonical market. Same signature → same ID across
 * runs, so URLs like /dashboard/markets/c_a1b2c3d4e5 remain valid as the
 * scraper data refreshes. 10 hex chars = 40 bits; collisions are not a
 * concern at our volume (<100k canonical markets expected).
 */
function canonicalIdOf(signatureKey: string): string {
  return 'c_' + createHash('sha1').update(signatureKey).digest('hex').slice(0, 10)
}

function toCanonical(
  group: MarketSnapshot[],
  groupedBy: 'exact' | 'sport' | 'singleton',
  signatureKey: string,
): CanonicalMarket {
  const first = group[0]
  const venues = [...new Set(group.map((g) => g.platform))].sort()
  const marketType = detectMarketType(first.question) ?? undefined
  const teams = extractTeams(first.question, first.sport)
  return {
    id: canonicalIdOf(signatureKey),
    question: first.question,
    category: categoryOf(first),
    sport: first.sport,
    marketType,
    teams: teams.length ? teams : undefined,
    resolveDate: dateKey(first.resolves_at) ?? dateKey(first.starts_at) ?? undefined,
    resolves_at: first.resolves_at,
    starts_at: first.starts_at,
    venueCount: venues.length,
    venues,
    quotes: group,
    groupedBy,
  }
}

export function groupIntoCanonical(snapshots: MarketSnapshot[]): GroupingResult {
  // Phase 1 — canonical-question match (stronger than plain normalize;
  // handles team aliases + prose variation)
  const byExact = new Map<string, MarketSnapshot[]>()
  for (const s of snapshots) {
    const key = canonicalQuestion(s.question, s.sport)
    if (!byExact.has(key)) byExact.set(key, [])
    byExact.get(key)!.push(s)
  }

  const phase1Groups: Array<{ key: string; group: MarketSnapshot[] }> = []
  const phase1Singletons: MarketSnapshot[] = []
  for (const [key, group] of byExact) {
    if (group.length >= 2) phase1Groups.push({ key, group })
    else phase1Singletons.push(group[0])
  }

  // Phase 2 — sport signature on Phase 1 singletons
  const bySport = new Map<string, MarketSnapshot[]>()
  const unmatched: MarketSnapshot[] = []
  for (const s of phase1Singletons) {
    const sig = sportsSignature(s)
    if (sig) {
      if (!bySport.has(sig)) bySport.set(sig, [])
      bySport.get(sig)!.push(s)
    } else {
      unmatched.push(s)
    }
  }

  const phase2Groups: Array<{ key: string; group: MarketSnapshot[] }> = []
  for (const [key, group] of bySport) {
    if (group.length >= 2) phase2Groups.push({ key, group })
    else unmatched.push(group[0])
  }

  // Build canonical list. Each group gets a stable ID derived from its
  // signature key; singletons key off (platform, platform_market_id) so the
  // same snapshot always hashes to the same canonical ID across runs.
  const canonical: CanonicalMarket[] = []
  for (const { key, group } of phase1Groups) {
    canonical.push(toCanonical(group, 'exact', `q|${key}`))
  }
  for (const { key, group } of phase2Groups) {
    canonical.push(toCanonical(group, 'sport', `s|${key}`))
  }
  for (const s of unmatched) {
    canonical.push(
      toCanonical([s], 'singleton', `x|${s.platform}|${s.platform_market_id}`),
    )
  }

  // Stats
  let single = 0
  let two = 0
  let threePlus = 0
  let largest = 0
  for (const c of canonical) {
    if (c.venueCount === 1) single++
    else if (c.venueCount === 2) two++
    else threePlus++
    if (c.venueCount > largest) largest = c.venueCount
  }

  const phase1Count = phase1Groups.reduce((n, { group }) => n + group.length, 0)
  const phase2Count = phase2Groups.reduce((n, { group }) => n + group.length, 0)

  return {
    canonical,
    stats: {
      totalSnapshots: snapshots.length,
      canonicalCount: canonical.length,
      singleVenue: single,
      twoVenue: two,
      threePlus,
      largestGroup: largest,
      phase1GroupedSnapshots: phase1Count,
      phase2GroupedSnapshots: phase2Count,
      untouchedSingletons: unmatched.length,
    },
  }
}

// Short-lived in-memory cache for the grouping result. Server components
// call loadCanonicalMarkets() on every render, and the underlying JSONL
// files only change on scraper runs (minutes apart), so caching for 30s
// cuts repeat /markets + detail-page loads from ~3s to ~instant without
// serving noticeably stale data. Cleared by server restart on code changes
// in dev; in prod this lives for the process lifetime with a TTL.
let cached: { at: number; result: GroupingResult } | null = null
const CACHE_TTL_MS = 30_000

/**
 * Convenience: load all current snapshots and return them already grouped
 * into canonical markets. Use this from server components that render
 * canonical-keyed views (listings, detail pages, arb scanner).
 */
export async function loadCanonicalMarkets(): Promise<GroupingResult> {
  const now = Date.now()
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.result
  const { snapshots } = await loadAllLatestSnapshots()
  const result = groupIntoCanonical(snapshots)
  cached = { at: now, result }
  return result
}

/**
 * Lookup helper for detail-page routes that still use the legacy
 * `(platform, platform_market_id)` URL shape. Finds the canonical group
 * that contains the matching snapshot. Returns null if no such snapshot
 * exists in the current data.
 */
export async function findCanonicalForSnapshot(
  platform: string,
  platformMarketId: string,
): Promise<CanonicalMarket | null> {
  const { canonical } = await loadCanonicalMarkets()
  return (
    canonical.find((c) =>
      c.quotes.some(
        (q) => q.platform === platform && q.platform_market_id === platformMarketId,
      ),
    ) ?? null
  )
}

/**
 * Lookup helper for canonical-keyed URLs (e.g., /dashboard/markets/c_xxxxx).
 */
export async function findCanonicalById(id: string): Promise<CanonicalMarket | null> {
  const { canonical } = await loadCanonicalMarkets()
  return canonical.find((c) => c.id === id) ?? null
}

interface DbRowWithCanonical extends DbRow {
  canonical_id: string | null
}

/**
 * Targeted lookup: find the canonical group containing a single market by
 * (platform, platform_market_id). Uses the precomputed `markets.canonical_id`
 * column populated by scripts/recompute-canonical.ts — index seek, ~50ms,
 * vs the 4.7s full-snapshot pull that loadCanonicalMarkets() does.
 *
 * Returns null if the market doesn't exist or its canonical_id hasn't been
 * backfilled yet (e.g. a brand-new market that arrived between recompute
 * runs). Caller should fall back to a single-market render in that case.
 */
export async function loadCanonicalForMarket(
  platform: string,
  platformMarketId: string,
): Promise<CanonicalMarket | null> {
  const compositeId = `${platform}:${platformMarketId}`
  const sql = `
    WITH target AS (
      SELECT canonical_id FROM markets WHERE id = $1 LIMIT 1
    )
    SELECT
      m.id AS market_id,
      m.source,
      m.question,
      m.category,
      m.close_time,
      m.status,
      m.raw_metadata,
      m.canonical_id,
      o.id AS outcome_id,
      o.label,
      l.observed_at,
      l.best_bid,
      l.best_ask,
      l.last_price,
      l.overround,
      l.liquidity_usd,
      l.volume_traded
    FROM markets m
    JOIN outcomes o ON o.market_id = m.id
    JOIN LATERAL (
      SELECT observed_at, best_bid, best_ask, last_price, overround, liquidity_usd, volume_traded
      FROM price_observations p
      WHERE p.market_id = m.id AND p.outcome_id = o.id
      ORDER BY p.observed_at DESC
      LIMIT 1
    ) l ON TRUE
    WHERE m.canonical_id = (SELECT canonical_id FROM target)
      AND m.canonical_id IS NOT NULL
      AND m.status <> 'closed'
    ORDER BY m.id, o.id
  `
  const res = await safeQuery<DbRowWithCanonical>(sql, [compositeId])
  if (!res || res.rows.length === 0) return null

  const byMarket = new Map<string, DbRow[]>()
  for (const row of res.rows) {
    let group = byMarket.get(row.market_id)
    if (!group) {
      group = []
      byMarket.set(row.market_id, group)
    }
    group.push(row)
  }

  const quotes: MarketSnapshot[] = []
  for (const rows of byMarket.values()) {
    const snap = dbRowsToSnapshot(rows)
    if (snap) quotes.push(snap)
  }
  if (quotes.length === 0) return null

  const first = quotes[0]
  const venues = [...new Set(quotes.map((q) => q.platform))].sort()
  return {
    id: res.rows[0].canonical_id ?? compositeId,
    question: first.question,
    category: categoryOf(first),
    sport: first.sport,
    venueCount: venues.length,
    venues,
    quotes,
    groupedBy: venues.length === 1 ? 'singleton' : 'exact',
  }
}

/**
 * Given a snapshot list (or empty array to load everything), return one
 * representative snapshot per canonical market — the highest-volume quote in
 * each group. Used by dashboard panels that still take MarketSnapshot[] but
 * should no longer show the same underlying market 4 times (once per book).
 *
 * Stats like volume/liquidity on the returned snapshot are the REP's own, not
 * aggregates — caller can re-aggregate via `canonicalOf(snapshot)` if needed.
 */
export async function canonicalReps(limit?: number): Promise<MarketSnapshot[]> {
  const { canonical } = await loadCanonicalMarkets()
  const reps: MarketSnapshot[] = []
  for (const c of canonical) {
    let pick = c.quotes[0]
    let pickVol = toNumSafe(pick.volume_traded)
    for (const q of c.quotes) {
      const v = toNumSafe(q.volume_traded)
      if (v > pickVol) {
        pick = q
        pickVol = v
      }
    }
    reps.push(pick)
    if (limit && reps.length >= limit) break
  }
  return reps
}

function toNumSafe(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Map from `platform:platform_market_id` → canonical venueCount. Lets
 * dashboard panels render a "Nx" badge per row without each panel re-running
 * the whole grouping. Keys always use the raw snapshot id, not the canonical
 * id, so callers hand the map the same string they'd use for MarketLink.
 */
export async function buildVenueCountMap(): Promise<Record<string, number>> {
  const { canonical } = await loadCanonicalMarkets()
  const out: Record<string, number> = {}
  for (const c of canonical) {
    for (const q of c.quotes) {
      out[`${q.platform}:${q.platform_market_id}`] = c.venueCount
    }
  }
  return out
}

/**
 * For dashboard lists that are keyed by (platform, market_id) — BigMovers
 * histories, for example — dedupe by canonical ID using the snapshot lookup.
 * Keeps the first occurrence per canonical.
 */
export async function dedupeByCanonical<T extends { platform: string; platform_market_id: string }>(
  items: T[],
): Promise<T[]> {
  const { canonical } = await loadCanonicalMarkets()
  const canonicalBySnapshot = new Map<string, string>()
  for (const c of canonical) {
    for (const q of c.quotes) {
      canonicalBySnapshot.set(`${q.platform}:${q.platform_market_id}`, c.id)
    }
  }
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    const cid =
      canonicalBySnapshot.get(`${item.platform}:${item.platform_market_id}`) ??
      `raw:${item.platform}:${item.platform_market_id}`
    if (seen.has(cid)) continue
    seen.add(cid)
    out.push(item)
  }
  return out
}

// ---------------------------------------------------------------------------
// Paginated /markets listing
//
// The /markets + /dashboard/markets listing used to call loadAllLatestSnapshots
// (~376k rows / 125 MB pulled into Node), groupIntoCanonical in-memory, then
// filter/sort/paginate in JS — a 5–8s server render dominated by wire transfer.
//
// loadMarketsListingPage pushes all of that into SQL using the precomputed
// markets.canonical_id column (see scripts/recompute-canonical.ts). Two queries:
//   A — group every non-closed market to its canonical_id, apply the filters,
//       sort, and LIMIT/OFFSET — returns just the page's canonical keys plus
//       the facet data the FilterBar / freshness strip need.
//   B — hydrate only those ~50 canonical groups into full CanonicalMarket
//       objects (all venues + outcomes + latest prices).
//
// Falls back to the old in-memory path (which itself falls back to JSONL) when
// the DB is unreachable, so a Timescale blip degrades gracefully instead of
// erroring the page.
// ---------------------------------------------------------------------------

export interface MarketsListingFilter {
  q?: string
  /** lowercased platform id */
  platform?: string
  /** lowercased sport id */
  sport?: string
  category?: TerminalCategory
  phase?: MarketPhase
  sort: MarketSort
  page: number
  pageSize: number
}

export interface MarketsListingPage {
  markets: CanonicalMarket[]
  total: number
  totalPages: number
  page: number
  availablePlatforms: string[]
  availableSports: string[]
  perBook: Record<string, { count: number; latestTs: string | null }>
  multiVenueCount: number
  latestDate: string | null
}

// SQL ORDER BY fragment per sort key. WHITELISTED — these strings are
// interpolated into the query text, so the value must only ever come from
// this map (keyed by the MarketSort union), never from raw user input.
// All four are pure scalar aggregates on per_canon — no per-group "rep" row,
// so per_canon can HashAggregate instead of sort-spilling to pgsql_tmp.
const LISTING_SORT_SQL: Record<MarketSort, string> = {
  volume: 'agg_volume DESC NULLS LAST',
  overround: 'max_overround DESC NULLS LAST',
  resolves_at: 'min_close_time ASC NULLS LAST',
  updated: 'max_observed DESC NULLS LAST',
}

interface ListingPageQueryResult {
  total: number | string
  pageKeys: string[] | null
  availablePlatforms: string[] | null
  availableSports: string[] | null
  multiVenueCount: number | string
  latestDate: string | null
  perBook: Record<string, { count: number | string; latestTs: string | null }> | null
}

function toCount(v: number | string | null | undefined): number {
  if (v == null) return 0
  const n = typeof v === 'number' ? v : parseInt(v, 10)
  return Number.isFinite(n) ? n : 0
}

/**
 * Query A — group/filter/sort/paginate entirely in SQL. Returns the ordered
 * canonical keys for the requested page plus the unfiltered facet data.
 * `categoryOf()` and the phase/sport derivations from markets-data.ts are
 * mirrored here as SQL expressions — keep them in sync with the TS source.
 */
async function loadListingPageQuery(
  filter: MarketsListingFilter,
): Promise<ListingPageQueryResult | null> {
  const offset = Math.max(0, (filter.page - 1) * filter.pageSize)
  const sql = `
    WITH per_market AS MATERIALIZED (
      SELECT DISTINCT ON (m.id)
        m.id AS market_id,
        COALESCE(m.canonical_id, m.id) AS canon,
        split_part(m.id, ':', 1) AS platform,
        m.question AS question,
        m.close_time AS close_time,
        l.observed_at AS observed_at,
        l.overround AS overround,
        l.volume_traded AS volume_traded,
        COALESCE(m.raw_metadata->>'sport', NULLIF(m.category, 'unknown')) AS sport,
        COALESCE(
          m.raw_metadata->>'phase',
          CASE m.status
            WHEN 'pre_open' THEN 'pre_game'
            WHEN 'open'     THEN 'live'
            WHEN 'closed'   THEN 'closed'
            ELSE 'opening'
          END
        ) AS phase,
        -- categoryOf() mirror: try the sport token first, then each
        -- raw_metadata.tags entry in array order; first mapped hit wins,
        -- 'other' otherwise. Keep in sync with CATEGORY_MAP in market-stats.ts.
        COALESCE((
          SELECT cat FROM (
            SELECT
              CASE
                WHEN tok IN ('politics','elections') THEN 'politics'
                WHEN tok IN ('economics','fed','finance') THEN 'economics'
                WHEN tok IN ('crypto','bitcoin','ethereum') THEN 'crypto'
                WHEN tok IN ('technology','tech','companies') THEN 'tech'
                WHEN tok IN ('nba','basketball','nfl','football','mlb','baseball',
                             'nhl','ice_hockey','soccer','boxing','mma','tennis',
                             'golf','wnba','ncaab','ncaaf') THEN 'sports'
                WHEN tok = 'entertainment' THEN 'other'
                ELSE NULL
              END AS cat,
              ord
            FROM (
              SELECT lower(COALESCE(m.raw_metadata->>'sport', NULLIF(m.category, 'unknown'))) AS tok, 0 AS ord
              UNION ALL
              SELECT lower(t.tag), t.ord::int
              FROM jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(m.raw_metadata->'tags') = 'array'
                     THEN m.raw_metadata->'tags' ELSE '[]'::jsonb END
              ) WITH ORDINALITY AS t(tag, ord)
            ) toks
          ) mapped
          WHERE cat IS NOT NULL
          ORDER BY ord
          LIMIT 1
        ), 'other') AS category,
        (
          $5::text IS NULL
          OR m.question ILIKE '%' || $5 || '%'
          OR EXISTS (
            SELECT 1 FROM outcomes oq
            WHERE oq.market_id = m.id AND oq.label ILIKE '%' || $5 || '%'
          )
        ) AS q_match
      FROM markets m
      JOIN outcomes o ON o.market_id = m.id
      JOIN LATERAL (
        SELECT observed_at, overround, volume_traded
        FROM price_observations p
        WHERE p.market_id = m.id AND p.outcome_id = o.id
          AND p.observed_at >= now() - interval '24 hours'
        ORDER BY p.observed_at DESC
        LIMIT 1
      ) l ON TRUE
      WHERE m.status <> 'closed'
      ORDER BY m.id, l.observed_at DESC
    ),
    -- Distinct (canon, platform) pairs, then a plain count(*) per canon below.
    -- Doing it this way keeps the per_canon aggregate free of count(DISTINCT)
    -- — which would force Postgres to sort all of per_market by
    -- (canon, platform) and spill ~20 MB to pgsql_tmp. Both this CTE and
    -- canon_venue_count below are HashAggregate-eligible (tiny output: ~14
    -- distinct platforms × ~200k canons).
    canon_platforms AS MATERIALIZED (
      SELECT DISTINCT canon, platform FROM per_market
    ),
    canon_venue_count AS MATERIALIZED (
      SELECT canon, count(*) AS venue_count
      FROM canon_platforms
      GROUP BY canon
    ),
    -- One row per canonical group. Every aggregate here is scalar
    -- (SUM / MAX / MIN / bool_or — no DISTINCT) so Postgres can HashAggregate
    -- per_market without a global sort. Picking a per-group "representative"
    -- row with array_agg(... ORDER BY volume) used to force a ~54 MB sort
    -- spill; the display row is rebuilt later by Query B + groupIntoCanonical
    -- so Query A only needs enough to filter / sort / paginate.
    per_canon AS MATERIALIZED (
      SELECT
        canon,
        COALESCE(SUM(volume_traded), 0) AS agg_volume,
        MAX(overround) AS max_overround,
        MIN(close_time) AS min_close_time,
        MAX(observed_at) AS max_observed,
        bool_or(q_match) AS q_match,
        -- Filter predicates: a group matches if ANY of its venues matches.
        -- For the 98% of groups that are single-venue this is identical to
        -- the old per-snapshot check; multi-venue groups become "any venue".
        bool_or(platform = $1) AS platform_match,
        bool_or(lower(sport) = $2) AS sport_match,
        bool_or(category = $3) AS category_match,
        bool_or(phase = $4) AS phase_match
      FROM per_market
      GROUP BY canon
    ),
    filtered AS (
      SELECT pc.canon, pc.agg_volume, pc.max_overround, pc.min_close_time,
             pc.max_observed, vc.venue_count
      FROM per_canon pc
      JOIN canon_venue_count vc USING (canon)
      WHERE pc.q_match
        AND ($1::text IS NULL OR pc.platform_match)
        AND ($2::text IS NULL OR pc.sport_match)
        AND ($3::text IS NULL OR pc.category_match)
        AND ($4::text IS NULL OR pc.phase_match)
    ),
    page AS (
      -- Inner ORDER BY + LIMIT is a top-N heapsort (≤50 rows out, no spill).
      -- canon is the final tiebreaker so the slice is deterministic across
      -- pages. ROW_NUMBER() OVER () then numbers the slice in that order so
      -- json_agg can re-sort the keys back into page order below.
      SELECT canon, ROW_NUMBER() OVER () AS rk
      FROM (
        SELECT canon
        FROM filtered
        ORDER BY ${LISTING_SORT_SQL[filter.sort]}, venue_count DESC, canon
        LIMIT $6 OFFSET $7
      ) ordered
    )
    SELECT json_build_object(
      'total', (SELECT count(*) FROM filtered),
      'pageKeys', COALESCE((SELECT json_agg(canon ORDER BY rk) FROM page), '[]'::json),
      'availablePlatforms', COALESCE(
        (SELECT json_agg(p) FROM (SELECT DISTINCT platform AS p FROM per_market) s),
        '[]'::json),
      'availableSports', COALESCE(
        (SELECT json_agg(sp) FROM (
          SELECT DISTINCT sport AS sp FROM per_market
          WHERE sport IS NOT NULL AND sport <> ''
        ) s),
        '[]'::json),
      'multiVenueCount', (SELECT count(*) FROM canon_venue_count WHERE venue_count >= 2),
      'latestDate', (SELECT max(observed_at) FROM per_market),
      'perBook', COALESCE((
        SELECT json_object_agg(platform, jb) FROM (
          SELECT platform,
                 json_build_object('count', count(*), 'latestTs', max(observed_at)) AS jb
          FROM per_market GROUP BY platform
        ) t
      ), '{}'::json)
    ) AS result
  `
  const params = [
    filter.platform ?? null,
    filter.sport ?? null,
    filter.category ?? null,
    filter.phase ?? null,
    filter.q && filter.q.trim() ? filter.q.trim() : null,
    filter.pageSize,
    offset,
  ]
  const res = await safeQuery<{ result: ListingPageQueryResult }>(sql, params)
  if (!res || res.rows.length === 0) return null
  return res.rows[0].result
}

/**
 * Query B — hydrate a set of canonical keys into full CanonicalMarket objects.
 * Pulls every non-closed market whose COALESCE(canonical_id, id) is in `keys`
 * (so all venues of each group come along), then runs them back through
 * groupIntoCanonical so the resulting shape + ids match the rest of the app.
 */
async function hydrateCanonicalGroups(keys: string[]): Promise<CanonicalMarket[]> {
  if (keys.length === 0) return []
  const sql = `
    SELECT
      m.id AS market_id,
      m.source,
      m.question,
      m.category,
      m.close_time,
      m.status,
      m.raw_metadata,
      o.id AS outcome_id,
      o.label,
      l.observed_at,
      l.best_bid,
      l.best_ask,
      l.last_price,
      l.overround,
      l.liquidity_usd,
      l.volume_traded
    FROM markets m
    JOIN outcomes o ON o.market_id = m.id
    JOIN LATERAL (
      SELECT observed_at, best_bid, best_ask, last_price, overround, liquidity_usd, volume_traded
      FROM price_observations p
      WHERE p.market_id = m.id AND p.outcome_id = o.id
        AND p.observed_at >= now() - interval '24 hours'
      ORDER BY p.observed_at DESC
      LIMIT 1
    ) l ON TRUE
    WHERE m.status <> 'closed'
      AND COALESCE(m.canonical_id, m.id) = ANY($1::text[])
    ORDER BY m.id, o.id
  `
  const res = await safeQuery<DbRow>(sql, [keys])
  if (!res) return []

  const byMarket = new Map<string, DbRow[]>()
  for (const row of res.rows) {
    let group = byMarket.get(row.market_id)
    if (!group) {
      group = []
      byMarket.set(row.market_id, group)
    }
    group.push(row)
  }
  const snapshots: MarketSnapshot[] = []
  for (const rows of byMarket.values()) {
    const snap = dbRowsToSnapshot(rows)
    if (snap) snapshots.push(snap)
  }
  return groupIntoCanonical(snapshots).canonical
}

async function loadMarketsListingPageFromDb(
  filter: MarketsListingFilter,
): Promise<MarketsListingPage | null> {
  const query = await loadListingPageQuery(filter)
  if (!query) return null
  const pageKeys = query.pageKeys ?? []

  const canonical = await hydrateCanonicalGroups(pageKeys)

  // Index hydrated groups by canonical id AND by every member's raw snapshot
  // key. A brand-new market with a not-yet-backfilled canonical_id keys off
  // its raw id in Query A but groupIntoCanonical hands it a c_… id — the
  // raw-key index bridges that gap so it still lands in the page.
  const byCanonId = new Map<string, CanonicalMarket>()
  const bySnapshotKey = new Map<string, CanonicalMarket>()
  for (const c of canonical) {
    byCanonId.set(c.id, c)
    for (const q of c.quotes) {
      bySnapshotKey.set(`${q.platform}:${q.platform_market_id}`, c)
    }
  }

  const markets: CanonicalMarket[] = []
  const seen = new Set<string>()
  for (const canon of pageKeys) {
    const c = byCanonId.get(canon) ?? bySnapshotKey.get(canon)
    if (c && !seen.has(c.id)) {
      seen.add(c.id)
      markets.push(c)
    }
  }

  const total = toCount(query.total)
  return {
    markets,
    total,
    totalPages: Math.max(1, Math.ceil(total / filter.pageSize)),
    page: filter.page,
    availablePlatforms: [...(query.availablePlatforms ?? [])].sort(),
    availableSports: [...(query.availableSports ?? [])].sort(),
    perBook: Object.fromEntries(
      Object.entries(query.perBook ?? {}).map(([k, v]) => [
        k,
        { count: toCount(v.count), latestTs: v.latestTs },
      ]),
    ),
    multiVenueCount: toCount(query.multiVenueCount),
    latestDate: query.latestDate ? query.latestDate.slice(0, 10) : null,
  }
}

function aggregateVolumeOf(c: CanonicalMarket): number {
  let total = 0
  for (const q of c.quotes) {
    const v =
      typeof q.volume_traded === 'number'
        ? q.volume_traded
        : parseFloat(String(q.volume_traded ?? '0'))
    if (Number.isFinite(v)) total += v
  }
  return total
}

/**
 * Fallback for when Timescale is unreachable: the original in-memory path —
 * load every snapshot (JSONL-backed if the DB is down), group, then
 * filter/sort/paginate in JS. Slower, but keeps the page alive. Mirrors the
 * filter/sort semantics the SQL path implements.
 */
async function loadMarketsListingPageFromMemory(
  filter: MarketsListingFilter,
): Promise<MarketsListingPage> {
  const { snapshots, latestDate } = await loadAllLatestSnapshots()
  const { canonical } = groupIntoCanonical(snapshots)

  const availablePlatforms = [...new Set(canonical.flatMap((c) => c.venues))].sort()
  const availableSports = [
    ...new Set(canonical.map((c) => c.sport).filter((s): s is string => !!s)),
  ].sort()
  const perBook: Record<string, { count: number; latestTs: string | null }> = {}
  for (const s of snapshots) {
    const b = perBook[s.platform]
    if (!b) perBook[s.platform] = { count: 1, latestTs: s.ts }
    else {
      b.count += 1
      if (!b.latestTs || s.ts > b.latestTs) b.latestTs = s.ts
    }
  }
  const multiVenueCount = canonical.filter((c) => c.venueCount >= 2).length

  const qLower = (filter.q ?? '').toLowerCase().trim()
  const filtered = canonical.filter((c) => {
    if (filter.platform && !c.venues.includes(filter.platform)) return false
    if (filter.sport && (c.sport ?? '').toLowerCase() !== filter.sport) return false
    if (filter.category && c.category !== filter.category) return false
    if (filter.phase && c.quotes[0].phase !== filter.phase) return false
    if (qLower) {
      if (c.question.toLowerCase().includes(qLower)) return true
      for (const qt of c.quotes) {
        for (const o of qt.outcomes) {
          if (o.name.toLowerCase().includes(qLower)) return true
        }
      }
      return false
    }
    return true
  })

  filtered.sort((a, b) => {
    switch (filter.sort) {
      case 'overround': {
        const av = a.quotes[0].overround ?? -Infinity
        const bv = b.quotes[0].overround ?? -Infinity
        if (bv !== av) return bv - av
        break
      }
      case 'resolves_at': {
        const at = a.resolves_at ? Date.parse(a.resolves_at) : Infinity
        const bt = b.resolves_at ? Date.parse(b.resolves_at) : Infinity
        if (at !== bt) return at - bt
        break
      }
      case 'updated': {
        const at = Math.max(...a.quotes.map((q) => Date.parse(q.ts) || 0))
        const bt = Math.max(...b.quotes.map((q) => Date.parse(q.ts) || 0))
        if (bt !== at) return bt - at
        break
      }
      case 'volume':
      default: {
        const av = aggregateVolumeOf(a)
        const bv = aggregateVolumeOf(b)
        if (bv !== av) return bv - av
        break
      }
    }
    if (a.venueCount !== b.venueCount) return b.venueCount - a.venueCount
    return a.question.localeCompare(b.question)
  })

  const total = filtered.length
  const start = (filter.page - 1) * filter.pageSize
  return {
    markets: filtered.slice(start, start + filter.pageSize),
    total,
    totalPages: Math.max(1, Math.ceil(total / filter.pageSize)),
    page: filter.page,
    availablePlatforms,
    availableSports,
    perBook,
    multiVenueCount,
    latestDate,
  }
}

/**
 * Single entry point for the /markets + /dashboard/markets listing. Pushes
 * filter/sort/paginate into SQL via markets.canonical_id; falls back to the
 * in-memory (and ultimately JSONL) path when the DB is unreachable.
 */
export async function loadMarketsListingPage(
  filter: MarketsListingFilter,
): Promise<MarketsListingPage> {
  const fromDb = await loadMarketsListingPageFromDb(filter)
  if (fromDb) return fromDb
  return loadMarketsListingPageFromMemory(filter)
}
