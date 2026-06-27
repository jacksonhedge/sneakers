# Sneakers Wallet — Vendor Decision

*Researched: 2026-05-15*
*Status: pending pick. Phase 1 scaffold (`/dashboard/wallet`) is vendor-agnostic at the UI layer; phase 1.5 = real rails swap-in.*

## TL;DR

For a college-trader product depositing fiat to USDC on Polygon, **Coinbase CDP wins on cost and chain-fit** (0% USDC fees, Polymarket itself uses it, native embedded-wallet SDK), while **MoonPay wins on speed-to-launch and revenue transparency** (published 0.5–1.25% partner-set affiliate fee, faster KYB, no "if your app qualifies" gate). If you want to monetize the onramp per-transaction in week one, MoonPay. If you want zero user-visible friction and are willing to apply through a sales funnel, CDP.

**Recommendation:** Start with **MoonPay** for phase 1 deposit/withdraw, plan a **CDP migration** for phase 2 once traction justifies it. Architect the wallet so the onramp provider is swappable behind a thin interface.

## Side-by-side

| Dimension | Coinbase CDP Onramp + Embedded Wallets | MoonPay Ramps |
|---|---|---|
| Revenue share | **Not publicly disclosed.** Each partner gets a "custom, non-public fee schedule" baked into the exchange-rate quote. Zero-fee USDC route exists but is gated by Coinbase approval ("our team will be in touch if your app qualifies"). | **Published.** Partners add an affiliate fee of **0.5%–1.25%** on top of MoonPay's base fee (base typically ~1%, capped 0–10%). Fee amount + payout address negotiated with a Partner Success Manager. Affiliate program also pays referral commission via Impact platform. |
| Integration shape | Two modes: **Coinbase-hosted widget** or **headless API** (embedded Apple Pay / Google Pay). Separate **CDP Embedded Wallets SDK** (GA, with React Native) for white-label wallet with built-in onramp, swaps, and USDC yield. | **Web SDK** with five layouts: overlay, new tab, new window, embedded iframe, or drawer. Also an in-app webview pattern for mobile. No fully headless API — widget is the integration unit. |
| White-label scope | Embedded Wallets SDK is true white-label (you own the UI). The Onramp widget itself carries Coinbase branding; headless mode lets you wrap it. | Theme-based: custom colors, links, highlighted text, **your logo on login**. Themes are provisioned by MoonPay (you submit, they build the `themeId`). Widget chrome stays MoonPay-branded inside. |
| KYC handling | **Coinbase fully owns it.** Existing Coinbase users skip re-KYC (huge UX win for the demographic that already has Coinbase). Coinbase holds MTLs in most US states + is the merchant of record. | **MoonPay fully owns it.** Registered FinCEN MSB, MTLs in required US states, FCA-registered in UK, 5AMLD-compliant in EU. Merchant of record for chargebacks/fraud. Users KYC with MoonPay even if KYC'd with you. |
| Supported output chains | Polygon, Ethereum, Solana, Base, Optimism, Arbitrum, Avalanche, Bitcoin + more. **Zero-fee USDC** specifically on Ethereum, Polygon, Solana. | Polygon, Solana, Ethereum, Base, Arbitrum, Optimism, BNB, Avalanche, Bitcoin, TRON. Checkout product claims 30+ chains. |
| Geo availability | 90+ countries; US-state coverage exposed via Config API (live list). Coinbase publishes prohibited regions separately. | Global; supports most major US states (specific exclusions exposed via support docs, not a single public list). |
| Eligibility / approval | Self-serve sandbox + dev keys exist, but **zero-fee USDC and best terms are gated** behind a Coinbase application + their outreach. KYB required. Timeline not published. | Self-serve dashboard, API keys, **KYB required** to go live and to enable affiliate-fee customization. Rejection reasons published (low traffic, off-target geo, brand misalignment, voucher sites). |
| Live integration examples | **Polymarket, OpenSea, World App (Worldcoin)** — Polymarket especially relevant since your USDC-on-Polygon flow mirrors theirs exactly. | Uniswap, MetaMask, Trust Wallet, Bitget, Moonshot (9-chain integration), OpenSea historically. Broader long-tail of wallet/dapp integrations. |

