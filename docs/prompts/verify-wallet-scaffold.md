# Verify Sneakers Wallet scaffold (PR #15, commit f8483de)

Background: phase 1 of the Sneakers Wallet — an internal embedded spend product. Vendor decision is **CoinFlow** (locked); this PR ships the *scaffold* (visual UI, mock data, stubbed flows) so we can feel the surface before any real money plumbing. Phase 1.5 swaps in CoinFlow rails after the account + sandbox keys are set up.

Visual direction is deliberate: **"Wimbledon Vault"** — deep emerald-noir surface, cream Fraunces serif for headlines + balance, Geist Mono ledger, brass `$` and accent, subtle fractal-noise grain, single-light-source vignette. This route should look and feel meaningfully different from the rest of `/dashboard` — it's the spend product, not a SaaS tab.

**Base URL (preview):** `https://sneakers-terminal-d4ytuz0ww-jackson-fitzgeralds-projects.vercel.app`

## ⛔ HARD RULE — no real money / billing CTAs

Same rule as the prior verifies. Do NOT click any landing-page payment / billing / trial / subscribe CTAs. Inside the wallet, the Deposit and Withdraw CTAs and the "Continue to CoinFlow" / "Review withdrawal" buttons are visibly disabled by design — they should not be clickable. If any of them are clickable, that's a finding (not an action to take).

## Step 0 — Sign in

`/dashboard/wallet` lives behind the dashboard auth gate. Go to `<BASE>/login`, sign in with **email + password** (NOT magic link — preview URL isn't in Supabase's redirect allowlist). If sign-in needs the user's password, **stop and hand the tab back**; the user signs in, then tells you to continue.

Once authed, navigate to `<BASE>/dashboard/wallet`.

## Step 1 — Page renders, dark vault aesthetic is intact

Report:
- Page loads (not a redirect to /signup)? y/n
- Background reads as deep emerald-noir (NOT the light stone-50 of the rest of the dashboard)? y/n
- Eyebrow row at top: left side reads "← Dashboard" / right side reads what verbatim? (expect: a small brass dot + "SNEAKERS VAULT" all-caps, letter-spaced)
- Is there a subtle warm glow visible in the top-left corner (single-light-source brass vignette)? y/n
- Does the surface have any visible grain/texture overlay, or does it look flat? (expect: subtle grain visible on close inspection)

## Step 2 — Balance hero typography

This is the make-or-break part of the design — the balance number should read as serif, premium, cream-and-brass; NOT generic sans-serif on green.

Report:
- Eyebrow above the balance reads what? (expect "YOUR BALANCE", all-caps, letter-spaced, muted)
- Balance verbatim: <…>  (expect "$ 1,247 .32" with the parts visually distinct — `$` and `.32` smaller than `1,247`)
- Are the **dollars** ("1,247") rendered in a **serif font** clearly distinguishable from the rest of the dashboard's sans-serif? y/n
- Is the **`$` sign brass / gold-toned** (NOT the same color as the dollars)? y/n
- Are the **cents** (".32") visually smaller than the dollars and in a more muted color? y/n
- Text below the balance (verbatim): <…>  (expect "Available — held in your Sneakers Vault, USD equivalent.")

## Step 3 — Vault action buttons

Two side-by-side buttons below the balance.

Report:
- Left button label / hint: <…> / <…>  (expect "Deposit" / "From your bank or card")
- Right button label / hint: <…> / <…>  (expect "Withdraw" / "To your bank ••4421")
- Left has a **filled** brass-rimmed look; right has a **ghost / outline** look? y/n
- Each has a small circular icon (↓ for deposit, ↑ for withdraw)? y/n
- Hovering / clicking either button: does it press down slightly (subtle active state)? y/n
- Clicking the **Deposit** button: does a modal open over the surface? y/n

## Step 4 — Deposit modal

With the Deposit modal open:

Report:
- Modal eyebrow: <…>  (expect "INFLOW" in brass, letter-spaced)
- Modal title (verbatim): <…>  (expect "Deposit to Vault")
- Subtitle mentions CoinFlow? y/n  Verbatim: <…>
- Amount input box: clicking it accepts typed digits? y/n
- Quick-fill chips below the input: list them verbatim. (expect "$25" "$50" "$100" "$250")
- Click the **$50** chip: does the amount input update to "50"? y/n
- "CoinFlow — Coming soon. This is a scaffold — no funds will move yet." notice visible? y/n
- Primary button at the bottom (verbatim): <…>  (expect "Continue to CoinFlow")
- Is the primary button **visibly disabled** (greyed, not clickable)? y/n  · If you click it, anything happens? (expect: nothing)
- Pressing **Escape**: does the modal close? y/n
- Clicking outside the modal: does it close? y/n

