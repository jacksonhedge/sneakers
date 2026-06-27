# Plan — Teach Your AI Bot To Trade · multi-source feed

The dashboard's `Teach Your AI Bot To Trade` tile currently renders a
static placeholder array (5 cards, all `url: '#'` → "COMING SOON"
disabled state). Goal: wire real content from three sources, switchable
via a top-tile button row.

---

## Surface

Three pill buttons at the top of the tile, one always active:

```
[ 𝕏 Twitter ]  [ ▶ Reddit ]  [ ⌘ GitHub ]
```

- **Twitter is the default** (hot content, frequent updates, native to
  trading thought leadership).
- Each button swaps the body content; tile shell + "STRATEGY →" footer
  link stay constant.
- Active pill: emerald ring + bold text, like the size toggles on the
  horse-race lobby.

Each card retains the same shape (kind chip, author, title, hook,
optional thumbnail), with kind-icon swapping based on source.

---

## Sources + auth model

### 1. Twitter (X) — default

- **API**: X API v2 — `GET /2/tweets/search/recent` or
  `GET /2/users/:id/tweets` for curated lists.
- **Auth**: app-level Bearer Token (no user OAuth needed for read).
- **Ratelimit**: free tier is 1 project, 1500 tweets/month read,
  450 reqs / 15 min. Tight — caching is mandatory.
- **Content strategy**: maintain a small server-side allowlist of
  curated handles (e.g. `@kalshi_quant`, `@polymarketinfo`, etc.)
  rather than open keyword search (which surfaces too much spam).
  Server caches the union of their recent tweets for ~30 min.
- **Risk**: Elon-era ToS changes have been hostile to scrapers and
  third-party clients. Use the official API, not nitter scraping.

### 2. Reddit

- **API**: Reddit JSON API — `GET /r/<sub>/hot.json?limit=N` works
  unauthenticated for public subreddits.
- **Auth**: optional but recommended. App-level OAuth (script-type
  app) bumps rate limit from 60 req/min unauth to 600 req/min auth.
- **Subreddits**: r/algotrading, r/PredictionMarkets, r/quantfinance,
  r/Polymarket (community sub if it exists at scale). Hand-pick.
- **Content strategy**: pull top-of-week from each, score-sort, dedupe
  by title-similarity, filter for self-posts + flair-tagged DD posts.
- **Cache**: ~1 hour TTL — Reddit content moves slower than Twitter.

### 3. GitHub

- **API**: REST v3 — `GET /search/repositories` for repo search,
  `GET /repos/:owner/:repo` for details.
- **Auth**: optional. 60 req/hr unauth; 5000 req/hr with PAT.
  Recommend a server-side PAT for predictable behavior.
- **Search queries**: pinned set of keyword bundles (e.g.
  `polymarket bot`, `kalshi`, `prediction market arbitrage`,
  `sports betting LLM`).
- **Content strategy**: cards link to the repo; render description +
  primary language + star count + last-push age. Stars desc, filter
  archived + low-star noise.
- **Cache**: ~6 hour TTL — repo metadata changes slowly.

---

## Caching architecture

Direct API calls per page render don't fit any of the three rate
limits. Cache in front of all three:

**Option A — Supabase table (preferred for v1):**
```sql
create table public.bot_training_feed (
  source text not null,         -- 'twitter' | 'reddit' | 'github'
  external_id text not null,    -- tweet id / reddit post id / repo id
  fetched_at timestamptz not null default now(),
  payload jsonb not null,       -- the rendered card shape
  primary key (source, external_id)
);
create index bot_training_feed_source_fetched_idx
  on public.bot_training_feed (source, fetched_at desc);
```

A nightly Vercel Cron (or on-demand `/api/cron/refresh-bot-feed`)
re-pulls all three sources. Page reads always come out of the table;
no API hits in the user request path.

**Option B — In-memory only:** cheap, but cold starts re-fetch on
first request. Fine for prototype, breaks under any real load.

Recommend A. Migration `043_bot_training_feed.sql`.

---

## Component shape

### Tile changes

```tsx
type FeedSource = 'twitter' | 'reddit' | 'github'

export function TeachBotTile({
  initialSource = 'twitter',
  feedBySource,
}: {
  initialSource?: FeedSource
  feedBySource: Record<FeedSource, FeedItem[]>
}) {
  const [source, setSource] = useState<FeedSource>(initialSource)
  const items = feedBySource[source] ?? []
  // ...header with three pill buttons, body renders items
}
```

