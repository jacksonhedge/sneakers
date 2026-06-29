# BTC Short-Window Analysis: Predicting Up/Down Over 5/10/15-Minute Horizons

**Date:** 2026-06-29  
**Status:** Research reference for the Sneakers Agent signal engine  
**Scope:** Everything needed to understand, model, and honestly assess edge in BTC up/down prediction markets

---

## Table of Contents

1. [The Target Markets](#1-the-target-markets)
2. [Settlement Oracle Architecture](#2-settlement-oracle-architecture)
3. [Volatility Estimators for Ultra-Short Horizons](#3-volatility-estimators-for-ultra-short-horizons)
4. [Technical Indicators at Sub-15-Minute Scale](#4-technical-indicators-at-sub-15-minute-scale)
5. [Market Microstructure and Order Flow](#5-market-microstructure-and-order-flow)
6. [ML / Statistical Approaches](#6-ml--statistical-approaches)
7. [Data Sources and Feeds](#7-data-sources-and-feeds)
8. [Existing Tools and Prior Art](#8-existing-tools-and-prior-art)
9. [Honest Edge Assessment](#9-honest-edge-assessment)
10. [References](#10-references)

---

## 1. The Target Markets

### 1.1 Polymarket BTC 5-Minute Markets

Polymarket launched BTC up/down 5-minute markets on February 12, 2026. As of launch there are 288 windows per day (24/7, continuous). The market asks: "Will the Chainlink BTC/USD price at T+300s be ≥ its price at T=0?" If yes, "Up" wins; if no, "Down" wins. There is no tie; ≥ open price resolves "Up."

**Volume:** Has reached up to $60M/day in daily turnover, making it among Polymarket's most active markets. Combined 5- and 15-minute crypto market volume has exceeded $4B total since launch, with $153M+ average daily volume across all crypto interval markets after Chainlink integration. ([CoinMarketCap](https://coinmarketcap.com/academy/article/polymarket-debuts-5-minute-bitcoin-prediction-markets-with-instant-settlement), [CryptoRank](https://cryptorank.io/news/feed/ac145-polymarket-crypto-prediction-markets-volume))

**Settlement timing:** Approximately 128 seconds after window close, Chainlink Automation triggers the on-chain settlement smart contract on Polygon, which reads the relevant Chainlink Data Stream report and distributes USDC to winners. There is a 64-block confirmation requirement (~2 minutes) before USDC distributions complete. ([BlockEden](https://blockeden.xyz/forum/t/deep-dive-how-chainlink-data-streams-power-polymarkets-5-minute-settlement-oracle-architecture-for-high-frequency-prediction-markets/786))

**Liquidity per window:** Typically $5K–$50K in orderbook depth per window, making larger size challenging without slippage. Thin liquidity windows (< $1K) should be skipped. ([Medium/BenjaminCup](https://benjamincup.medium.com/unlocking-edges-in-polymarkets-5-minute-crypto-markets-last-second-dynamics-bot-strategies-and-db8efcb5c196))

**Order execution:** Polymarket uses a hybrid CLOB with an off-chain matching engine. Orders go to the off-chain engine which pairs compatible bids/asks. There is **blockchain latency of 2–5 seconds** for Polygon confirmation. This hard constraint means the realistic last-entry window is 15–30 seconds before close, not the final 5 seconds. ([Polymarket docs](https://docs.polymarket.com/api-reference/introduction), [Medium/BenjaminCup](https://benjamincup.medium.com/unlocking-edges-in-polymarkets-5-minute-crypto-markets-last-second-dynamics-bot-strategies-and-db8efcb5c196))

**Fees:** Approximately 1.56% at a $0.50 entry price. This is a meaningful transaction cost that consumes theoretical edges — live trading losses have confirmed that a 2–6% modeled edge is insufficient when combined with 2–4 cent slippage per token. ([Medium/gwrx2005](https://medium.com/@gwrx2005/ai-augmented-arbitrage-in-short-duration-prediction-markets-live-trading-analysis-of-polymarkets-8ce1b8c5f362))

### 1.2 Kalshi BTC 15-Minute Markets

Kalshi's `KXBTC15M` opens a fresh BTC up/down contract every 15 minutes, 24/7. These are CFTC-regulated binary event contracts on a Designated Contract Market (DCM) authorized since November 2020.

**Settlement:** Kalshi uses the **CF Benchmarks Bitcoin Real-Time Index (BRTI)**, sampled once per second for the final 60 seconds of the window. The official settlement price is the average of those 60 per-second RTI values. Some contracts apply trimmed averaging (excluding the top and bottom 20% of observations) for additional manipulation resistance. ([CF Benchmarks blog](https://www.cfbenchmarks.com/blog/kalshi-leads-surging-crypto-event-contract-market-powered-by-cf-benchmarks), [PredictionMarketsPicks](https://predictionmarketspicks.com/articles/kalshi-bitcoin-markets-by-frequency))

**Settlement distinction from Polymarket:** Polymarket uses a single Chainlink pull-oracle price snapshot at T=300. Kalshi uses a 60-second TWAP of the BRTI. This is a material difference: the BRTI average is more manipulation-resistant but also harder to predict from a single spot price. A strategy calibrated on the Chainlink snapshot cannot be directly ported to the Kalshi settlement.

**CF Benchmarks authority:** CF Benchmarks is a UK FCA-authorized benchmark administrator; the same BRTI underlies CME Bitcoin futures and BlackRock's IBIT spot ETF. It aggregates from multiple major exchanges with robust methodology.

### 1.3 Reference-Price Parity — The #1 Technical Risk

The signal engine's core logic computes `impliedProbUp` from `(current_spot − open_ref_price) / (recentVolPerSec × sqrt(secondsToClose))`. Two reference-price mismatches can blow up this model:

1. **Open reference price mismatch:** `open_ref_price` must be the same Chainlink Data Streams snapshot that the settlement contract records at T=0, not a coincident Binance/Coinbase price that may differ by $10–50.

2. **Current spot mismatch:** The spot feed used to compute the gap should reference the same oracle family. Using Binance mid-price instead of Chainlink DS price introduces basis risk. Chainlink Data Streams delivers a **Liquidity-Weighted Bid and Ask (LWBA)** mid that aggregates across multiple exchanges — it is not identical to any single exchange's mid.

**Mitigation:** Subscribe directly to Chainlink Data Streams (REST/WebSocket SDK) for both the open snapshot and the live price. Treat any other spot feed as secondary, directional context only. Do not trade a signal computed on the wrong reference.

---

## 2. Settlement Oracle Architecture

### 2.1 Chainlink Data Streams (Polymarket)

Chainlink Data Streams is a **pull-based oracle**: instead of continuously pushing prices on-chain, it generates cryptographically signed price reports off-chain at sub-second intervals. A consumer (Polymarket's settlement contract, or a bot's monitoring process) requests a specific report via REST or WebSocket, verifies the DON (Decentralized Oracle Network) signatures, and then uses the data on-chain.

**Key properties:**
- Sub-second latency for report generation
- Reports include: mid price, LWBA prices, volatility, and liquidity metrics
- Cryptographic signatures allow on-chain verification without trusting the relay
- High Availability mode with automatic failover for zero-downtime
- Access via REST API, WebSocket streaming, or language-specific SDKs (Go, Rust, TypeScript)
- Price reports aggregate from multiple exchanges (exact composition not publicly disclosed)

([Chainlink Data Streams docs](https://docs.chain.link/data-streams), [Chainlink.com](https://chain.link/data-streams))

**Practical implication for the bot:** Chainlink Data Streams are a paid/permissioned product at the direct-API level. However, the Chainlink-powered Polymarket market data (observable via Polymarket's CLOB and Gamma APIs) reflects this oracle's values with minimal lag. The bot can use the Polymarket API's published prices to infer the Chainlink DS mid for cost efficiency, but should ideally confirm the direct DS feed to close the basis gap during the critical last-seconds window.

### 2.2 CF Benchmarks BRTI (Kalshi)

The Bitcoin Real-Time Index (BRTI) is published once per second, drawn from volume-weighted contribution prices across major constituent exchanges (Coinbase, Bitstamp, Binance, etc., per CF Benchmarks methodology). The Kalshi settlement averages 60 consecutive per-second BRTI values ending at the contract expiry time.

**Practical implication:** For Kalshi 15-min markets, the "reference price" at close is not a point-in-time value but a 60-second TWAP. This makes last-second arbitrage harder (the average is locked before the final second). However, if BTC is clearly directional in the final minute, the 60 values will all be on one side, and the average is approximately equivalent to any point in that minute.

### 2.3 Oracle Latency as a Source of Edge

The central thesis of the Sneakers Agent signal engine is **oracle-lag arbitrage**: the prediction market odds lag the spot oracle by 10–30 seconds near window close. The Chainlink Data Streams oracle updates on a heartbeat (approximately every 10–30 seconds or on a 0.5% deviation threshold for older price feed contracts — Data Streams is faster, but the prediction market UI/CLOB may not reflect the absolute latest report instantly).

~15–20% of 5-minute periods resolve based on movements in the **final 10 seconds**. A bot that monitors the Chainlink DS feed in real time can detect when the gap between open_ref_price and current_spot clearly implies one outcome, while the prediction market YES/NO prices still reflect a less-informed state. ([Medium/BenjaminCup](https://benjamincup.medium.com/unlocking-edges-in-polymarkets-5-minute-crypto-markets-last-second-dynamics-bot-strategies-and-db8efcb5c196))

---

## 3. Volatility Estimators for Ultra-Short Horizons

The `impliedProbUp` function in `packages/core/src/agent/signal.ts` uses a Gaussian diffusion model:

```
P(up) = Φ(gap / (recentVolPerSec × √secondsToClose))
```

This is mathematically correct under the assumption that BTC price follows a Brownian motion. The quality of the edge estimate hinges entirely on the quality of `recentVolPerSec`. Here is a catalog of methods, from simplest to most sophisticated.

### 3.1 Close-to-Close Realized Volatility

The simplest estimator: take the last N one-second returns, square them, sum, and take the square root.

```
σ_1s = sqrt(mean(r_i²))   for i = 1..N (e.g., N=60 or N=300)
recentVolPerSec = σ_1s
```

**Pros:** Simple, low computation, always available from any tick feed.  
**Cons:** Badly biased by bid-ask bounce at 1-second frequency. Includes microstructure noise. Underestimates true volatility when the market is between ticks.  
**Verdict:** Acceptable starting point for dry-run; microstructure noise at 1s frequency is a known issue but partially averages out over many windows.

### 3.2 EWMA Volatility

```
σ²_t = λ × σ²_{t-1} + (1-λ) × r_t²
```

With λ ≈ 0.94 (RiskMetrics daily; for per-second data, calibrate λ to achieve the desired half-life, e.g., λ ≈ 0.998 for a 5-minute half-life).

**Pros:** Weights recent observations more; adapts to volatility clustering; computationally trivial.  
**Cons:** Exponential decay means old regime information is never fully dropped; choice of λ is opaque.  
**Verdict:** Best simple improvement over close-to-close. Implement as default v1.5 after dry-run data accumulates.

([Layman's Guide to Volatility Forecasting — CAIA](https://caia.org/blog/2024/11/02/laymans-guide-volatility-forecasting-predicting-future-one-day-time))

### 3.3 Range-Based Estimators (Parkinson, Garman-Klass)

These use OHLC bar data (not tick data) and extract more information than close-to-close from the same bar.

**Parkinson estimator** (uses High and Low only):
```
σ²_P = (1 / (4N ln2)) × Σ (ln(H_i/L_i))²
```
Approximately 5× more efficient than close-to-close.

**Garman-Klass estimator** (uses OHLC):
```
σ²_GK = Σ [0.5(ln H_i/L_i)² − (2ln2−1)(ln C_i/O_i)²]
```
Approximately 7.4× more efficient than close-to-close.

**Degradation at high frequency:** Range-based estimators work well at hourly and daily bars, but degrade significantly at 1-second to 1-minute bars due to microstructure effects — bid-ask bounce, discrete price increments, non-synchronous trading. They are most reliable on 5-minute OHLC bars. For the Sneakers bot's per-second volatility estimate, these are best applied to 1-minute OHLC bars (60 bars per hour) rather than raw tick data.

([Ryan O'Connell CFA](https://ryanoconnellfinance.com/historical-volatility-estimators/), [Martens & Van Dijk, 2007](https://repub.eur.nl/pub/7582/ei2006-10.pdf))

### 3.4 Realized Variance from High-Frequency Returns

Andersen & Bollerslev (1998) introduced realized variance (RV) as the sum of squared intraday returns:

```
RV = Σ r_{t,i}²   (i = 1..M intraday intervals)
```

On 1-second BTC data, this dramatically outperforms daily squared returns for estimating integrated variance. However, at tick-by-tick or 1-second frequency, microstructure noise dominates. The "optimal" sampling frequency for BTC to balance noise vs. information loss is typically 5–30 seconds. 

**For our use:** Use 10-second returns (30 per 5-minute window) to compute a rolling RV that feeds into `recentVolPerSec`. This avoids the worst bid-ask bounce effects while still being near-real-time.

### 3.5 Volatility Regime Classification

The `recentVolPerSec` estimate works well in a stable vol regime but misleads during regime transitions. Volatility exhibits strong clustering: high-vol periods tend to persist; low-vol periods tend to persist. Tagging each window with a **vol regime** (low / normal / high, based on percentile of recent EWMA vol history) is a prerequisite for the super-memory system and for setting appropriate edge thresholds.

**Practical detection:**
- Maintain a rolling 24-hour history of per-window vol estimates
- Compute 20th / 80th percentiles as regime boundaries
- Tag windows with `vol_regime: low | normal | high`

This is not ML-level complexity — it is a simple running quantile, but it dramatically improves the signal quality of the `implied_prob` estimate.

### 3.6 The Normal Distribution Assumption — Honest Assessment

The Gaussian diffusion model (`normCdf`) is a known simplification. BTC returns exhibit:
- **Fat tails:** Jump risk is material even at 5-minute horizons
- **Skewness:** Asymmetric behavior during flash crashes vs. squeezes
- **Intraday seasonality:** Volatility is higher at market open (NYSE), lower on weekends

**Implication:** The model systematically **underprices tail risk**. When `gap/sigma` is large (say, > 2), the Gaussian model gives `impliedProb = 0.977`, suggesting near-certainty. In reality, the probability of a reversal is higher than the Gaussian implies due to fat tails. The `min_edge_bps` gate and conservative act windows partially mitigate this, but the model is not accurate in the tails.

**Upgrade path (post-dry-run):** Replace `normCdf` with an empirically calibrated function fitted to historical 5-minute outcomes by gap/sigma bucket. This is the single highest-value improvement to the signal model after dry-run data accumulates.

---

## 4. Technical Indicators at Sub-15-Minute Scale

### 4.1 Honest Context: What Technical Indicators Can and Cannot Do Here

At 5–15-minute horizons on a liquid asset like BTC, the predictive content of lagging technical indicators is weak. The prediction market itself aggregates sentiment, and sophisticated participants already incorporate momentum, RSI, and VWAP signals. Using simple TA on 5-minute candles is **not a durable edge** at this horizon.

The strongest evidence comes from live trading: a bot that allocated 65% weight to 60-second momentum achieved a 25–27% win rate — far below the ≈53% breakeven threshold needed to cover fees. ([Medium/gwrx2005](https://medium.com/@gwrx2005/ai-augmented-arbitrage-in-short-duration-prediction-markets-live-trading-analysis-of-polymarkets-8ce1b8c5f362))

**That said**, technical indicators have limited but real use cases here:

1. As **filters** (not signals): Block trading into a confirmed counter-trend state
2. As **regime labels**: Tag windows with trend context for the memory system
3. As **features** for a microstructure ML model (not as standalone signals)

### 4.2 VWAP Deviation

VWAP = Volume-Weighted Average Price since the start of the "session" (for crypto, typically anchored to midnight UTC or the window start).

**For the 5-minute window:** An intra-window VWAP can be computed from the stream of trade prices and sizes as the window progresses. At close, `price / VWAP_window` is one signal.

**Empirical evidence:** VWAP standard deviation bands show a ~63% mean-reversion rate from 2-standard-deviation extensions across intraday equity data. For BTC on 4-hour charts, Glassnode (2023) found VWAP levels provided reliable support/resistance ~56% of the time. At 5-minute resolution, this effect is weaker and not documented in peer-reviewed literature.

**Honest use:** VWAP deviation within the window is marginally useful as a feature for "has this window been extremely one-sided?" — not as a standalone trading signal.

([Bitfinex blog](https://blog.bitfinex.com/education/chart-decoder-series-vwap-the-markets-truth-detector/), [Mudrex](https://mudrex.com/learn/vwap-in-crypto/))

### 4.3 RSI and Bollinger Bands at 1s–1m

RSI (Relative Strength Index) and Bollinger Bands computed on 1-second to 1-minute candles do have one documented use: **they identify momentum state** at the time of the window open. A window that opens after a 3-consecutive-minute up-run has a different baseline probability than one that opens mid-range.

**What works:** Adding a 10-minute trend filter (simple: is current price > or < its price 10 minutes ago?) as a hard counter-trend block improved one live bot's loss rate by 7× while reducing capital deployed. ([Medium/gwrx2005](https://medium.com/@gwrx2005/ai-augmented-arbitrage-in-short-duration-prediction-markets-live-trading-analysis-of-polymarkets-8ce1b8c5f362))

**What doesn't work:** Using short-window RSI or Bollinger crossovers as buy/sell signals at 1-minute resolution for 5-minute markets. The signal-to-noise ratio is too low.

### 4.4 Microtrend Detection

Detecting the direction of price movement in the 5 minutes preceding the window open is a credible feature for regime labeling, even if not for direct signal generation. The pattern is simple: compute the sign of `price_now - price_5min_ago` and `price_now - price_1min_ago`. Agree = trend window; disagree = reversal/choppy window.

**Horizon alignment issue:** Technical indicators that look back farther than the window itself are making a claim that prior momentum persists, which is a regime-conditional claim. In trending markets this may be true; in mean-reverting markets it is false. Vol regime tagging resolves this.

---

## 5. Market Microstructure and Order Flow

This is where real, durable edge in short-interval crypto prediction markets comes from. The signal engine's gap/vol model captures the last-second oracle-lag piece; microstructure feeds amplify it.

### 5.1 Order Book Imbalance (OBI)

Order Book Imbalance at the top of book is defined as:

```
OBI = (BidVolume_L1 - AskVolume_L1) / (BidVolume_L1 + AskVolume_L1)
```

**Predictive power:** OBI has a near-linear relationship with short-horizon price changes, especially within tens of seconds. Queue imbalance at best bid/offer predicts the next mid-price move. This is one of the most robust findings in microstructure literature.

**For BTC specifically:** A 2025 study (Springer Nature) using multivariate Hawkes processes on Binance LOB data found LOB event streams meaningfully improve short-term return forecasts over naive baselines. A 2025 paper on explainable cryptocurrency microstructure found order flow imbalance is the single most important predictive feature across BTC, LTC, ETC, ENJ, and ROSE, validated on 1-second Binance Futures data from January 2022 through October 2025. ([arXiv:2602.00776](https://arxiv.org/html/2602.00776v1))

**Practical feed:** Binance BTC/USDT spot or perpetuals L2 order book via WebSocket provides real-time bid/ask depth at multiple levels. The Coinbase Advanced Trade WebSocket offers similar data. Both are free and public.

### 5.2 Trade Flow / Aggressor Imbalance

Trade flow imbalance tracks whether incoming market orders are predominantly buyer-initiated (aggressor buys) or seller-initiated (aggressor sells):

```
TradeImbalance = (BuyVolume - SellVolume) / (BuyVolume + SellVolume)
```

**Predictive power:** Market orders are the main driver of short-term price movements. Prices tend to rise when there are more active buyers than sellers. VPIN (Volume-Synchronized Probability of Informed Trading) — a proxy for order flow toxicity — significantly predicts future price jumps in Bitcoin. ([ScienceDirect](https://www.sciencedirect.com/article/pii/S0275531925004192), [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10040314/))

**Practical feed:** Both Binance and Coinbase WebSocket trade streams tag each trade with the aggressor side (`m` field in Binance, `side` in Coinbase). Volume-Adjusted Mid-Price (VAMP) computed from these feeds outperforms OBI-adjusted mid-prices in multiple studies.

### 5.3 Lead-Lag Across Venues: Which Exchange Leads?

Not all BTC price feeds are created equal for the purpose of predicting the next oracle update.

**Established findings:**
- Binance (spot and perpetuals) carries the largest global BTC volume and **tends to lead** other venues on price discovery.
- Coinbase (US spot) plays a secondary price-discovery role; it leads smaller venues but lags Binance in the majority of intraday intervals.
- Low-volume exchanges tend to lag higher-volume ones by observable margins.
- Recent research (2025, Zenodo) shows Bitcoin demonstrates CEX leadership at 5-minute leads across both Binance and Coinbase.

([SEC price discovery exhibit](https://www.sec.gov/files/rules/sro/nysearca/2021/34-93445-ex3a.pdf), [Zenodo](https://zenodo.org/records/17084252))

**For the bot:** Monitor Binance BTC/USDT spot mid-price as the primary leading indicator. Coinbase is secondary. The Chainlink DS oracle aggregates from multiple sources and will reflect Binance price with a lag that depends on the DS heartbeat/deviation threshold.

**Perpetual futures lead:** Perpetual futures prices on Binance Granger-cause spot prices in most intraday regimes. Perpetual funding rate direction and size is a secondary regime indicator (positive funding = longs paying shorts = net long positioning pressure).

### 5.4 The "Last-Second Mispricing" Dynamic

This is the central edge thesis. In a live 5-minute window:

1. BTC moves during the window, creating a `gap = current_spot - open_ref_price`
2. The prediction market YES/NO prices update as the gap changes, but with lag
3. In the final 15–30 seconds, if the gap is large relative to remaining-window volatility, the Gaussian model gives `impliedProb ≈ 0.95–0.99`
4. But market makers pull liquidity as close approaches (depth decay near resolution is a documented finding in prediction market microstructure), leaving YES prices at 0.88–0.92 as stale quotes
5. The bot buys the lagging side at those stale prices

**Depth decay evidence:** Research on the Polymarket order book found that depth concentration among top market makers, combined with latency-sensitive behavior near resolution, produces a pattern where effective spreads widen and depth decreases in the final seconds. Specifically, market participants with superior real-time venue data face adversarial selection from order-book participants. ([arXiv:2604.24366](https://arxiv.org/html/2604.24366v1))

**Wealth transfer finding:** In Polymarket's financial markets (including crypto), market makers capture approximately +1.12% returns at the expense of takers (-1.12%). Finance category markets have the tightest pricing efficiency (0.17 pp gap vs. implied probability). This means the bot operates in near-efficient territory; the edge, when it exists, is small and structural, not large and exploitable with generic signals. ([jbecker.dev](https://www.jbecker.dev/research/prediction-market-microstructure))

### 5.5 Microstructure Findings on Polymarket Specifically

The paper "The Anatomy of a Decentralized Prediction Market" ([arXiv:2604.24366](https://arxiv.org/html/2604.24366v1)) identifies eight stylized facts about Polymarket's order book:

1. Longshot contracts have elevated bid-ask spreads (consistent with adverse selection at extreme prices)
2. Order book depth follows a relatively uniform distribution (not top-heavy)
3. No statistically significant relationship between trades and regular time intervals (not clock-driven)
4. Wide distribution of market makers with concentrated top-maker activity
5. Effective spreads vary significantly across prediction market categories
6. **Median 50ms latency between market events and data feed ingestion, with occasional multi-second lags** — this is actionable: bots with direct on-chain monitoring can see events before the CLOB feed reflects them
7. Self-trading is low (~1% median) relative to unregulated crypto venues
8. Market duration, price level, and volume explain cross-sectional depth variations

**Critical finding:** Trade direction inference from public order-book feeds achieves only ~59% accuracy compared to on-chain records. This means microstructure analysis from the public CLOB feed has meaningful data quality limitations.

---

## 6. ML / Statistical Approaches

### 6.1 The Strong Baseline: Near-Efficient Markets

The most important honest finding before building any ML model: **5-minute BTC binary options appear to be nearly efficiently priced.** Live trading evidence:

- Session 1 (v2 engine): 26.7% win rate; −49.5% ROI
- Session 2 (v3 engine, with 10-min trend filter): 25% win rate; −13.4% ROI
- Combined: 33% win rate vs. 53% breakeven threshold

The author concludes: "5-minute BTC binary options are efficiently priced." ([Medium/gwrx2005](https://medium.com/@gwrx2005/ai-augmented-arbitrage-in-short-duration-prediction-markets-live-trading-analysis-of-polymarkets-8ce1b8c5f362))

The `paper-to-live gap` is severe: paper trading predicted 522× returns in 60-minute sessions; live execution produced −49.5% losses. This gap is driven by: fees, slippage (2–4¢/token live vs. zero paper), and overfitting to backtested signals.

**Implication for the Sneakers bot:** The goal of the dry-run period is precisely to measure this gap with real market data, before any real money is at risk. The signal engine's architecture is sound; the calibration of `recentVolPerSec` and `min_edge_bps` must be learned empirically, not assumed.

### 6.2 Logistic Regression on Engineered Features

**Established approach:** Fit logistic regression on features extracted from order book snapshots + trade flow to predict next-period price direction.

**Feature candidates:**
- OBI at L1, L2, L3 (bid/ask imbalance at multiple levels)
- Trade flow imbalance (last N seconds)
- `gap / sigma` at decision time (the signal.ts variable)
- `secondsToClose` 
- Vol regime tag (low/normal/high)
- Time-of-day (UTC hour), day-of-week
- Momentum: sign(price_60s_change), sign(price_300s_change)

**Academic evidence:** A 2020 study found logistic regression, random forest, and gradient boosting were commonly evaluated for short-term cryptocurrency direction prediction. GBC consistently outperformed LR at 5-minute horizons. ([ACM](https://dl.acm.org/doi/fullHtml/10.1145/3446569.3446588), [arXiv:1805.08550](https://arxiv.org/pdf/1805.08550))

**Important caveat:** Most published accuracy numbers (60–82%) are on daily or longer horizons, or use in-sample/lookahead-biased evaluation. Rigorously walk-forward evaluated 5-minute direction accuracy at sub-5% edge is all that can be realistically hoped for. A deep LSTM on LOB data achieved ~60% on 1-second price changes and ~62% on 10-second changes — modest but material.

### 6.3 Gradient Boosting (XGBoost / LightGBM / CatBoost)

Gradient boosting decision trees (GBDTs) consistently outperform logistic regression and simple neural networks for tabular feature prediction at short horizons.

**Why GBDTs work here:**
- Can capture non-linear interactions between features (e.g., OBI matters more in low-vol regimes than high-vol)
- Robust to scale differences between features
- Fast inference (microseconds per prediction)
- Interpretable via SHAP values

**Evidence:** The "Explainable Patterns in Cryptocurrency Microstructure" study used CatBoost with SHAP on 1-second Binance Futures data and found stable, universal feature importance rankings across assets. ([arXiv:2602.00776](https://arxiv.org/html/2602.00776v1))

**Build path:** Once dry-run data accumulates (500+ settled windows), train a GBDT classifier on the feature vector at each signal-emission time. The target is `outcome ∈ {0, 1}` (down/up). Use time-series cross-validation (expanding window, no leakage). Calibrate outputs with isotonic regression for accurate probabilities.

### 6.4 Sequence Models (LSTM, Temporal CNN, Transformers)

These models operate on the sequence of price ticks or LOB snapshots leading up to the decision moment, rather than on a snapshot feature vector.

**LSTM on tick data:**
- Deep LSTM on LOB achieved ~60% accuracy at 1-second horizon, ~62% at 10-second horizon
- Sequence models can capture temporal autocorrelation in order flow that GBDTs miss
- Require significantly more data (tens of thousands of windows minimum) and more compute

**Transformers:**
- An LSTM-Transformer model tested at 5, 10, 15, 20, 25, 30-minute intervals showed lower MSE than standard LSTM/GRU
- Directional accuracy of ~72% was reported on OHLC data (not tick data; likely overfit to test set)
- For practical use, transformers add substantial complexity without proven superiority over GBDTs on tabular/engineered features at 5-minute horizons

([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12048165/), [arXiv:2309.11400](https://arxiv.org/pdf/2309.11400))

**Honest assessment:** Sequence models are research territory for this use case. Start with GBDTs. Add sequence models only after a solid feature-based baseline exists and you have at least 2,000+ labeled windows.

### 6.5 Calibration

All ML models should output calibrated probabilities, not raw scores. The signal engine needs `implied_prob` to be accurate — if the model outputs 0.85 but true frequency is 0.72, the `edge_bps` estimate is wrong and the gate will overtrade.

**Calibration method:** Platt scaling (logistic regression on raw scores) or isotonic regression. Use a held-out calibration set (not the training set). Check with reliability diagrams.

**Online calibration:** As new settled windows accumulate, update the calibration map (specifically: by `gap/sigma` bucket and vol regime) using a sliding window of the last N settled windows. This is the simplest form of online learning described in the super-memory design.

([arXiv:2311.12436](https://arxiv.org/pdf/2311.12436), [Online Isotonic Regression](https://arxiv.org/pdf/1603.04190))

---

## 7. Data Sources and Feeds

### 7.1 Chainlink Data Streams (Settlement Oracle)

- **What it is:** Pull-based oracle with sub-second latency; the source of truth for Polymarket settlement
- **Access:** REST API + WebSocket SDK; requires Chainlink partnership/access for direct integration
- **BTC/USD stream:** `data.chain.link/streams/btc-usd-cexprice-streams` (observable; direct subscription may require credentials)
- **Alternative:** Monitor Polymarket's published `open_ref_price` and `settle_ref_price` fields via the CLOB/Gamma API as a proxy — they are the actual Chainlink values used in settlement

([Chainlink docs](https://docs.chain.link/data-streams), [Chainlink stream page](https://data.chain.link/streams/btc-usd-cexprice-streams))

### 7.2 Polymarket CLOB + Gamma API

- **Gamma API** (public, no auth): `https://gamma-api.polymarket.com` — markets, events, tags, series
- **CLOB API** (public for reads, auth for orders): `https://clob.polymarket.com` — orderbook data, pricing, midpoints, spreads, price history, order placement
- **WebSocket:** `wss://ws-subscriptions-clob.polymarket.com/ws/market` — real-time order book and trade updates
- The Gamma API returns market metadata including the `question` (which encodes the open ref price for each window), resolution rules, and current YES/NO token prices

([Polymarket docs](https://docs.polymarket.com/api-reference/introduction), [pm.wiki](https://pm.wiki/learn/polymarket-api))

### 7.3 Kalshi REST + WebSocket API

- Requires an account and API key even for market data (public read with authenticated key)
- REST endpoints for market listings, prices, order placement
- WebSocket for real-time price streaming
- The service account connection (one per Sneakers instance, not per user) is sufficient for Rung 1 data ingestion

### 7.4 Binance BTC/USDT WebSocket

- **Spot L2 order book:** `wss://stream.binance.com:9443/ws/btcusdt@depth` — real-time bid/ask depth at multiple levels
- **Trade stream:** `wss://stream.binance.com:9443/ws/btcusdt@trade` — every trade with aggressor side, price, quantity
- **1-second klines:** `wss://stream.binance.com:9443/ws/btcusdt@kline_1s` — 1-second OHLCV
- No authentication required for public market data streams

### 7.5 Coinbase Advanced Trade WebSocket

- Public channels for BTC-USD: `ticker`, `level2` (order book), `matches` (trades)
- Provides redundant spot price feed for cross-validation with Binance
- Useful for detecting lead-lag: if Coinbase moves 200ms after Binance, the Chainlink DS oracle (which aggregates both) may update with a composite lag

### 7.6 CF Benchmarks BRTI (for Kalshi)

- CF Benchmarks publishes BRTI values; accessible via CF Benchmarks API (requires account)
- Alternative: Kalshi's own market data reflects the BRTI that will be used for settlement

---

## 8. Existing Tools and Prior Art

### 8.1 Official Polymarket Agent Framework

- **Repo:** [github.com/Polymarket/agents](https://github.com/Polymarket/agents)
- A developer framework for building AI agents on Polymarket. Includes API interaction utilities, news retrieval, LLM prompting, and trade execution. Designed for general prediction markets (news-driven), not specifically for 5-minute price markets.

### 8.2 Polybot (Reverse-Engineered Infrastructure)

- **Repo:** [github.com/ent0n29/polybot](https://github.com/ent0n29/polybot)
- Described as "reverse-engineering of every Polymarket strategy and high-frequency trading infrastructure." Includes a complete-set arbitrage strategy for Polymarket Up/Down binaries. Useful reference for understanding existing bot ecosystem and what strategies are already in the market.

### 8.3 OctoBot Prediction Market

- **Repo:** [github.com/Drakkar-Software/OctoBot-Prediction-Market](https://github.com/Drakkar-Software/OctoBot-Prediction-Market)
- Open-source Polymarket trading bot built on the OctoBot framework. Supports copy trading and automated strategy execution. Not specifically optimized for 5-minute crypto markets.

### 8.4 Polymarket BTC 15-Minute Trading Bot (7-Phase Architecture)

- **Repo:** [github.com/aulekator/Polymarket-BTC-15-Minute-Trading-Bot](https://github.com/aulekator/Polymarket-BTC-15-Minute-Trading-Bot)
- A production-grade bot using a 7-phase pipeline: data ingestion (Coinbase, Binance, news, Solana) → signal processing (spike detection, sentiment, price divergence) → risk management → execution → self-learning (weight optimization feedback loop). Uses weighted voting fusion. The feedback loop adjusts signal weights from historical performance. Demonstrates the general architecture of a production prediction-market bot.

### 8.5 Poly-Maker (Market Making)

- **Repo:** [github.com/warproxxx/poly-maker](https://github.com/warproxxx/poly-maker)
- Automated market making for Polymarket. Provides liquidity on both sides with configurable spread parameters. Relevant because understanding the market maker's behavior near close is essential for the taker strategy.

### 8.6 Academic Microstructure Papers

- **"The Anatomy of a Decentralized Prediction Market"** ([arXiv:2604.24366](https://arxiv.org/html/2604.24366v1)): First rigorous LOB microstructure study of Polymarket. Eight stylized facts including depth decay, latency, and maker concentration.

- **"Explainable Patterns in Cryptocurrency Microstructure"** ([arXiv:2602.00776](https://arxiv.org/html/2602.00776v1)): Universal LOB + trade-flow feature importance rankings validated on 1-second Binance data. CatBoost + SHAP. Order flow imbalance is #1.

- **"The Microstructure of Wealth Transfer in Prediction Markets"** ([jbecker.dev](https://www.jbecker.dev/research/prediction-market-microstructure)): Documents the +1.12% maker / −1.12% taker wealth transfer; optimism tax at longshot YES contracts; efficiency varies by category.

- **"Bitcoin wild moves: Evidence from order flow toxicity and price jumps"** ([ScienceDirect](https://www.sciencedirect.com/article/pii/S0275531925004192)): VPIN predicts BTC price jumps.

- **"Mind the Gaps: Short-Term Crypto Price Prediction"** ([SSRN:4351947](https://papers.ssrn.com/sol3/Delivery.cfm/SSRN_ID4351947_code5427994.pdf)): OBI and trade imbalance features for short-horizon crypto prediction.

### 8.7 PolyBackTest

- **Site:** [polybacktest.com](https://polybacktest.com/polymarket-up-down-gamma-trading-strategy-backtest)
- A backtesting tool for Polymarket Up/Down gamma trading strategies. Useful for validating dry-run results against historical market data.

---

## 9. Honest Edge Assessment

### 9.1 Where a Real, Durable Edge Plausibly Exists

**A. Oracle-parity speed (highest confidence)**  
The edge that the Sneakers Agent is built around. When BTC's spot price clearly implies a near-certain outcome (large gap relative to remaining-window vol), but the prediction market YES/NO prices still reflect an older, less-certain state, there is a structural mispricing. This lag is real, documented, and arises from:
- Blockchain latency on the market-maker side
- Market makers pulling depth near close
- Information asymmetry between fast spot feeds and slower oracle updates

**Constraint:** The realistic entry window is 15–30 seconds before close (not 5 seconds, due to 2–5s Polygon latency). The `act_window_sec` gate already implements this.

**Durability:** This edge is structural and will persist as long as there is some lag between spot price movement and prediction market price update. It may compress as more sophisticated bots enter. The `min_edge_bps` gate protects against degraded edge conditions.

**B. Order-flow lead (medium confidence)**  
Monitoring Binance LOB imbalance and aggressor trade flow provides a few-seconds lead on Chainlink DS oracle updates. A large buy-side trade imbalance spike predicts that the oracle's next update will be up. This is micro-lag arbitrage at the oracle-feed level, not the prediction-market level.

**Constraint:** Requires a reliable, low-latency Binance WebSocket connection with < 200ms round-trip. The signal must be integrated within the same decision cycle as the spot/oracle feed comparison.

**Durability:** Medium. As more HFT firms add Chainlink DS feed monitoring, this micro-lag shrinks. Still exploitable for a small-scale bot below HFT capacity.

**C. Vol regime / time-of-day effects (low-medium confidence)**  
There is evidence that some time windows are systematically harder to predict (high vol, choppy markets) and some systematically easier (clear directional momentum, low vol). The signal engine can add value by selectively sitting out the noisy windows and concentrating on high-edge windows.

**Durability:** High. This is not edge over other traders; it is edge from avoiding bad bets. The `min_edge_bps` gate already implements this, but per-regime thresholds would be more precise.

### 9.2 Where Edge Likely Does Not Exist

**Generic TA on 5-minute candles:**  
RSI, MACD, Bollinger Bands applied to 5-minute OHLC data as primary trading signals: no durable edge, comprehensively demonstrated by live trading results with 25–27% win rates far below breakeven.

**Sentiment / news-based signals:**  
At 5-minute resolution, news events are already priced within seconds of release. Fear & Greed index, social sentiment, and similar low-frequency signals lag the actual market by entire windows.

**ML models trained on OHLC alone:**  
Published 60–82% "accuracy" numbers for cryptocurrency direction prediction are overwhelmingly on daily horizons with in-sample or near-in-sample evaluation. At 5-minute horizons, walk-forward validated accuracy above 52–53% on OHLCalone is not reliably documented in peer-reviewed literature.

**Bet sizing large on high-confidence predictions:**  
The Gaussian model's apparent "99% certainty" in large-gap / near-close situations is misleading due to fat tails and microstructure noise. The Execution Gate's `max_size_usdc` cap is essential.

### 9.3 The Core Quantitative Summary

From backtesting and limited live data:
- Gap/vol model (the existing signal): ~55–60% win rate in simulations; live evidence is mixed (25–27% in unsophisticated versions, likely higher with oracle-parity speed)
- Transaction cost breakeven: ~53% win rate at typical Polymarket fees
- Net edge after fees: thin — estimated 2–7% above random in ideal conditions
- Annual ROI at 1% risk per trade, 100 trades/day, 55% win rate: ~20–50% (simulation); live results are far less, likely 0–15% net

These are not large edges. The value of the system is in:
1. Running dry-run to establish whether the edge is real for this bot in these conditions
2. Operating only when `edge_bps` is large (the gate does this)
3. Memory-conditioning to improve over time

---

## 10. References

| # | Source | URL |
|---|--------|-----|
| 1 | Polymarket 5-min BTC launch — CoinMarketCap | https://coinmarketcap.com/academy/article/polymarket-debuts-5-minute-bitcoin-prediction-markets-with-instant-settlement |
| 2 | Chainlink Data Streams — Polymarket oracle architecture (BlockEden) | https://blockeden.xyz/forum/t/deep-dive-how-chainlink-data-streams-power-polymarkets-5-minute-settlement-oracle-architecture-for-high-frequency-prediction-markets/786 |
| 3 | Unlocking Edges in Polymarket 5-min markets (BenjaminCup) | https://benjamincup.medium.com/unlocking-edges-in-polymarkets-5-minute-crypto-markets-last-second-dynamics-bot-strategies-and-db8efcb5c196 |
| 4 | AI-Augmented Arbitrage live trading analysis (gwrx2005) | https://medium.com/@gwrx2005/ai-augmented-arbitrage-in-short-duration-prediction-markets-live-trading-analysis-of-polymarkets-8ce1b8c5f362 |
| 5 | $60M daily flow (ainvest) | https://www.ainvest.com/news/polymarket-5-minute-btc-markets-60m-daily-flow-speed-sentiment-2603/ |
| 6 | Chainlink Data Streams documentation | https://docs.chain.link/data-streams |
| 7 | BTC/USD Chainlink stream | https://data.chain.link/streams/btc-usd-cexprice-streams |
| 8 | Kalshi BTC 15-min markets guide | https://predictionmarketspicks.com/articles/kalshi-bitcoin-markets-by-frequency |
| 9 | CF Benchmarks powers Kalshi | https://www.cfbenchmarks.com/blog/kalshi-leads-surging-crypto-event-contract-market-powered-by-cf-benchmarks |
| 10 | Kalshi KXBTC15M | https://kalshi.com/markets/kxbtc15m/bitcoin-price-up-down |
| 11 | Anatomy of Decentralized Prediction Market (Polymarket LOB microstructure) | https://arxiv.org/html/2604.24366v1 |
| 12 | Microstructure of Wealth Transfer in Prediction Markets (jbecker.dev) | https://www.jbecker.dev/research/prediction-market-microstructure |
| 13 | Explainable Patterns in Cryptocurrency Microstructure | https://arxiv.org/html/2602.00776v1 |
| 14 | Order book imbalance prediction tutorial (hftbacktest) | https://hftbacktest.readthedocs.io/en/latest/tutorials/Market%20Making%20with%20Alpha%20-%20Order%20Book%20Imbalance.html |
| 15 | Bitcoin wild moves: VPIN and price jumps | https://www.sciencedirect.com/article/pii/S0275531925004192 |
| 16 | Nowcasting bitcoin crash risk with order imbalance | https://pmc.ncbi.nlm.nih.gov/articles/PMC10040314/ |
| 17 | Forecasting BTC with Hawkes processes and LOB | https://link.springer.com/article/10.1007/s10203-026-00570-z |
| 18 | Historical Volatility: Parkinson, Garman-Klass (Ryan O'Connell) | https://ryanoconnellfinance.com/historical-volatility-estimators/ |
| 19 | Layman's Guide to Volatility Forecasting (CAIA) | https://caia.org/blog/2024/11/02/laymans-guide-volatility-forecasting-predicting-future-one-day-time |
| 20 | Price Discovery in Bitcoin Market (SEC exhibit 3A) | https://www.sec.gov/files/rules/sro/nysearca/2021/34-93445-ex3a.pdf |
| 21 | Price Discovery — Decentralized vs Centralized CEX Lead-Lag | https://zenodo.org/records/17084252 |
| 22 | Polymarket docs — CLOB API | https://docs.polymarket.com/api-reference/introduction |
| 23 | Polymarket API guide — Gamma + CLOB | https://pm.wiki/learn/polymarket-api |
| 24 | Polymarket GitHub — rs-clob-client | https://github.com/Polymarket/rs-clob-client |
| 25 | Polymarket/agents (official AI agent framework) | https://github.com/Polymarket/agents |
| 26 | polybot (HFT infrastructure reverse-engineering) | https://github.com/ent0n29/polybot |
| 27 | OctoBot Prediction Market | https://github.com/Drakkar-Software/OctoBot-Prediction-Market |
| 28 | Polymarket BTC 15M Trading Bot (7-phase) | https://github.com/aulekator/Polymarket-BTC-15-Minute-Trading-Bot |
| 29 | poly-maker (market making) | https://github.com/warproxxx/poly-maker |
| 30 | LSTM-Transformer for BTC direction | https://pmc.ncbi.nlm.nih.gov/articles/PMC12048165/ |
| 31 | Transformers vs LSTMs for electronic trading | https://arxiv.org/pdf/2309.11400 |
| 32 | Online isotonic regression for calibration | https://arxiv.org/pdf/1603.04190 |
| 33 | Multivariate gradient boosting for BTC volatility | https://arxiv.org/html/2511.20105v1 |
| 34 | My Journey Building a Polymarket BTC Engine (Kaustubh Patange) | https://kaustubhpatange.medium.com/my-journey-building-a-polymarket-btc-trading-engine-577436189a3b |
| 35 | PolyBackTest backtesting tool | https://polybacktest.com/polymarket-up-down-gamma-trading-strategy-backtest |
| 36 | HFT in Crypto: Latency, Infrastructure, Reality | https://medium.com/@laostjen/high-frequency-trading-in-crypto-latency-infrastructure-and-reality-594e994132fd |
| 37 | 5-Minute BTC Bots vs Retail (dyutam) | https://dyutam.com/news/polymarket-5-minute-bitcoin-bets-60m-bots-retail/ |
| 38 | Do Prediction Markets Match Option Prices? BTC Evidence from Binance and Polymarket | https://arxiv.org/html/2606.19517 |
| 39 | Exploring Microstructural Dynamics in Cryptocurrency LOBs: Better Inputs > Stacking Layers | https://arxiv.org/html/2506.05764v2 |
| 40 | PolySwarm: Multi-Agent LLM Framework for Latency Arbitrage | https://arxiv.org/html/2604.03888v1 |
| 41 | Systematic Edges in Prediction Markets (QuantPedia) | https://quantpedia.com/systematic-edges-in-prediction-markets/ |
| 42 | Polymarket/py-clob-client (archived) | https://github.com/Polymarket/py-clob-client |
| 43 | Exploiting Mean-Reversion in Decentralized Prediction Markets (QuantPedia) | https://quantpedia.com/exploiting-mean-reversion-in-decentralized-prediction-markets-evidence-from-polymarket-binary-contracts/ |
| 44 | Interpreting Prediction Market Prices as Probabilities (NBER WP #12200) | https://www.nber.org/system/files/working_papers/w12200/w12200.pdf |
| 45 | Kalshi BTC 15-Minute Markets Settlement Details (KalshiBackTest) | https://kalshibacktest.com/resources/kalshi-btc-15-minute-markets |
| 46 | Kalshi API Developer Guide (Zuplo) | https://zuplo.com/learning-center/kalshi-api |
| 47 | kalshi-crypto-bot GitHub (kapelame) | https://github.com/kapelame/kalshi-crypto-bot |
| 48 | Evaluating ML Models for Crypto Price Forecasting (PMC 2025) | https://pmc.ncbi.nlm.nih.gov/articles/PMC12571449/ |
| 49 | Deep Learning for Bitcoin Direction Prediction (Financial Innovation) | https://jfin-swufe.springeropen.com/articles/10.1186/s40854-024-00643-1 |

---

## 11. June 2026 Research Update — New Findings & Additions

*This section integrates findings from new research conducted June 2026, adding material not covered in the original document above.*

### 11.1 Chainlink Data Streams: Architecture Specifics

Direct documentation fetch from Chainlink reveals the following technical specifics not covered in third-party summaries:

**Pull vs. Push distinction:**
- Traditional Chainlink Price Feeds (push-based) update on "0.5% price deviation or every 3600 seconds, whichever comes first" — far too slow for 5-minute windows
- Data Streams (pull-based) generate reports off-chain continuously at sub-second cadence; a consumer fetches the report only when needed via REST or WebSocket SDK
- Each report is cryptographically signed by the Chainlink DON; on-chain settlement contracts verify signatures without trusting the relay

**What the DON does:** The Decentralized Oracle Network (DON) is a committee of off-chain nodes that independently fetch prices from contributing exchanges, aggregate them, and sign the resulting report. The report is then stored in a retrieval layer. The exact DON composition (node count, contributing exchanges) is not publicly documented per the Chainlink docs.

**Settlement on Polygon:** Chainlink Automation triggers the settlement contract at each 5-minute mark. The contract fetches the relevant Data Streams report for both T=0 and T=300, compares prices, and distributes USDC. A 64-block confirmation requirement (~2 minutes on Polygon PoS) precedes distribution. If no valid oracle report is available at settlement time, the market resolves as a draw.

**Bot access cost:** Data Streams is an enterprise product. There is no documented free tier. The public `data.chain.link/streams/btc-usd-cexprice-streams` page is observable but direct API subscription requires a Chainlink partnership. For the Sneakers bot, using Polymarket's published `open_ref_price` and `settle_ref_price` fields (which reflect the actual Chainlink values used) is the practical access path.

Source: [Chainlink Data Streams Docs](https://docs.chain.link/data-streams), [BlockEden Deep Dive](https://blockeden.xyz/forum/t/deep-dive-how-chainlink-data-streams-power-polymarkets-5-minute-settlement-oracle-architecture-for-high-frequency-prediction-markets/786)

### 11.2 Kalshi Settlement: Trimmed-Average Methodology

The CF Benchmarks blog confirms: Kalshi's settlement applies a trimmed average (excluding top and bottom 20% of the 60 per-second readings) specifically to reduce "expiry-pinning risk" — the risk that a single large trade at the settlement moment spikes the reference price. This means:

1. A single-second BTC spike cannot swing the Kalshi settlement price if 24 of the 60 readings are excluded
2. A BTC move must be **sustained across most of the final 60 seconds** to definitively determine the outcome
3. For a Kalshi bot, the gap signal should ideally be computed against the **running partial average** of already-observed BRTI values in the settlement window, not just the current spot price

**Volume context:** Kalshi recorded approximately $4.5 billion in monthly trading activity as of late 2025, up from ~$1 billion per month in early 2025. The 5x growth in 12 months suggests rapidly improving liquidity but also more sophisticated participants.

Source: [CF Benchmarks — Kalshi Powered by CF Benchmarks](https://www.cfbenchmarks.com/blog/kalshi-leads-surging-crypto-event-contract-market-powered-by-cf-benchmarks)

### 11.3 New Academic Paper: Polymarket vs. Binance Option Pricing (arXiv:2606.19517)

This June 2026 paper is directly relevant to bot calibration. Key quantitative findings:

- **Persistent mispricing:** Polymarket "Yes" contracts trade at a **5.6 percentage point premium** to Binance options-implied risk-neutral probabilities (214 observations, p < 10⁻⁹)
- **Pooled finding:** Across three BTC contracts, the wedge is **6.3 pp** (287 observations)
- **Half-life of mispricing:** ~4 hours (AR(1) process, ADF test confirms mean reversion at p=0.004)
- **Cross-sectional pattern:** Mispricing is "largest when option-implied probability is low and time to expiry is long" — consistent with a favourite-longshot bias on Polymarket where retail users overprice unlikely outcomes
- **Economic exploitability:** A delta-hedged arbitrage proxy generated net profits of 1.113 after transaction costs (t=2.10, p=0.053, marginally significant)

**Implication for the bot:** Polymarket YES contracts are systematically slightly overpriced relative to fair value. This means:
- Don't buy YES contracts at face value as if they're calibrated probabilities
- When the normCDF model prices "Up" at 0.72 but Polymarket is trading YES at 0.78, the 6 pp gap may partly reflect this structural bias rather than an exploitable dislocation
- Conversely, when the model says 0.90 and Polymarket is at 0.84, the gap is net of this bias — stronger signal

Source: [arXiv:2606.19517 — Do Prediction Markets Match Option Prices?](https://arxiv.org/html/2606.19517)

### 11.4 New Academic Paper: LOB Microstructure Benchmark (arXiv:2506.05764)

This June 2026 paper benchmarks six model architectures on BTC limit order book data. Results directly applicable to the bot's feature engineering:

**Models tested and accuracy (at 500ms horizon with 40-level LOB):**
- XGBoost: 72% (top performer at this horizon)
- CatBoost: 70%
- CNN+LSTM (DeepLOB): 68%
- Simplified CNN+LSTM: 69%
- Logistic Regression: 71% (nearly matched XGBoost)
- CNN+XGBoost hybrid: 73%

**The headline conclusion:** "Simpler models can match and even exceed the performance of more complex networks." XGBoost and logistic regression were within 1–2% of deep learning architectures, while training in minutes vs. hours.

**Preprocessing finding:** Savitzky-Golay smoothing of the LOB time series "consistently improved performance across all models." Kalman filtering often degraded results due to rigid parameter tuning.

**Prediction horizon degradation:** Moving from 500ms to 100ms, all models dropped substantially (to 39–54%). The sub-second regime is harder to predict than the 500ms–1s regime.

**Practical takeaway for the Sneakers bot:** At 5–15 second decision horizons (the realistic entry window for last-second signals), logistic regression on 5-level OBI + trade flow is the appropriate starting model. Complex architectures are not justified at the data volumes a single-bot system accumulates.

Source: [arXiv:2506.05764 — Exploring Microstructural Dynamics in Cryptocurrency LOBs](https://arxiv.org/html/2506.05764v2)

### 11.5 New Academic Paper: Explainable Crypto Microstructure (arXiv:2602.00776)

This 2026 paper provides the most directly applicable microstructure findings for the bot. Running CatBoost with SHAP on 1-second Binance Futures data from January 2022 to October 2025 (covering multiple regimes including the October 2025 flash crash):

**Top-3 SHAP features (across all 5 tested assets):**
1. **Order flow imbalance** (net trade-initiated volume pressure) — dominates
2. **Bid-ask spread** (wider spread = diminished predictability, not a directional signal)
3. **VWAP-to-mid deviation** (buy pressure measured by where trades happened relative to mid)

**Quantitative performance:** Taker strategies showed annualized returns of 0.07% (LTC) to 7.00% (ROSE), with three assets statistically significant at 5%. BTC was not the strongest performer — consistent with BTC being the most efficiently priced asset.

**Feature definitions used in the paper:**
- OFI (Order Flow Imbalance): Net signed trade volume over a recent window; positive = net buying
- VWAP deviation: `(VWAP_30s - mid_price) / spread` — where VWAP is computed on last 30 seconds of trades
- The 3-second prediction horizon in this paper is faster than the bot's decision window, but the feature importance rankings generalize to longer horizons

**Cross-asset stability:** Feature importance ranks are correlated across all 5 assets, suggesting "scale-invariant microstructure" — the same features work on BTC, LTC, ETC. This validates building one feature pipeline rather than per-asset models.

Source: [arXiv:2602.00776 — Explainable Patterns in Cryptocurrency Microstructure](https://arxiv.org/html/2602.00776v1)

### 11.6 Live Bot Results: The Harshest Validation

The most honest live trading data available (Medium/@gwrx2005, "AI-Augmented Arbitrage," sessions logged in 2026):

| Session | Version | Wins | Losses | Win Rate | ROI |
|---|---|---|---|---|---|
| Session 1 | v2 engine | 4 | 11 | 27% | −49.5% |
| Session 2 | v3 engine | 1 | 3 | 25% | −13.4% |
| Paper trading | v2 | N/A | N/A | — | +52200% |

**Structural causes of the paper-to-live gap:**
1. Zero slippage in paper vs. 2–4 cents/token live (4–8% per round trip at $0.50 price)
2. Zero fees in paper vs. 1.56% per trade live
3. Directional bias: "80% of Session 1 trades bet UP in a DOWN-trending market" — momentum signals captured micro-bounces within a larger downtrend; the 10-minute trend filter in v3 was designed to fix this and partially did (ROI improved from −49.5% to −13.4%)
4. Adverse selection: limit orders filled at desired price means the market moved against the bot before fill

**Key engineering signals extracted:**

```
DISLOCATION signal: fires when BTC has moved >0.05% since window open
  AND Polymarket token price hasn't adjusted proportionally
  Requires: >5–10% edge after fees
  
DIRECTIONAL signal: fires in final 30 seconds
  Requires: composite confidence ≥0.45
  
MAKER signal: posts limit orders 2 cents below ask (20% rebate)
```

**Fractional Kelly sizing used:**
```
size = budget × min(edge / (1 - token_price), 0.25) × size_factor
```

Source: [Medium/gwrx2005 — AI-Augmented Arbitrage Live Trading](https://medium.com/@gwrx2005/ai-augmented-arbitrage-in-short-duration-prediction-markets-live-trading-analysis-of-polymarkets-8ce1b8c5f362)

### 11.7 Polymarket API: Critical Status Update (May 2026)

**`Polymarket/py-clob-client` is archived as of May 2026** and "no longer functional." The official replacement:
- `Polymarket/py-sdk` — unified SDK (REST + WebSocket combined)
- `Polymarket/py-clob-client-v2` — intermediate version, still functional

The `Polymarket/agents` LLM trading framework is also archived (May 2026). It used Langchain + OpenAI for strategy, not quant signals, and is not directly applicable to the Sneakers bot architecture.

**Three API rate limit tiers to know:**
- CLOB API (authenticated): 9,000 req/10s — use for order placement, book queries
- Gamma API (public): 4,000 req/10s — use for market discovery, price polling
- Data API (public): 1,000 req/10s — use for historical analytics

Source: [Polymarket/py-clob-client GitHub](https://github.com/Polymarket/py-clob-client), [Polymarket API Guide 2026](https://polymarkets.co.il/en/guide/api-guide/)

### 11.8 Kalshi API: Current State (2025–2026)

**Base URLs:**
- REST: `https://api.kalshi.com/trade-api/v2`
- WebSocket: `wss://api.kalshi.com/trade-api/ws/v2`

**Recent updates:**
- November 2025: `POST /portfolio/orders/batched` became GA (batch order placement)
- January 2025: Sharding support added to WebSocket for high-throughput consumers
- Auth tokens expire every 30 minutes

**Third-party tooling:**
- `kapelame/kalshi-crypto-bot` — Python framework specifically for Kalshi 15-min markets: collector, ML pipeline, backtester, live trader, terminal dashboard
- `pbeets/kalshi-trade-rs` — Rust client with WebSocket support; useful for lower-latency production

Source: [Kalshi API Changelog](https://docs.kalshi.com/changelog), [kalshi-crypto-bot GitHub](https://github.com/kapelame/kalshi-crypto-bot)

### 11.9 LSTM/Transformer Honest Assessment: Additional Evidence

From the arXiv:2309.11400 paper ("Transformers vs LSTMs for Electronic Trading"), comparing on BTC:

| Model | BTC RMSE |
|---|---|
| LSTM | 0.02224 |
| GRU | 0.02285 |
| Temporal Fusion Transformer (TFT) | 0.02353 |

LSTM marginally outperforms TFT on BTC. For ETH, TFT performs worse than LSTM (MSE 2.59× higher). The transformers literature on trading does not show a clear win over LSTMs as of 2023–2026.

**The deeper problem:** All these models are tested on regression (price level prediction) rather than binary direction classification. RMSE of 0.02 on a normalized price series doesn't translate to a known win rate on binary outcomes. The accuracy figures commonly cited in trading papers (72%, 82%, etc.) are on daily or longer horizons with feature engineering that looks suspiciously like in-sample optimization.

**The LOB study (arXiv:2506.05764) is the most honest benchmark** because it:
1. Uses binary classification (direction), not regression
2. Tests multiple architectures on identical data
3. Reports results at multiple prediction horizons
4. Uses proper train/val/test splits on time-series data

Its finding — logistic regression ≈ XGBoost ≈ CNN+LSTM at 500ms–1s horizons — is the result to trust.

### 11.10 Volatility Estimator Practical Guide

**Recommended implementation priority for the Sneakers bot:**

**Phase 1 (now):** Keep existing rolling std dev of 1-second returns. Add EWMA alongside it:
```python
# EWMA vol estimator, ~30-second half-life
LAMBDA = 0.977  # exp(-ln(2)/30)
ewma_var = LAMBDA * prev_ewma_var + (1 - LAMBDA) * return_1s**2
ewma_vol_per_sec = sqrt(ewma_var)
```
Use `min(rolling_vol, ewma_vol)` as the conservative estimate — take the lower of the two to avoid overconfidence.

**Phase 2 (after 30 days of dry-run):** Add Garman-Klass on 1-minute OHLC:
```python
# Garman-Klass estimator on N 1-minute bars
gk_var = mean([
    0.5 * (log(H/L))**2 - (2*log(2) - 1) * (log(C/O))**2
    for (O, H, L, C) in ohlc_bars
])
gk_vol_per_min = sqrt(gk_var)
gk_vol_per_sec = gk_vol_per_min / 60
```

**Phase 3 (after 90 days + ML model):** Replace normCDF with an empirically calibrated sigmoid fitted to historical `(gap/vol, outcome)` pairs by vol regime bucket.

### 11.11 Summary: Feature Importance Ranking for v2 Signal Engine

Based on all research above, ordered by documented strength of evidence:

| Rank | Feature | Evidence Level | Implementation Cost |
|---|---|---|---|
| 1 | Oracle-parity dislocation (gap vs. Chainlink oracle lag) | High — structural architectural fact | Medium (need oracle ref price tracking) |
| 2 | Signed trade flow imbalance (TFI, 30s window) | High — dominant SHAP feature in arXiv:2602.00776 | Low (Binance aggTrade WebSocket) |
| 3 | Order book imbalance OBI_5 (5-level depth) | High — confirmed across multiple papers | Low (Binance depth WebSocket) |
| 4 | VWAP-to-mid deviation (30s) | High — 3rd SHAP feature in arXiv:2602.00776 | Low (derived from trade stream) |
| 5 | EWMA vol regime tag (hot/normal/cold) | Medium — documented value as filter | Low (EWMA is trivial to add) |
| 6 | 10-minute trend direction filter | Medium — documented improvement in live bot | Low (simple price comparison) |
| 7 | Logistic regression on 1–6 above | Medium — performance validated in arXiv:2506.05764 | Medium (requires labeled data) |
| 8 | Garman-Klass vol on 1-min OHLC | Medium — efficient estimator but less validated at this horizon | Medium |
| 9 | XGBoost on 1–6 above | Medium — marginally better than logistic regression | Medium |
| 10 | RSI, MACD, Bollinger Bands | Low — no documented edge at 5-min horizon after fees | — (don't implement) |
| 11 | LSTM / Transformer on OHLCV | Low — hype exceeds evidence; fails at this data volume | High (don't implement yet) |
