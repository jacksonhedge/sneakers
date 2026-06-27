# Predexon call prep — Thursday 2026-05-07

You're leaning toward signing. Goal of the call is **(a) negotiate the best deal you can** and **(b) de-risk the cutover.** Not "should I sign" — that's already settled.

## Walk-in framing

Sneakers Terminal is potentially one of their biggest customers and a perfect case study:
- Multi-venue prediction-market product (12+ venues vs their 6)
- Paying-customer pipeline (100-tester push, iOS in build, Pro $39 / Elite $99 / Business $299 tiers ready)
- Active engineering — you've already shipped 17 perf+UX commits in the last 24h
- Public site at sneakersterminal.com, real users, real revenue path

That's a lot of value to bring to a small API company. Use it.

## What you're actually buying

Three things, in order of value to you:

1. **Replace painful scrapers** — Polymarket (timed out at 5min yesterday, parallelization patch is a band-aid) and Opinion (broken, exit 1 for days, also requires a USDT-on-BNB-Chain dance for their direct API). Predexon owns these pipelines.
2. **Smart-money / wallet PnL analytics** — a feature you don't have today. Top wallets by realized PnL, profitable cohort tracking, smart-money positioning. Real differentiator for the Pro/Elite tier.
3. **Polymarket Trading API** — sidesteps the embedded-wallet decision blocking Phase 1B autotrade. Worth probing, may not need today.

## Negotiation playbook

**Asks, ranked by leverage:**

1. **Pilot pricing** — 60-90 day Pro tier ($249/mo) at 50% off or free, in exchange for a written case study + logo on their site. Easy ask, easy yes for them.
2. **Founder-to-founder volume discount** — annual prepay at Pro tier = 25–30% off ($249 → ~$175). Standard SaaS move.
3. **Lock pricing** — get the current pricing locked for 12-18 months in writing. They're early, they'll raise prices. Lock now.
4. **Custom tier above Dev / below Pro** — if you don't need 100 r/s but Dev's 1M req/mo is too tight, ask for a custom $99-149/mo middle tier. They don't have to publish it.
5. **Partnership data swap** — you have working scrapers for 6 venues they DON'T cover (NoVig, ProphetX, OG, Hyperliquid, PrizePicks, Underdog, etc.). Offer to sell them anonymized/aggregated data or pricing-tier insights as a 2-way relationship. Not pushing for this on day 1 but float it.
6. **Source attribution** — if you become a customer + data swap partner, ask for "Powered by Predexon for Polymarket data" co-branding on your venue pages → reduces their CAC + makes them stickier with you.

**Things to NOT give up:**

- Don't commit to multi-year. Annual max.
- Don't agree to exclusivity (you should be free to add other data sources).
- Don't let them write SLA requirements on your side (uptime, etc) — you're the customer.
- Don't share your full scraper codebase or canonical-matching logic — that's your IP. (Memory: your team-aliases work is differentiated.)

## Technical questions to validate live

Have a Sneakers admin tab open during the call. Run these in real time:

1. **"Show me the Polymarket markets endpoint."**
   - Compare to your live scrape output: how many markets? How fresh is the latest observation? Same shape (yes/no outcomes, best_bid/best_ask, volume, liquidity, starts_at, resolves_at)?
   - **What you're testing:** does the data match what you have today, with no gaps?

2. **"What's the freshness guarantee on Polymarket prices?"**
   - You scrape every 10 min. If Predexon is slower than that, it's a downgrade. If they have websocket streaming with sub-second updates, it's an upgrade.

3. **"What's your historical retention?"**
   - You have ~10 days of price_observations on Railway right now (post-crash). What do they have? 30 days? 90? Forever?

4. **"What's your downtime track record? Any outages in the last 90 days?"**
   - Real answer matters. If they say "never," they're either lying or new. Both are useful signals.

5. **"What happens to my data if you pivot, get acquired, or shut down?"**
   - Specifically: do they have a data-export API so you can rehydrate Railway from their historical store if you need to leave?

6. **"What's on your roadmap for venues we cover that you don't?"**
   - NoVig, ProphetX, OG, Hyperliquid, OddsAPI sportsbooks. If they say "next quarter," you can plan around it. If they say "not interested," you keep your scrapers as a moat.

7. **"Smart-money analytics — what's the actual data source?"**
   - Are they pulling on-chain wallet data themselves? Buying it from Nansen/Arkham? Computing PnL from public Polymarket fills? The answer tells you how durable that feature is.

## Decision tree exiting the call

| Outcome | Action |
|---|---|
| They give you Pro at <$150/mo locked for 12mo + clean Polymarket data parity | Sign on the call |
| They give you Free tier + clean Polymarket parity, no smart-money | Sign Free, run parallel for 2 weeks, upgrade to Pro after value validated |
| Polymarket data is materially worse than your scrape | Walk. Use only smart-money tier if compelling. |
| Smart-money offering is vaporware (light data, mostly marketing) | Free tier only |

## Cutover plan (post-signing, separate work)

Don't shut off your Polymarket scraper on day 1. Phased:

1. **Week 1**: Add Predexon Polymarket as a parallel source. Write to a `source_redundancy` table or just compare counts. Verify data parity over 7 days.
2. **Week 2**: Switch reads to Predexon, keep scraper writing as fallback. Monitor for any divergence.
3. **Week 3**: Disable the scraper. Save the code in a branch in case you need to bring it back.

Same shape for Opinion. The OG / ProphetX / NoVig / etc scrapers stay regardless.

## What you need to bring to the call

- Live admin tab on sneakersterminal.com (data parity test)
- Your venue coverage list to compare side-by-side
- Their pricing page already pulled up
- 2-3 bullet pitch on Sneakers Terminal so they understand what they're partnering with (helps you negotiate)
- A signed-NDA-or-not decision before you share user counts / revenue numbers

## After the call

If you sign, drop me the contract terms + start the parallel-run experiment. I'll write the integration code and a Chrome verify prompt for the data-parity check.
