import { NEWSLETTER_NAME, greetingName } from './spare-change'
import { claimUrl } from './spare-change-claim'

// The welcome email for a new Spare Change Millionaire subscriber: its words, who it is from, and the rule that it goes out at most once
// per 24 hours per address. Nothing here talks to Resend or the database (both are handed in); the sender is in email.ts and the
// Supabase side is in spare-change-store.ts.
// Same wording rule as the pages: "long-shot parlays", "buy-in", "payout", "free dollar"; the one dollar is the only thing promised.

export const WELCOME_FROM_NAME = 'The Hedge Team'
export const WELCOME_SUBJECT = "🪙 You're in. Claim your free dollar"
export const COMPANY_NAME = 'Hedge, Inc.'
const LIME = '#C9F73A'
const INK = '#0B0F0C'
const WHAT_IT_IS = 'A daily email of long-shot parlays. A small buy-in, a big payout if it hits. Most long shots miss.'
const BUTTON = 'Claim your free dollar'
const YOURS_ALONE = "The link is yours alone, so don't forward it."
const FOOTER = ['18+ only.', "You're getting this because you signed up at sneakersterminal.com/spare-change.", "Reply STOP to this email and we'll remove you.", `${NEWSLETTER_NAME} is a ${COMPANY_NAME} product.`] as const

/**
 * The From line: "The Hedge Team" at whatever address the site's other emails use (`helperFrom` is that helper's own From, either
 * "Name <address>" or a bare address). SPARE_CHANGE_FROM, when set, replaces the whole line.
 */
export function welcomeFrom(i: { override: string | undefined; helperFrom: string }): string {
  const override = i.override?.trim()
  if (override) return override
  const address = (i.helperFrom.match(/<([^<>]+)>/)?.[1] ?? i.helperFrom).trim()
  return `${WELCOME_FROM_NAME} <${address}>`
}

// Every value lands in a text node or a double-quoted attribute, so these four are the ones that matter.
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface WelcomeEmail {
  subject: string
  html: string
  text: string
}

/**
 * Both versions of the welcome email. Tables and inline styles only: no scripts, no style blocks, no images, no web fonts.
 * The postal address is printed only when one is configured; without it the footer names the company and nothing more.
 */
