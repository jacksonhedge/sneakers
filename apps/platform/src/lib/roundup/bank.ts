// apps/platform/src/lib/roundup/bank.ts
import { getStripe } from '@/lib/stripe'

export async function ensureStripeCustomer(existingCustomerId: string | null, sessionId: string): Promise<string> {
  if (existingCustomerId) return existingCustomerId
  const stripe = getStripe()
  const customer = await stripe.customers.create({ metadata: { roundup_demo_session: sessionId } })
  return customer.id
}

export async function createFinancialConnectionsSession(customerId: string): Promise<{ clientSecret: string | null }> {
  const stripe = getStripe()
  const fcSession = await stripe.financialConnections.sessions.create({
    account_holder: { type: 'customer', customer: customerId },
    permissions: ['transactions'],
    filters: { countries: ['US'] },
  })
  return { clientSecret: fcSession.client_secret }
}

export interface LinkedAccount {
  id: string
  institution: string | null
  last4: string | null
}

export async function completeFinancialConnectionsLink(fcSessionId: string): Promise<LinkedAccount | null> {
  const stripe = getStripe()
  const fcSession = await stripe.financialConnections.sessions.retrieve(fcSessionId)
  const account = fcSession.accounts?.data?.[0]
  if (!account) return null
  // Required before financialConnections.transactions.list returns data for this account.
  await stripe.financialConnections.accounts.subscribe(account.id, { features: ['transactions'] })
  return { id: account.id, institution: account.institution_name ?? null, last4: account.last4 ?? null }
}

export interface BankTxn {
  id: string
  merchant: string
  amountCents: number
  date: string
}

/**
 * Stripe Financial Connections Transaction objects: `amount` is a signed
 * integer in the account's smallest currency unit (cents for USD, same
 * convention as every other Stripe amount field), `transacted_at` is a unix
 * timestamp, `description` is the merchant/memo string. Verify field names
 * against the installed `stripe` SDK's types (`node_modules/stripe/types`)
 * if this errors — Financial Connections is a newer API surface and field
 * names have shifted across SDK majors before.
 */
export async function listRecentTransactions(bankAccountId: string): Promise<BankTxn[]> {
  const stripe = getStripe()
  const page = await stripe.financialConnections.transactions.list({ account: bankAccountId, limit: 10 })
  return page.data.map((t) => ({
    id: t.id,
    merchant: t.description ?? 'Transaction',
    amountCents: Math.abs(t.amount),
    date: new Date(t.transacted_at * 1000).toISOString().slice(0, 10),
  }))
}
