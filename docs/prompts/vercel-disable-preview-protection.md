# Disable Vercel Authentication on preview deployments — sneakers-terminal

Goal: turn off **Vercel Authentication** for Preview deployments on the `sneakers-terminal` Vercel project, so preview URLs are reachable without a Vercel login. This unblocks the commit → preview → QA workflow (right now every preview returns HTTP 401).

Context: the project is `sneakers-terminal` under the **jackson-fitzgeralds-projects** team. This is a deliberate, approved change — preview URLs are random unguessable hashes and the product is pre-launch, so the exposure is acceptable.

## Step 1 — Get to the project

1. Go to `https://vercel.com`.
2. If you hit a login screen: **stop and hand the tab back** — the user will complete the Vercel SSO sign-in, then tell you to continue. Do not attempt to authenticate yourself.
3. Once signed in, make sure the team scope (top-left switcher) is **jackson-fitzgeralds-projects**.
4. Open the **sneakers-terminal** project.

## Step 2 — Open Deployment Protection

1. Click **Settings** (top nav within the project).
2. In the left settings sidebar, click **Deployment Protection**.

Report: what does the **Vercel Authentication** section currently show? (Enabled/disabled, and any scope dropdown value like "Standard Protection" / "All Deployments" / "Only Preview Deployments".)

## Step 3 — Turn it off for previews

1. In the **Vercel Authentication** section, turn the setting **off** — either toggle it off entirely, or if there's a scope dropdown, set it so **Preview** deployments are **not** protected.
2. If a **Save** button appears, click it. Wait for the success confirmation.

Do NOT touch any other section (Password Protection, Trusted IPs, Protection Bypass, Shareable Links) — only Vercel Authentication.

## Step 4 — Confirm

1. Open a new tab and go to:
   `https://sneakers-terminal-b5y0jibf5-jackson-fitzgeralds-projects.vercel.app/onboarding/your-edge`
2. It should now load a page (you may see a sign-in redirect to the *app's own* `/signup` — that's fine and expected, it means the Vercel auth wall is gone). What you should NOT see is the Vercel "Authentication Required" page.

## Report back

```
- Vercel Authentication before: <state + scope>
- Changed to: <state + scope>
- Saved: y/n
- Preview URL after change: <Vercel 401 page | app page / app sign-in redirect>
- Done: y/n
```
