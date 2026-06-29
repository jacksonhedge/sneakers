# Super-Memory Design: Bot Market Knowledge System

**Date:** 2026-06-29  
**Status:** Design — pre-implementation  
**Context:** Sneakers Agent, Rung 1 (paper-live). Builds on: `packages/core/src/agent/`, migration `004_agent_tables.sql`, design spec `docs/superpowers/specs/2026-06-25-sneakers-crypto-bot-terminal-design.md`

---

## Table of Contents

1. [Purpose and Principles](#1-purpose-and-principles)
2. [What to Remember Per Window](#2-what-to-remember-per-window)
3. [Architecture Overview](#3-architecture-overview)
4. [Feature Store (Structured Memory)](#4-feature-store-structured-memory)
5. [Regime and Pattern Library (Indexed Memory)](#5-regime-and-pattern-library-indexed-memory)
6. [Retrieval / Semantic Memory (Vector Memory)](#6-retrieval--semantic-memory-vector-memory)
7. [Feedback Loop: Online Calibration](#7-feedback-loop-online-calibration)
8. [Integration with the Agent Core](#8-integration-with-the-agent-core)
9. [Bot Education Loop](#9-bot-education-loop)
10. [Phased Build Proposal](#10-phased-build-proposal)
11. [Schema Additions](#11-schema-additions)
12. [Safety Posture](#12-safety-posture)

---

## 1. Purpose and Principles

The dry-run period generates a genuine track record: every settled window produces a labeled data point — what the features looked like at decision time, what the bot did, what the outcome was. This is gold. Without memory, the track record is just numbers on a dashboard. With memory, it becomes the training signal for an improving strategy.

**What the super-memory system does:**

> For every new window near close, answer: "In historically similar windows — same direction of gap, same vol regime, similar time-of-day, similar order-flow state — what was the actual outcome distribution? And what is my model's current implied_prob calibration error for this regime?"

The answer to that question produces a **memory-adjusted implied probability** that supplements (does not replace) the current Gaussian signal. The gate still applies; real-money safety rails still bind. Memory informs; the gates enforce.

**Principles:**

1. **Memory informs, gates enforce.** No memory layer can override `min_edge_bps`, `actWindowSec`, `perDayCapUsdc`, or any kill switch. Memory only adjusts the probability estimate feeding into the gate — it cannot unlock a bet the gate would reject.

2. **Dry-run data first.** Do not build the ML calibration layer until at least 500 settled windows exist. Build the storage and feature-logging layer first (Phase 1), so data accumulates during the dry-run period without any behavioral change.

3. **Explainability over complexity.** The initial memory layer uses a simple lookup table (bucket-based calibration), not a neural network. A practitioner must be able to explain why the bot raised or lowered a probability estimate.

4. **Graceful degradation.** When memory is unavailable or sparse (< 20 windows in a regime bucket), fall back to the base Gaussian estimate. Memory supplements; it does not replace the signal.

5. **Consistent with existing plans.** Plan 1 core is done. Plan 2 (worker + live feeds + DB) is next. Plan 4 (execution). This design inserts the memory schema as an addendum to Plan 2 migration, so data collection starts with the first live window, not after a separate ML sprint.

---

## 2. What to Remember Per Window

Each window record captures the full context at decision time plus the outcome. This is the atom of the memory system.

### 2.1 Decision-Time Feature Snapshot

At the moment the bot emits a signal (or decides not to), record:

| Feature | Type | Description |
|---------|------|-------------|
| `window_id` | FK | Links to `short_windows` |
| `signal_id` | FK nullable | Links to `short_signals` if a signal was emitted |
| `gap_usdc` | float | `current_spot − open_ref_price` in absolute terms |
| `gap_pct` | float | `gap / open_ref_price × 100` — normalized for cross-window comparison |
| `gap_sigma_ratio` | float | `gap / (recentVolPerSec × sqrt(secondsToClose))` — the key model input |
| `implied_prob` | float | Output of `impliedProbUp` at decision time |
| `market_prob` | float | YES price from CLOB at decision time |
| `edge_bps` | int | `(implied_prob − market_prob) × 10000` |
| `seconds_to_close` | int | Seconds remaining when decision was made |
| `recent_vol_per_sec` | float | The `recentVolPerSec` value used in the signal |
| `vol_regime` | enum | `low | normal | high` — 24h percentile bucket |
| `momentum_sign_60s` | int | `sign(spot_now − spot_60s_ago)` ∈ {-1, 0, 1} |
| `momentum_sign_300s` | int | `sign(spot_now − spot_300s_ago)` |
| `ob_imbalance` | float nullable | Order book imbalance `(bidVol − askVol)/(bidVol + askVol)` at L1 |
| `trade_flow_imbalance` | float nullable | Aggressor buy/sell imbalance over last 30s |
| `hour_utc` | int | UTC hour at window open (0–23) — intraday seasonality |
| `day_of_week` | int | 0=Mon ... 6=Sun |
| `venue` | text | `polymarket | kalshi` |
| `interval_sec` | int | 300 or 900 |

### 2.2 Outcome Record

Appended once the window settles:

| Field | Type | Description |
|-------|------|-------------|
| `actual_outcome` | enum | `up | down` |
| `settle_ref_price` | float | The final oracle price (already in `short_windows`) |
| `final_gap_usdc` | float | `settle_ref_price − open_ref_price` |
| `model_was_correct` | bool | Did the emitted signal predict the correct outcome? |
| `pnl_usdc` | float | From `short_trades.pnl_usdc` (0 if no trade taken) |

### 2.3 What a "Window Record" Is

A window record = the decision-time snapshot + outcome. It is the fundamental unit of bot learning. A bot with 1,000 window records has 1,000 labeled training examples for calibration and retrieval. Every dry-run window produces one, whether or not a trade was taken (the no-signal case is also informative — the bot correctly sat out a window that then resolved 52/48).

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  SIGNAL ENGINE (packages/core/src/agent/signal.ts)              │
│   impliedProbUp() → base Gaussian prob                          │
│           │                                                      │
│           ▼                                                      │
│  MEMORY LAYER (new)                                              │
│   1. Feature Store — log window record                          │
│   2. Regime Lookup — calibrated prob for this regime/bucket     │
│   3. Vector Retrieval — find K most similar historical windows   │
│      → compute empirical outcome frequency                      │
│   4. Blend: memory_adjusted_prob = α×base + β×regime_calib      │
│             + γ×retrieval_empirical                             │
│           │                                                      │
│           ▼                                                      │
│  EXECUTION GATE (gate.ts — UNCHANGED)                           │
│   edge_bps = (memory_adjusted_prob − market_prob) × 10000       │
│   All existing caps and kill switches apply                     │
│           │                                                      │
│           ▼                                                      │
│  FEEDBACK LOOP (post-settlement)                                 │
│   settled window → update calibration buckets → update weights  │
└─────────────────────────────────────────────────────────────────┘

             STORAGE (Railway Postgres)
             ─────────────────────────
             short_windows          (existing)
             short_signals          (existing)
             short_trades           (existing)
             short_bot_configs      (existing)
             window_features        (NEW — Phase 1)
             calibration_buckets    (NEW — Phase 2)
             window_embeddings col  (NEW — Phase 3, optional)
```

The memory layer sits between `signal.ts` and `gate.ts` in the decision pipeline. It is **additive**: when confidence in the memory lookup is low (sparse data), `memory_adjusted_prob ≈ base_prob` and behavior is identical to today. As data accumulates, memory provides progressively more value.

---

## 4. Feature Store (Structured Memory)

### 4.1 What It Is

A structured table (`window_features`) that logs the decision-time feature snapshot for every window the bot observes — whether or not a trade was taken. This is the raw material for all downstream analysis.

### 4.2 Why Log Even No-Signal Windows

The bot currently only writes to `short_signals` when it emits a signal. But no-signal windows are rich training data: they tell us what feature distributions look like when the edge is not there, providing the negative class for ML training and calibration.

### 4.3 Indexing Strategy

For fast retrieval by regime (not vector similarity, just SQL lookups):

```sql
CREATE INDEX ON window_features (vol_regime, hour_utc, momentum_sign_60s);
CREATE INDEX ON window_features (venue, interval_sec, vol_regime);
CREATE INDEX ON window_features (gap_sigma_bucket, vol_regime);
-- gap_sigma_bucket: floor(clamp(gap_sigma_ratio, -4, 4))
```

These indexes enable fast bucket lookups for calibration without any vector search.

### 4.4 Data Volume

Each 5-minute window = 1 row. 288 windows/day. After 30 days dry-run: ~8,640 rows. After 90 days: ~26,000 rows. This is small; it fits comfortably on Railway Postgres without TimescaleDB.

---

## 5. Regime and Pattern Library (Indexed Memory)

### 5.1 Vol Regime Classification

The vol regime is the most important contextual dimension. Three regimes:

```
low:    recentVolPerSec < 20th percentile of last-30d distribution
normal: 20th–80th percentile
high:   > 80th percentile
```

The percentile boundaries update daily from the `window_features` table. The bot tags each window at decision time with the current regime.

**Why this matters:** The Gaussian model's `gap/sigma` ratio changes meaning across regimes. In a low-vol regime, a `gap/sigma = 2.0` is genuinely rare and the model's 97.7% confidence may be well-calibrated. In a high-vol regime, a `gap/sigma = 2.0` occurs more frequently and the model tends to overstate confidence because of fat tails.

### 5.2 Calibration Bucket Table

The regime/pattern library is implemented as a 2D calibration table, indexed by `(gap_sigma_bucket, vol_regime)`:

```
gap_sigma_bucket:  < -3 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | > 3
vol_regime:        low | normal | high
```

For each cell: `(count, sum_correct, empirical_freq, last_updated_at)`.

```
empirical_freq = sum_correct / count   -- fraction of windows where model-predicted side won
```

This table is the core calibration lookup. When `gap_sigma_bucket = 2, vol_regime = normal` has 150 observations with `empirical_freq = 0.94`, and the Gaussian model predicts 0.977, the calibrated estimate is closer to 0.94.

### 5.3 Time-of-Day and Day-of-Week Patterns

A secondary calibration dimension. BTC volatility has intraday seasonality: higher around NYSE open (14:30 UTC), lower on weekends. After 30+ days of data, per `(hour_utc, vol_regime)` calibration becomes meaningful.

This is a Phase 2 addition — do not add this dimension until there are at least 20 windows in most cells of the primary (gap_sigma, vol_regime) table.

### 5.4 Venue-Specific Patterns

Polymarket 5-min and Kalshi 15-min markets have different settlement mechanisms (point-in-time Chainlink vs. 60s TWAP) and different liquidity profiles. Calibration tables are kept separate per `(venue, interval_sec)`.

---

## 6. Retrieval / Semantic Memory (Vector Memory)

### 6.1 What It Is

Vector memory finds K historical windows that are "most similar" to the current window, then computes the empirical outcome frequency among those K windows. This is a K-nearest-neighbor calibration that naturally blends multiple dimensions without manual bucketing.

### 6.2 Feature Vector for Retrieval

Normalize each feature to [0,1] or z-score, then concatenate:

```
feature_vector = [
  gap_sigma_ratio normalized to [-5, 5] → [0, 1],
  vol_regime_score: low=0, normal=0.5, high=1,
  seconds_to_close / 300,
  (momentum_sign_60s + 1) / 2,   -- {-1,0,1} → {0, 0.5, 1}
  (momentum_sign_300s + 1) / 2,
  (ob_imbalance + 1) / 2,        -- [-1,1] → [0,1], default 0.5 if null
  (trade_flow_imbalance + 1) / 2,
  hour_utc / 23,
  day_of_week / 6,
]
```

Dimension: 9. Small enough that even brute-force cosine similarity over 5,000 rows is fast (< 10ms in Postgres).

### 6.3 Implementation Options

**Option A — No pgvector (Phase 1–2):** Pure SQL with a precomputed normalized feature array stored as a `FLOAT[]` column. Nearest-neighbor search via `ORDER BY array_distance(...)` (brute force). Fast enough for < 10,000 rows.

**Option B — pgvector (Phase 3+):** Install the `pgvector` extension on Railway Postgres. Store the feature vector as a `vector(9)` column. Use HNSW index for approximate nearest neighbor search. This scales to millions of rows.

([pgvector GitHub](https://github.com/pgvector/pgvector), [Supabase pgvector docs](https://supabase.com/docs/guides/database/extensions/pgvector))

**Recommendation:** Start with Option A (plain array, SQL sort). pgvector adds a dependency and operational complexity that is not justified until the dataset is large enough to make brute-force slow (> 50,000 rows, which is 6+ months of data at 5-min cadence).

### 6.4 What "Similar Windows" Means

The retrieval step answers: "What happened in the K=20 historical windows that looked most like this one?" If 16 of 20 similar windows resolved "up" and the bot's model predicted "up," that's an empirical frequency of 0.80. The Gaussian model may say 0.94. The blended estimate is somewhere between.

If only 5 similar windows exist, the empirical estimate is unreliable; weight it at γ = 0.0 and use only the base model.

---

## 7. Feedback Loop: Online Calibration

### 7.1 Trigger

When `short_windows.status` transitions to `settled`, the feedback loop runs:

```sql
-- Example pseudocode executed by the worker:
UPDATE calibration_buckets
SET count = count + 1,
    sum_correct = sum_correct + (CASE WHEN model_was_correct THEN 1 ELSE 0 END),
    -- Laplace smoothing: prevents overconfidence on sparse cells
    empirical_freq = (sum_correct + 1.0) / (count + 2.0),
    last_updated_at = now()
WHERE gap_sigma_bucket = $gap_sigma_bucket
  AND vol_regime = $vol_regime
  AND venue = $venue
  AND interval_sec = $interval_sec;
```

**Laplace smoothing** `(k+1)/(n+2)` prevents the calibration from being overconfident on sparse cells. A cell with 1 success in 1 observation gets `empirical_freq = 0.67`, not 1.0.

### 7.2 Online Calibration vs. Batch Retraining

The calibration bucket update is online: it runs on every settlement without batch retraining. This is the right approach for the current scale (hundreds to thousands of windows). Batch ML model retraining (for the future GBDT) is a weekly/monthly job triggered when enough new data has accumulated (e.g., every 200 new settled windows).

### 7.3 Calibration Drift Detection

Monitor the rolling 7-day calibration error per bucket:

```
calibration_error = mean(|implied_prob - actual_freq|)  over last 7 days
```

If `calibration_error > 10 bps` in a commonly-triggered bucket, emit a warning (log + admin notification). This surfaces regime changes where the model's implied_prob has drifted from empirical reality.

### 7.4 Convergence Requirement Before Influence

The memory layer should **not influence trading decisions until calibration data is statistically meaningful**. Define:

- A bucket is "trusted" when `count >= 30` (per cell)
- Memory adjustments to implied_prob are gated: if `count < 30` in the relevant bucket, use `memory_adjusted_prob = base_prob` (pass-through)
- The blending weights (α, β, γ) begin at (1.0, 0.0, 0.0) and transition to (0.6, 0.3, 0.1) as data accumulates, scaling continuously: `weight = min(count / 100, 0.3)`

This ensures the system cannot degrade performance during the sparse-data early period.

---

## 8. Integration with the Agent Core

### 8.1 Current Decision Flow

```
signal.ts: impliedProbUp(priceState) → implied_prob
signal.ts: evaluateSignal(priceState, marketQuote) → SignalDecision | null
gate.ts:   evaluateGate(botState, decision, ctx) → GateResult
```

### 8.2 New Flow with Memory Layer

```
signal.ts: impliedProbUp(priceState) → base_implied_prob           [unchanged]
memory.ts: recordWindowFeatures(windowId, features, db)            [NEW: always log]
memory.ts: adjustedImpliedProb(features, base_implied_prob, db)    [NEW: Phase 2+]
         → memory_adjusted_prob (= base if memory sparse)
signal.ts: evaluateSignal(priceState, marketQuote, memoryOverride) → SignalDecision | null
         [signal.ts change: accepts optional override for implied_prob]
gate.ts:   evaluateGate(botState, decision, ctx) → GateResult      [unchanged]
memory.ts: onSettlement(windowId, outcome, db) → updateCalibration [NEW: after settlement]
```

**New file: `packages/core/src/agent/memory.ts`**

Exports:
- `recordWindowFeatures(windowId, snapshot, db)` — writes to `window_features` table
- `adjustedImpliedProb(snapshot, baseProb, db)` — looks up calibration bucket; returns adjusted prob
- `onSettlement(windowId, outcome, db)` — updates calibration buckets

The memory module is isolated from the core signal/gate logic. If `memory.ts` throws or the DB is unavailable, the system falls back to `base_implied_prob` and continues trading. No memory-layer failure can halt the bot.

### 8.3 Minimal Modification to signal.ts

Add an optional `memoryOverride` parameter to `evaluateSignal`. If provided, use it instead of calling `impliedProbUp`. If not provided (or null), compute from scratch. This change is backward-compatible: all existing tests pass unchanged.

```typescript
// signal.ts — minimal change
export function evaluateSignal(
  s: PriceState,
  q: MarketQuote,
  memoryOverride?: number  // optional memory-adjusted implied_prob
): SignalDecision | null {
  const pUp = memoryOverride ?? impliedProbUp(s)
  // rest of function unchanged: pUp > q.yesPrice → YES edge, etc.
}
```

### 8.4 How Memory Adjusts the Probability (Pseudocode)

At decision time in the worker:

```typescript
const baseProb = impliedProbUp(priceState);
const features = buildFeatureSnapshot(priceState, marketQuote, spotFeed, windowRow);

// Phase 1: log only (no adjustment)
await recordWindowFeatures(windowId, features, db);

// Phase 2+: blend with calibration bucket
const { empiricalFreq, count } = await lookupCalibrationBucket(features, db);
const weight = Math.min(count / 100, 0.3);  // 0 → 0.3 as count: 0 → 100+
const adjustedProb = (1 - weight) * baseProb + weight * empiricalFreq;

const signal = evaluateSignal(priceState, marketQuote, adjustedProb);
```

The blending is conservative: memory contributes at most 30% weight when a bucket has >= 100 observations. This protects against overfitting sparse calibration data.

### 8.5 Per-Regime Edge Thresholds (Future)

The Execution Gate's `min_edge_bps` is currently a fixed value per risk preset. With memory data, it can become regime-conditional:

- In **low-vol regime**: Gaussian confidence is better-calibrated. `min_edge_bps` can be slightly lower.
- In **high-vol regime**: Model understates tail risk. `min_edge_bps` should be higher to compensate.

Implement only after Phase 2 calibration data shows a statistically reliable vol-regime pattern (> 100 windows per regime). Do not implement pre-emptively.

---

## 9. Bot Education Loop

### 9.1 From Track Record to Improving Strategy

The dry-run produces a genuine track record because every dry-run trade is marked to real settlement. This track record is the input to the bot education loop:

```
WEEK 1–2 (dry-run):
  window_features accumulates. Bot behavior unchanged.
  No memory influence on trading decisions.

WEEK 3–4:
  First 500+ settled windows. Vol regime boundaries computed.
  Calibration buckets begin populating.
  Still no memory influence (count < 30 per bucket).
  First diagnostic: plot empirical_freq vs. implied_prob per bucket.
  Question: "Is the model well-calibrated in any regime? Where does it mis-estimate?"

MONTH 2:
  Most calibration buckets hit count > 30. Memory blending activates at low weight.
  Implied prob adjustments begin. Observe dry-run P&L change.
  Compare pre-memory vs. post-memory win rates per bucket.

MONTH 3+:
  Full calibration active. GBDT training begins on 1,000+ window records.
  Vector retrieval (KNN) layer added for per-instance calibration.
  Weekly calibration audit: does empirical_freq track actual outcome rates?
```

### 9.2 The Dry-Run Proof Gate (Enhanced)

The spec defines a dry-run proof gate before live money. The memory system strengthens this gate:

- Not just "N windows settled" but "calibration error < threshold in primary buckets"
- Require `calibration_error < 5 bps` for the most-traded cells (`gap_sigma_bucket ∈ {1,2,3}, vol_regime = normal`) before considering live trading
- This ensures the bot's probability estimates are demonstrably accurate on dry-run data before real money is exposed to mis-calibrated signals

### 9.3 What "Improving Strategy" Means (Realistically)

The expected improvement from memory is **not** transforming a losing strategy into a winning one. If the base signal has 0% edge, memory will converge to that truth and stop trading (edge_bps will fall below min_edge_bps). The value of memory is:

1. **Reducing false positives:** Calibration shows which gap/sigma buckets have inflated implied_prob. The bot stops trading those buckets.
2. **Concentrating on high-edge regimes:** Calibration shows which (regime, vol, time-of-day) combinations have the best realized edge. The bot sizes up there.
3. **Earlier detection of strategy failure:** Online calibration drift detection surfaces when the edge erodes, without waiting for a large drawdown.
4. **Providing a learning record** that justifies transitioning from dry-run to live: a calibration-validated track record is more meaningful than a raw win-rate count.

### 9.4 Safety: Memory Cannot Override the Gate

Every mechanism through which memory affects bot behavior passes through `evaluateGate`. The gate's caps and kill switches are applied after memory adjustment, not before. Even if memory pushes `adjusted_prob = 0.99`, the gate enforces:
- `max_size_usdc` cap
- `per_day_cap_usdc` circuit breaker
- `max_windows_per_hour`
- `paused` and `killed` flags
- `act_window_sec` timing gate

Memory informs the signal; the gate remains the safety backstop.

---

## 10. Phased Build Proposal

### Phase 1: Data Collection (Implement with Plan 2)

**Goal:** Log window features for every window, building the dataset without changing bot behavior.  
**Timing:** Implement concurrently with Plan 2 (Railway worker + live feeds + DB migration). Zero behavioral change.  
**What to build:**

1. **Migration `005_window_features.sql`** — the `window_features` table
2. **`packages/core/src/agent/memory.ts`** — `recordWindowFeatures()` only; no calibration logic yet
3. **Worker integration:** After emitting (or not emitting) a signal near each window's close, call `recordWindowFeatures()`
4. **Post-settlement hook:** After `short_windows.status = 'settled'`, enrich the `window_features` row with `actual_outcome`, `model_was_correct`, `final_gap_usdc`

**Deliverable:** Every window from the first live dry-run day produces a labeled row in `window_features`. Bot behavior: unchanged.

**Tests:** Unit test `recordWindowFeatures()` with a synthetic window; assert row written with correct feature values; assert no behavioral change when `adjustedImpliedProb` is not yet wired.

### Phase 2: Calibration Buckets (After ~500 Settled Windows, ~2 Weeks)

**Goal:** Activate regime-based calibration to improve implied_prob accuracy.  
**Timing:** After 2+ weeks of dry-run data, when primary calibration buckets have >= 30 observations.  
**What to build:**

1. **Migration `006_calibration_buckets.sql`** — the `calibration_buckets` table
2. **`memory.ts` additions:**
   - `computeVolRegime(recentVol, db)` — percentile lookup against rolling 30d history
   - `lookupCalibrationBucket(features, db)` — returns `{empirical_freq, count}`
   - `adjustedImpliedProb(baseProb, features, db)` — blended probability
   - `onSettlement(windowId, outcome, db)` — updates calibration bucket row with Laplace smoothing
3. **`signal.ts` modification:** Accept optional `memoryOverride` parameter (backward-compatible)
4. **Diagnostic view (optional):** SQL view or `/admin/memory` route showing calibration accuracy by bucket

**Deliverable:** Bot uses memory-adjusted implied_prob. Calibration weight scales from 0 to 0.3 as bucket count grows. Audit weekly.

**Tests:** Unit test `adjustedImpliedProb()` with synthetic calibration data; assert convergence toward empirical frequency as count grows; assert pass-through when count = 0.

### Phase 3: Vector Retrieval (Optional, After ~2,000+ Windows, ~3 Months)

**Goal:** Per-window KNN calibration using feature similarity, not just bucket lookup.  
**Timing:** After 2,000+ settled windows and only if Phase 2 shows meaningful calibration benefit.  
**What to build:**

1. Enable pgvector on Railway Postgres (`CREATE EXTENSION IF NOT EXISTS vector`)
2. Add `feature_vector vector(9)` column to `window_features`
3. **`memory.ts` addition:** `findSimilarWindows(features, k=20, db)` — HNSW nearest-neighbor search; returns empirical_freq of K results
4. Add γ term to blending formula when K result count is sufficient (K >= 15)

**Deliverable:** Bot uses three-source blended probability: Gaussian + calibration bucket + KNN.

### Phase 4: GBDT Model (Optional, After ~5,000+ Windows, ~6 Months)

**Goal:** Replace the blended calibration with a trained gradient boosting classifier.  
**Timing:** Only after > 5,000 labeled windows with diverse market conditions (multiple vol regimes, multiple market environments).  
**What to build:**

1. Export `window_features` to a training dataset
2. Train `XGBoostClassifier` or `LightGBM` on feature vector → `model_was_correct` target
3. Calibrate with isotonic regression on a held-out time-series validation set
4. Serialize the model (ONNX or JSON lookup table for portability) and load in the worker
5. Replace blended calibration with model inference in `adjustedImpliedProb()`

**Note:** Phase 4 is not on the critical path. Phase 2 calibration buckets alone can provide significant improvement at a fraction of the complexity. Do not rush to Phase 4.

---

## 11. Schema Additions

### 11.1 `window_features` Table (Phase 1, migration 005)

```sql
CREATE TABLE IF NOT EXISTS window_features (
  id                    BIGSERIAL PRIMARY KEY,
  window_id             BIGINT NOT NULL REFERENCES short_windows(id),
  signal_id             BIGINT REFERENCES short_signals(id),      -- null if no signal emitted
  bot_config_id         BIGINT REFERENCES short_bot_configs(id),

  -- core signal model inputs (from signal.ts PriceState + MarketQuote)
  gap_usdc              DOUBLE PRECISION NOT NULL,
  gap_pct               DOUBLE PRECISION NOT NULL,
  gap_sigma_ratio       DOUBLE PRECISION NOT NULL,
  gap_sigma_bucket      INTEGER NOT NULL,   -- floor(clamp(gap_sigma_ratio, -4, 4))
  implied_prob          DOUBLE PRECISION NOT NULL,
  market_prob           DOUBLE PRECISION NOT NULL,
  edge_bps              INTEGER NOT NULL,
  seconds_to_close      INTEGER NOT NULL,
  recent_vol_per_sec    DOUBLE PRECISION NOT NULL,

  -- vol regime
  vol_regime            TEXT NOT NULL DEFAULT 'normal',   -- low | normal | high
  vol_regime_pct        DOUBLE PRECISION,                -- percentile rank in 30d distribution

  -- momentum context
  momentum_sign_60s     INTEGER,     -- -1 | 0 | 1
  momentum_sign_300s    INTEGER,

  -- microstructure features (nullable: not always available)
  ob_imbalance          DOUBLE PRECISION,   -- order book imbalance at L1
  trade_flow_imbalance  DOUBLE PRECISION,   -- aggressor buy/sell imbalance, last 30s

  -- time features
  hour_utc              INTEGER NOT NULL,
  day_of_week           INTEGER NOT NULL,
  venue                 TEXT NOT NULL,
  interval_sec          INTEGER NOT NULL,

  -- decision outcome
  signal_emitted        BOOLEAN NOT NULL DEFAULT false,
  trade_taken           BOOLEAN NOT NULL DEFAULT false,

  -- outcome (filled after settlement)
  actual_outcome        TEXT,               -- up | down | null until settled
  final_gap_usdc        DOUBLE PRECISION,
  model_was_correct     BOOLEAN,            -- null until settled
  pnl_usdc              DOUBLE PRECISION,   -- null until settled

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at            TIMESTAMPTZ,

  UNIQUE (window_id, bot_config_id)
);

CREATE INDEX ON window_features (vol_regime, gap_sigma_bucket, venue, interval_sec);
CREATE INDEX ON window_features (venue, interval_sec, model_was_correct)
  WHERE model_was_correct IS NOT NULL;
CREATE INDEX ON window_features (created_at DESC);
```

### 11.2 `calibration_buckets` Table (Phase 2, migration 006)

```sql
CREATE TABLE IF NOT EXISTS calibration_buckets (
  id                BIGSERIAL PRIMARY KEY,
  venue             TEXT NOT NULL,
  interval_sec      INTEGER NOT NULL,
  vol_regime        TEXT NOT NULL,        -- low | normal | high
  gap_sigma_bucket  INTEGER NOT NULL,     -- -4 .. 4
  hour_bucket       INTEGER,              -- NULL = all hours; 0..23 for time-of-day split

  count             INTEGER NOT NULL DEFAULT 0,
  sum_correct       INTEGER NOT NULL DEFAULT 0,
  empirical_freq    DOUBLE PRECISION,     -- (sum_correct + 1) / (count + 2), Laplace-smoothed
  last_updated_at   TIMESTAMPTZ,

  UNIQUE (venue, interval_sec, vol_regime, gap_sigma_bucket, hour_bucket)
);
```

### 11.3 pgvector Column Addition (Phase 3, migration 007)

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add feature vector column to window_features
ALTER TABLE window_features
  ADD COLUMN IF NOT EXISTS feature_vector vector(9);

-- HNSW index for approximate nearest-neighbor search
-- Only over settled windows with known outcomes
CREATE INDEX ON window_features
  USING hnsw (feature_vector vector_cosine_ops)
  WHERE model_was_correct IS NOT NULL;
```

---

## 12. Safety Posture

The memory system introduces no new safety risk when these invariants are maintained:

1. **Memory is read-only at decision time.** It provides `adjusted_prob` to `evaluateSignal`; it does not modify `botState`, gate thresholds, or kill switches.

2. **DB unavailability = pass-through.** If Railway Postgres is unavailable when `adjustedImpliedProb()` is called, the function returns `base_prob` without error. A try/catch wrapper in the worker enforces this. No memory failure can halt the bot or cause it to trade incorrectly.

3. **Sparse buckets = zero influence.** The blending weight formula `min(count/100, 0.3)` guarantees zero memory influence when a bucket has zero observations. This is not configurable without a code change.

4. **No memory influence on real money until validated.** The dry-run proof gate (minimum period + minimum settled trade count, defined in the design spec) applies before live trading is unlocked. The calibration accuracy gate (`calibration_error < 5 bps` in primary buckets) is an additional condition.

5. **Window_features log entries are immutable at decision time.** The feature snapshot is written once and never modified. Only `actual_outcome`, `model_was_correct`, `pnl_usdc`, `settled_at` are filled in post-settlement. This preserves the integrity of the historical record and prevents the training data from being contaminated by post-hoc edits.

6. **No circular dependency.** The memory layer reads from `window_features` (historical data) to influence the current decision. It writes the current decision's features to `window_features` after the read step. This ordering is sequential within a single window's lifecycle; there is no dependency between the current decision and the current write.

7. **Memory budget.** At 288 windows/day (5-min on Polymarket) + ~96/day (15-min on Kalshi), the total is ~384 rows/day or ~140,000 rows/year. Each row is ~20 columns of floats + a small text enum. Estimated storage: ~100 bytes/row → ~14 MB/year. This is negligible; no archiving or pruning strategy is needed in the first year.
