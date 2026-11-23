'use server'

import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/admin-audit'
import { requireAdmin } from '@/lib/admin-auth'
import { DEFAULT_DAILY, DEFAULT_PER_MINUTE, MAX_DAILY, MAX_PER_MINUTE, newApiKey, parseLimit } from '@/lib/spare-change-api'
import { insertKey, revokeKey } from '@/lib/spare-change-api-store'

type CreateResult = { ok: true; key: string; name: string } | { ok: false; message: string }
type Result = { ok: boolean; message: string }

const text = (v: FormDataEntryValue | null, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

/** Make a key. The key is returned once, here, and only its hash is stored. */
export async function createKeyAction(formData: FormData): Promise<CreateResult> {
  const { email } = await requireAdmin()
  const name = text(formData.get('name'), 120)
  if (!name) return { ok: false, message: 'name is required' }
  const contact = text(formData.get('contact_email'), 254)
  if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return { ok: false, message: 'contact email does not look like an email' }
  const perMinute = parseLimit(formData.get('per_minute_limit'), DEFAULT_PER_MINUTE, MAX_PER_MINUTE)
  if (perMinute === null) return { ok: false, message: `per-minute limit must be 1 to ${MAX_PER_MINUTE}` }
  const daily = parseLimit(formData.get('daily_limit'), DEFAULT_DAILY, MAX_DAILY)
  if (daily === null) return { ok: false, message: `daily limit must be 1 to ${MAX_DAILY.toLocaleString()}` }

  const k = newApiKey()
  let id: string
  try {
    id = await insertKey({
      name,
      contact_email: contact,
      note: text(formData.get('note'), 500),
      key_prefix: k.prefix,
      key_hash: k.hash,
      per_minute_limit: perMinute,
      daily_limit: daily,
      created_by: email.toLowerCase(),
    })
  } catch {
    return { ok: false, message: 'could not save the key (has migration 052 been applied?)' }
  }

  await logAdminAction({ actor: email, action: 'create_picks_api_key', targetKind: 'system', targetId: id, metadata: { name, prefix: k.prefix, per_minute: perMinute, daily } })
  revalidatePath('/admin/picks-api')
  return { ok: true, key: k.key, name }
}

export async function revokeKeyAction(formData: FormData): Promise<Result> {
  const { email } = await requireAdmin()
  const id = formData.get('id')
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: 'bad key id' }
  let done: boolean
  try {
    done = await revokeKey(id, email.toLowerCase())
  } catch {
    return { ok: false, message: 'revoke failed' }
  }
  if (!done) return { ok: false, message: 'already revoked or not found' }
  await logAdminAction({ actor: email, action: 'revoke_picks_api_key', targetKind: 'system', targetId: id })
  revalidatePath('/admin/picks-api')
  return { ok: true, message: 'revoked' }
}