export function buildWelcomeEmail(i: { name: unknown; claimUrl: string; postalAddress: string | undefined }): WelcomeEmail {
  const hello = `Hi ${greetingName(i.name) ?? 'there'},`
  const address = i.postalAddress?.trim()
  const company = address ? `${COMPANY_NAME}, ${address}` : COMPANY_NAME
  const footer = [...FOOTER, company]
  const text = [
    NEWSLETTER_NAME,
    '',
    hello,
    '',
    `You're in. ${WHAT_IT_IS}`,
    '',
    `${BUTTON}:`,
    i.claimUrl,
    '',
    YOURS_ALONE,
    '',
    WELCOME_FROM_NAME,
    '',
    '--',
    ...footer,
  ].join('\n')

  const url = esc(i.claimUrl)
  const font = "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;"
  const p = `margin: 0 0 16px; ${font} font-size: 17px; line-height: 26px; color: ${INK};`
  const small = `margin: 0 0 6px; ${font} font-size: 12px; line-height: 18px; color: #5B635D;`
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(NEWSLETTER_NAME)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F3F5EF;">
<div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: #F3F5EF;">One tap to tell us where to send it.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F3F5EF" style="background-color: #F3F5EF;">
<tr>
<td align="center" style="padding: 24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; background-color: #FFFFFF; border: 2px solid ${INK};">
<tr>
<td bgcolor="${LIME}" style="background-color: ${LIME}; padding: 28px 32px; border-bottom: 2px solid ${INK}; ${font} font-size: 26px; line-height: 30px; font-weight: 800; letter-spacing: -0.3px; color: ${INK};">${esc(NEWSLETTER_NAME)}</td>
</tr>
<tr>
<td style="padding: 32px 32px 8px;">
<p style="${p} font-weight: 700;">${esc(hello)}</p>
<p style="${p}">You're in. ${esc(WHAT_IT_IS)}</p>
</td>
</tr>
<tr>
<td align="center" style="padding: 8px 32px 20px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" bgcolor="${INK}" style="background-color: ${INK}; border-radius: 999px;">
<a href="${url}" style="display: inline-block; padding: 18px 36px; ${font} font-size: 19px; line-height: 22px; font-weight: 800; color: ${LIME}; text-decoration: none; border-radius: 999px;">${esc(BUTTON)}</a>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding: 0 32px 24px;">
<p style="margin: 0 0 16px; ${font} font-size: 13px; line-height: 20px; color: #5B635D; word-break: break-all;">Or open this link:<br><a href="${url}" style="color: ${INK};">${url}</a></p>
<p style="${p}">${esc(YOURS_ALONE)}</p>
<p style="${p} margin-bottom: 0; font-weight: 700;">${esc(WELCOME_FROM_NAME)}</p>
</td>
</tr>
<tr>
<td style="padding: 20px 32px 24px; border-top: 1px solid #D9DED4; background-color: #FAFBF7;">
${footer.map((line) => `<p style="${small}">${esc(line)}</p>`).join('\n')}
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`
  return { subject: WELCOME_SUBJECT, html, text }
}

// At most one welcome email per address per 24 hours, however many times the form is sent.
export const WELCOME_GAP_MS = 24 * 60 * 60 * 1000

/** True when no welcome email has gone to this row, or the last one went at least 24 hours ago. */
export function welcomeDue(sentAt: string | null, now: Date): boolean {
  if (!sentAt) return true
  const sent = Date.parse(sentAt)
  return Number.isNaN(sent) || now.getTime() - sent >= WELCOME_GAP_MS
}

export interface WelcomeRow {
  name: string
  claimToken: string
  welcomeSentAt: string | null
}

export interface WelcomeStore {
  read: (email: string) => Promise<WelcomeRow | null>
  /** Set welcome_sent_at to `nowIso`, only while it still holds `previous` (compare and swap). True when this call changed the row. */
  reserve: (email: string, previous: string | null, nowIso: string) => Promise<boolean>
  /** Put `previous` back, only while the row still holds `reservedIso`. */
  release: (email: string, reservedIso: string, previous: string | null) => Promise<void>
}

export type SendOutcome = 'sent' | 'skipped' | 'failed'

export interface WelcomeDeps {
  store: WelcomeStore
  send: (mail: WelcomeEmail & { to: string }) => Promise<SendOutcome>
  /** Whether an email key is set at all. Without one nothing is reserved and nothing is sent. */
  configured: boolean
  origin: string
  postalAddress: string | undefined
  now?: () => Date
}

/**
 * Send the welcome email for a row if one is due, and say what the saved screen may claim:
 * 'sent' = a welcome email went to this address just now or within the last 24 hours ("check your email");
 * 'pending' = none has gone ("on its way shortly"). Never throws: a signup is never failed by its email.
 *
 * The slot is taken BEFORE sending (welcome_sent_at is swapped from its old value to now), so two signups at once cannot both send.
 * If the send then fails, the old value is put back, so the row does not say an email went when it did not.
 */
export async function sendWelcomeOnce(email: string, deps: WelcomeDeps): Promise<'sent' | 'pending'> {
  try {
    const row = await deps.store.read(email)
    if (!row) return 'pending'
    const now = deps.now?.() ?? new Date()
    if (!welcomeDue(row.welcomeSentAt, now)) return 'sent'
    if (!deps.configured) return 'pending'
    const nowIso = now.toISOString()
    if (!(await deps.store.reserve(email, row.welcomeSentAt, nowIso))) return 'pending'
    const mail = buildWelcomeEmail({ name: row.name, claimUrl: claimUrl(deps.origin, row.claimToken), postalAddress: deps.postalAddress })
    const outcome = await deps.send({ ...mail, to: email }).catch((): SendOutcome => 'failed')
    if (outcome === 'sent') return 'sent'
    await deps.store.release(email, nowIso, row.welcomeSentAt)
    return 'pending'
  } catch {
    console.error('[spare-change-welcome] failed')
    return 'pending'
  }
}
