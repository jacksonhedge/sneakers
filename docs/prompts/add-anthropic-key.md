# Vercel — Add ANTHROPIC_API_KEY env var

The user is on Vercel → Sneakers Terminal project → Settings → Environment Variables. Walk them to the Add New dialog and pre-fill the Key field. They'll paste the actual API key value themselves.

## Steps

1. On the Environment Variables page, click the **"Add New"** button (top right of the env-vars list).
2. In the dialog that opens:
   - **Key:** type exactly `ANTHROPIC_API_KEY`
   - **Value:** leave blank — the user will paste their `sk-ant-api03-…` key into this field themselves
   - **Environments:** check all three: **Production**, **Preview**, **Development**
   - **Sensitive:** leave on (default for keys)
3. Stop after pre-filling the Key + Environments. **Don't click Save.** The user pastes the value, then clicks Save themselves.
4. After they save, point them at the **Deployments** tab → most recent Production deploy → ⋯ menu → **Redeploy** with **"Use existing Build Cache" UNCHECKED**. This makes both `POSTGRES_URL` and `ANTHROPIC_API_KEY` take effect.

## Hard guardrails

- Don't invent or paste an API key from any source. The user will provide the value.
- Don't edit any other env var.
- Don't delete any env var.
- If 2FA pops up, stop and ask.