## Step 5 — Withdraw modal

Re-open the Withdraw modal. Same questions, expected differences:

Report:
- Modal eyebrow: <…>  (expect "OUTFLOW", brass)
- Title: <…>  (expect "Withdraw from Vault")
- Subtitle mentions CoinFlow + 1–2 business days? y/n
- Primary button label: <…>  (expect "Review withdrawal", disabled)

## Step 6 — Recent activity ledger

Scroll past the buttons to the "Recent activity" section.

Report:
- Section header verbatim: <…>  (expect "RECENT ACTIVITY" all-caps, letter-spaced)
- Right side header: <…>  (expect "Last 7 days")
- How many ledger rows? <N>  (expect 5)
- For each row, capture timestamp + label + amount:
  1. `<ts>` · `<label · source>` · `<+/− $amount>`
  2. <…>
  3. <…>
  4. <…>
  5. <…>
  (Expected: deposit $250 / trade settle $18.40 / withdraw −$100 / trade buy −$50 / deposit $500.)
- Are inflows (+ amounts) and outflows (− amounts) **colored differently**? Describe the two colors. (Expect: inflows in a **muted emerald / sage green**, outflows in **brass / gold**. NOT red/green.)
- Are the amounts in a **monospace** font with tabular alignment? y/n
- "View all →" link at the bottom: visible? Disabled? (expect: visible, disabled-looking)

## Step 7 — Phase 1 scaffold notice

At the bottom of the page.

Report:
- Verbatim text of the small bordered notice card mentioning "Phase 1 · Scaffold" and CoinFlow.
- Color: is the "PHASE 1 · SCAFFOLD" label in brass / gold? y/n

## Step 8 — Sanity: surrounding /dashboard chrome still works

Click the "← Dashboard" link top-left of the wallet.

Report:
- Lands you back on `/dashboard`? y/n
- Does the regular dashboard render normally (no regressions from the wallet route)? y/n

## Step 9 — Honest overall read

As a 20-year-old college user opening this for the first time:

- Does it look like a **bank app / spend product**, or like a **trading dashboard tab**? (one short answer)
- Does the **balance hero** stop you (make you want to look at it), or feel like just another number? (one short answer)
- Anything that breaks the spell (looks generic, feels wrong, jars against the rest)? List up to 3.

## Report back

```
## Step 1. Aesthetic intact
- Loads / dark surface / brass vignette / grain: y/y/y/y
- Eyebrow row verbatim: <…>

## Step 2. Balance hero
- Balance verbatim: <…>
- Serif dollars: y/n
- Brass $: y/n
- Smaller muted cents: y/n
- Subline: <…>

## Step 3. Action buttons
- Labels/hints: <…> / <…>
- Filled vs ghost: y/n
- Icons present: y/n
- Tactile press: y/n
- Deposit opens modal: y/n

## Step 4. Deposit modal
- Eyebrow / title / subtitle: <…>
- Input typeable: y/n
- Quick-fill chips: <list>
- $50 chip updates input: y/n
- CoinFlow notice present: y/n
- Primary disabled: y/n
- ESC closes / click-outside closes: y/n / y/n

## Step 5. Withdraw modal
- Eyebrow / title: <…>
- Subtitle mentions 1–2 business days: y/n
- Primary disabled with correct label: y/n

## Step 6. Ledger
- 5 rows: y/n
- Rows verbatim:
  1. <…>
  2. <…>
  3. <…>
  4. <…>
  5. <…>
- Inflow / outflow color (verbatim two colors used): <…>
- Monospace amounts: y/n
- View all disabled: y/n

## Step 7. Scaffold notice
- Verbatim: <…>
- Label in brass: y/n

## Step 8. Sanity
- Back to /dashboard works: y/n
- No regressions: y/n

## Step 9. Honest read
- Reads as bank app or dashboard tab: <answer>
- Balance hero stops you: <answer>
- Spell-breakers: <up to 3>

## VERDICT
- Wallet scaffold: <SHIPS / PARTIAL / BROKEN>
- Aesthetic distinctness from rest of dashboard: <strong / okay / weak>
- Honest "would I trust this surface with my money?" read: <one sentence>
```
