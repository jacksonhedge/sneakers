# Spare Change Millionaire — Picks API (for partners)

Each day's four long-shot parlay tickets as JSON, for your Whop community, parlay builder, Discord bot or site.

## Get a key

We make you a key (it starts with `scm_`) and send it privately. Keep it on your server. Never put it in a browser,
an app bundle or a public repo. If it leaks, tell us: we revoke it and make you a new one.

## Request

```
GET https://sneakersterminal.com/api/spare-change/v1/picks
Authorization: Bearer scm_...
```

`X-API-Key: scm_...` works too.

| Query | Meaning |
|---|---|
| *(none)* or `date=latest` | Today's issue (US Eastern). Before today's issue is in, you get the newest earlier one: check `issue_date` |
| `date=YYYY-MM-DD` | That day's issue. Past days include results once graded. Future dates return `404 not_published` |

New issues show up at midnight Eastern on their date. Polling every 15–30 minutes is plenty.

## Response (200)

```json
{
  "ok": true,
  "issue_date": "2026-11-24",
  "issue_no": 5,
  "title": "…",
  "attribution": "Picks by Spare Change Millionaire",
  "responsible_gaming": "Must be of legal age in your state (18+ or 21+, shown on each ticket). …",
  "tickets": [
    {
      "position": 1,
      "site": "ProphetX",
      "name": "Five-Spot",
      "buy_in_cents": 100,
      "est_payout_cents": 15000,
      "headline_cents": 15000,
      "one_in": 150,
      "min_age": 18,
      "estimated": true,
      "result": "pending",
      "slip_link": "https://www.prophetx.co/?action=addtobetslip&line_ids=…&partner_id=…",
      "legs": [
        { "n": 1, "sport": "NBA", "league": "NBA", "event": "…", "starts_at": "2026-11-24T00:10:00.000Z",
          "market": "Moneyline", "pick": "…", "price_text": "+150", "price_decimal": 2.5, "result": "pending" }
      ]
    }
  ]
}
```

- Money is in whole cents.
- `estimated: true` means the payout is worked out from the leg prices; the site's own price on the slip may differ.
- `result` on a ticket: `pending`, `won`, `lost`, `void`. On a leg: `pending`, `hit`, `miss`, `void`, `ungraded`.
- `slip_link` opens the parlay on the site with every leg filled in. Use it exactly as given (don't strip or change
  its query string). It can be `null`.

## Rules for showing the picks

1. Show `attribution` with the picks.
2. Show `responsible_gaming` and each ticket's `min_age`, and only show a ticket to people old enough for it.
3. Don't change the picks, the prices or `slip_link`.
4. Don't present the picks as a guarantee. Long shots usually lose.

## Limits and errors

Default limits: 60 requests a minute and 2,000 a day per key (a day is midnight to midnight Eastern). Each answer
has `X-RateLimit-Limit` and `X-RateLimit-Remaining` for the day.

| Status | `error` | Meaning |
|---|---|---|
| 400 | `bad_date` | `date` isn't a real YYYY-MM-DD date |
| 401 | `missing_key` / `invalid_key` / `revoked_key` | No key, wrong key, or a key we turned off |
| 404 | `no_issue` / `not_published` | No issue for that day yet / the date is after today |
| 429 | `rate_limited` / `daily_limit` | Too fast (wait 60s, see `Retry-After`) / today's limit used up |
| 500 | `server_error` | Try again in a minute |

## Example

```bash
curl -s https://sneakersterminal.com/api/spare-change/v1/picks -H "Authorization: Bearer $SCM_KEY"
```
