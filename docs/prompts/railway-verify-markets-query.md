# Chrome prompt — verify the /markets listing query against Railway prod data

Paste into the Claude Chrome window. Read-only: these are SELECT / EXPLAIN
queries only. They do not write, alter, or lock anything. Do NOT run anything
else against the database.

Background: I just refactored the `/dashboard/markets` page to push
filter/sort/paginate into SQL instead of pulling ~376k rows into Node. I
verified it on a local copy, but local data is 11 days stale so I couldn't
test the real 24-hour code path on fresh data. I need you to run the actual
queries against the live Railway Postgres and report timings + row counts.

---

Open https://railway.app, go to the Sneakers project, open the **Postgres**
service, and go to its **Data** / query tab (the one where you can run raw
SQL). Run each query below in order and report the results. If the query tab
isn't available, tell me — don't try to wire up a connection yourself.

### Query 1 — EXPLAIN ANALYZE (the important one: timing + spill check)

Run this and paste back the **full** plan output. I specifically need to see:
the total `Execution Time`, whether it says `HashAggregate` or
`GroupAggregate` for the per-canon grouping, and whether **any** node mentions
`external merge`, `Disk:`, or a temp-file spill.

```sql
EXPLAIN (ANALYZE, BUFFERS)
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
    TRUE AS q_match
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
canon_platforms AS MATERIALIZED (
  SELECT DISTINCT canon, platform FROM per_market
),
canon_venue_count AS MATERIALIZED (
  SELECT canon, count(*) AS venue_count FROM canon_platforms GROUP BY canon
),
per_canon AS MATERIALIZED (
  SELECT
    canon,
    COALESCE(SUM(volume_traded), 0) AS agg_volume,
    MAX(overround) AS max_overround,
    MIN(close_time) AS min_close_time,
    MAX(observed_at) AS max_observed,
    bool_or(q_match) AS q_match
  FROM per_market
  GROUP BY canon
),
filtered AS (
  SELECT pc.canon, pc.agg_volume, pc.max_overround, pc.min_close_time,
         pc.max_observed, vc.venue_count
  FROM per_canon pc
  JOIN canon_venue_count vc USING (canon)
  WHERE pc.q_match
),
page AS (
  SELECT canon, ROW_NUMBER() OVER () AS rk
  FROM (
    SELECT canon FROM filtered
    ORDER BY agg_volume DESC NULLS LAST, venue_count DESC, canon
    LIMIT 50 OFFSET 0
  ) ordered
)
SELECT json_build_object(
  'total', (SELECT count(*) FROM filtered),
  'pageKeys', COALESCE((SELECT json_agg(canon ORDER BY rk) FROM page), '[]'::json),
  'multiVenueCount', (SELECT count(*) FROM canon_venue_count WHERE venue_count >= 2),
  'latestDate', (SELECT max(observed_at) FROM per_market)
) AS result;
```

### Query 2 — same query without EXPLAIN, to get the actual numbers

Run the exact query above **but delete the first line** (`EXPLAIN (ANALYZE,
BUFFERS)`). Report: the `total` (canonical market count), `multiVenueCount`,
`latestDate`, and how many `pageKeys` came back (should be 50). Also note the
wall-clock time the console reports.

### Query 3 — sanity cross-check against the old counting method

```sql
SELECT
  count(*) FILTER (WHERE status <> 'closed') AS open_markets,
  count(DISTINCT canonical_id) FILTER (WHERE status <> 'closed' AND canonical_id IS NOT NULL) AS distinct_canon
FROM markets;
```

`distinct_canon` should be in the same ballpark as Query 2's `total` (it
won't match exactly — `total` only counts groups with a price observation in
the last 24h — but it should be the same order of magnitude, not 10x off).

### Query 4 — Query B hydration spot-check

Take the **first 5 strings** from Query 2's `pageKeys` array and paste them
into the `ARRAY[...]` below (replace the placeholders), then run it:

```sql
SELECT count(*) AS rows, count(DISTINCT m.id) AS markets
FROM markets m
JOIN outcomes o ON o.market_id = m.id
JOIN LATERAL (
  SELECT observed_at FROM price_observations p
  WHERE p.market_id = m.id AND p.outcome_id = o.id
    AND p.observed_at >= now() - interval '24 hours'
  ORDER BY p.observed_at DESC LIMIT 1
) l ON TRUE
WHERE m.status <> 'closed'
  AND COALESCE(m.canonical_id, m.id) = ANY(ARRAY[
    'PASTE_KEY_1','PASTE_KEY_2','PASTE_KEY_3','PASTE_KEY_4','PASTE_KEY_5'
  ]);
```

`markets` should be ≥ 5 (multi-venue groups expand to more than one market
per key). If it's 0, something's wrong — flag it.

---

### What to report back

A short summary:
1. **Query 1**: total Execution Time, `HashAggregate` vs `GroupAggregate`,
   and — critically — **any** `external merge` / `Disk:` spill markers (paste
   those lines verbatim). This is the main thing I'm worried about.
2. **Query 2**: total / multiVenueCount / latestDate / pageKeys count + the
   console's wall-clock time.
3. **Query 3**: open_markets and distinct_canon — and whether distinct_canon
   is roughly in line with Query 2's total.
4. **Query 4**: rows + markets.

If Query 1's Execution Time is over ~8 seconds, or anything spills to disk,
say so loudly — that's a blocker and I'll need to rework it.