## Coinbase deep notes

- **Embedded Wallets SDK is GA as of 2025** — non-custodial wallet you white-label, with onramp + swaps + USDC yield (4.1% APY referenced in launch post) built in. Email/social login, no extension, React Native support shipped.
- **Polymarket precedent is the strongest signal in this whole comparison.** Same user demographic, same chain (Polygon), same flow (fiat → USDC → app). If they made it work, our KYC/regulatory surface is largely solved by following their pattern.
- Onramp fee model: Coinbase charges the user; partner's economics are inside the quote. There is no published "you get X bps." You negotiate.
- Headless mode (Apple/Google Pay) is the most native UX — no widget at all, just a Pay button.

## MoonPay deep notes

- **Concrete revenue mechanic:** after KYB, you add **0.5%–1.25%** affiliate fee on top of MoonPay's fee, captured on each order to your payout address. Cleanest "monetize the onramp" path of the two vendors.
- Base MoonPay fee is **~1% typical, 4.5% for direct users, 0–10% range**. Effective user-visible fee = MoonPay base + your affiliate markup.
- Widget customization is real but bounded — you submit a theme, they build it. Not a CSS file you edit.
- KYC is non-reusable: even if a user is verified with you, they re-verify with MoonPay. Worse first-time UX than Coinbase-for-existing-Coinbase-users, equivalent for everyone else.
- MoonPay open-sourced their wallet layer in 2025 for the "agent economy" — signal they're investing in developer surface, not just consumer brand.

## Where the data ran out

- **Coinbase partner revenue share %** — never published, explicitly per-partner. Requires sales call.
- **Coinbase approval timeline and revenue minimums** — not published.
- **MoonPay partner affiliate referral commission %** (the Impact-platform side, separate from the per-transaction affiliate fee) — not published.
- **MoonPay-specific US state exclusions** — exposed only via support articles per-region, no single matrix.

## What this means for the wallet scaffold

The scaffold shipped on `feat/sneakers-wallet-scaffold` (`/dashboard/wallet`) is **already vendor-agnostic at the UI layer** — it just renders a balance + Deposit/Withdraw modals against mock data. Phase 1.5 is:

1. Sign up with the chosen vendor (self-serve sandbox initially).
2. Add env vars (`NEXT_PUBLIC_MOONPAY_API_KEY` + secret, or `COINBASE_CDP_API_KEY` + secret).
3. Wrap the chosen vendor's widget in the existing Deposit / Withdraw modals.
4. Add a thin `WalletProvider` TypeScript interface so the swap from MoonPay → CDP later is a single-file change.
5. Backend: a `user_wallet_balances` table + `user_wallet_transactions` table, plus a webhook receiver for vendor → us settle/failure notifications.
6. KYB application starts in parallel (gating real go-live regardless of vendor).

## Sources

- https://docs.cdp.coinbase.com/onramp/introduction/welcome
- https://docs.cdp.coinbase.com/onramp/additional-resources/layer-2-networks
- https://www.coinbase.com/developer-platform/discover/launches/zero-fee-usdc
- https://www.coinbase.com/developer-platform/products/embeddedwallets
- https://www.coinbase.com/developer-platform/discover/launches/embedded-wallets-ga
- https://www.coinbase.com/developer-platform/discover/launches/onramp-api
- https://dev.moonpay.com/v1.0/docs/on-ramp-overview
- https://dev.moonpay.com/docs/customize-the-widgets-appearance
- https://www.moonpay.com/business/ramps
- https://www.moonpay.com/legal/pricing_disclosure
- https://www.moonpay.com/newsroom/moonpay-affiliate-program
- https://support.moonpay.com/en/articles/388702-moonpay-partner-faqs
