# Sneakers Terminal — Step 1 follow-up (resolving the two blockers)

You stopped at Step 1 of `fix-pooler-and-anthropic-key.md` because:
1. Supabase shows the password as `[YOUR-PASSWORD]` placeholder, not inline
2. The only Transaction pooler tab you found was the Dedicated PgBouncer at `db.ujfgtkebslesepbjrhyr.supabase.co:6543`, which Supabase warned is not IPv4 compatible

Both have clean answers. Continue:

## Where to get the password

Open **Vercel → project (Sneakers Terminal / sneakers-trading) → Settings → Environment Variables → POSTGRES_URL → click the ⋯ menu → "Reveal value"**.

Copy the revealed value, then extract the password from the URL pattern:
```
postgres://postgres:<PASSWORD>@db.ujfgtkebslesepbjrhyr.supabase.co:5432/postgres
```

The password is everything between the **second `:`** and the **`@`**. Hold it for Step 2.

**Do NOT reset the database password.** That breaks any other consumer using it (scrapers, jobs, etc).

## Hostname — use the SHARED pooler, not the dedicated

You looked at the wrong tab. The **Dedicated PgBouncer** (`db.ujfgtkebslesepbjrhyr.supabase.co:6543`) is IPv6-only without an IPv4 add-on, and Vercel functions speak IPv4. We need the **Shared Pooler / Supavisor** instead.

The Supavisor URI looks like:
```
postgres://postgres.ujfgtkebslesepbjrhyr:<PASSWORD>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

Note the **dot** in `postgres.ujfgtkebslesepbjrhyr` (it's the project ref appended to the username with a `.`, not the hostname).

In current Supabase UI it's typically found via:
- **Project Settings → Database → "Connection string"** section, with a dropdown or tab strip — select **"Transaction pooler"** mode (which on some projects is labeled "Supavisor"). The hostname will be `aws-0-<region>.pooler.supabase.com`, not `db.<projectRef>.supabase.co`.
- OR **Project Settings → Database → Connection pooling** section — look for the row labeled **Supavisor / Shared** vs the Dedicated PgBouncer row.

The two visual markers that tell you you've got the right URI:
1. Hostname starts with `aws-0-` (regional shared pool)
2. Username has the project ref after a dot: `postgres.<projectRef>`

If you genuinely can't find a Supavisor / Shared option anywhere in the UI, **screenshot the entire Database / Connection pooling page and stop**. Don't fall back to the dedicated `db.<project>.supabase.co:6543` URI — it'll work locally but timeout from Vercel due to IPv6.

## Now finish

Once you have the Supavisor URI with the real password substituted in and `?pgbouncer=true` appended, continue with **Steps 2–5** of the original prompt:

- Step 2: paste it into Vercel POSTGRES_URL
- Step 3: add ANTHROPIC_API_KEY (ask the user for the `sk-ant-…` value)
- Step 4: redeploy with build cache OFF
- Step 5: verify the Supabase pooler conn count climbs while direct conn drops