The tile becomes a client component (was server-rendered before). The
server component wrapping it (`dashboard/page.tsx`) does the DB fetch
and passes all three lists down. Tile toggles between them with no
network round-trip.

### Pill button row

```tsx
<div className="inline-flex items-center gap-1 rounded-full ring-1 ring-stone-200 bg-stone-50 p-0.5">
  <SourceButton id="twitter" active={source === 'twitter'} onClick={() => setSource('twitter')} icon="𝕏" label="Twitter" />
  <SourceButton id="reddit" active={source === 'reddit'} onClick={() => setSource('reddit')} icon="▶" label="Reddit" />
  <SourceButton id="github" active={source === 'github'} onClick={() => setSource('github')} icon="⌘" label="GitHub" />
</div>
```

Persist last-selected source in localStorage so it's sticky across
sessions.

---

## Card variants by source

Same card shell, source-specific details:

| Source | Author label | Title | Hook | Footer chip |
|---|---|---|---|---|
| Twitter | `@handle` | First line of the tweet | Truncated body | Likes · retweets · age |
| Reddit | `u/user · r/sub` | Post title | First 2 lines of body or subtitle | Upvotes · comments · age |
| GitHub | `owner/repo` | Repo description | First line of README or `description` | Stars ★ · primary language · last push |

Click → opens the canonical URL (tweet permalink / Reddit post /
GitHub repo) in a new tab. Affiliate-tracking handled by appending
`?ref=sneakers` where appropriate.

---

## Phasing

**Phase 1 — UI shell only (no API).** ~1 hour.
- Add the three pill buttons.
- Refactor `BOT_TRAINING_FEED` into `BOT_TRAINING_FEED_BY_SOURCE: Record<FeedSource, FeedItem[]>`.
- Distribute the existing 5 hand-curated items across the three lists.
- Keeps "COMING SOON" badge on every item.
- Ships immediately, no backend changes.

**Phase 2 — Server cache + Reddit (cheapest API).** ~3-4 hours.
- Migration 043: `bot_training_feed` table.
- New API route `/api/cron/refresh-bot-feed` that pulls Reddit only.
- `loadBotTrainingFeed(source)` server function reads from the table.
- Wire to the tile via `dashboard/page.tsx`.
- Reddit-only because it works without OAuth and proves the pattern.

**Phase 3 — GitHub.** ~1 hour.
- Add GitHub PAT to Vercel env (`GITHUB_PAT`).
- Extend the cron to query GitHub search.
- Same write path to the table.

**Phase 4 — Twitter.** ~3-5 hours.
- Add X API Bearer Token to Vercel env (`X_API_BEARER_TOKEN`).
- Curated handle list config — start with 5-10 handles in
  `lib/bot-feed-sources.ts`.
- Watch monthly tweet quota carefully.

**Phase 5 — Admin curation.** ~3 hours.
- `/admin/teach-bot-feed` page: pin / unpin / hide individual items.
- Adds a `pinned`, `hidden` column to the table.
- The cron respects hidden items (won't re-surface them).

---

## Open questions

1. **Twitter API tier**: free tier is 1500 tweets/month read. With 5
   handles × ~10 tweets each, we burn ~250-500 tweets per refresh.
   That's 3-6 refreshes per month before quota — not enough. Options:
   - $200/mo Basic tier (10K tweets/mo)
   - Cache aggressively (12-24h TTL)
   - Or: skip Twitter from API and curate manually for v1
2. **Should curated content beat algorithmic?** Hand-picking is more
   labor but produces sharper recommendations. Hybrid: algorithmic
   feed + an admin "pin" mechanism (Phase 5).
3. **Is GitHub even useful for "teach your bot to trade"?** Most repos
   are infra/scrapers, not strategy. Maybe replace with a third
   source like Substack or arxiv — TBD.
4. **Affiliate tracking**: should outbound clicks log to
   `click_events`? Useful for tracking which content drives
   engagement, but adds complexity.

---

## Decision needed before Phase 2

- Twitter API tier (free vs. $200/mo Basic vs. skip)
- Reddit subreddit allowlist (sketch above; needs your sign-off)
- GitHub: keep or swap for another source

Once those are settled, Phase 1 (UI shell) ships in an hour and
everything downstream slots in incrementally.
