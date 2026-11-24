/**
 * Private verification files: landlords' proof of address and tenants'
 * "picture of yourself". They live in the private `res-verification` bucket
 * (supabase/migrations/20261124200000_private_verification_docs.sql), never
 * in the public gossip-media bucket, where anyone with the link could open
 * them for ever. The database stores a reference, "res-verification/<path>";
 * the owner and platform admins open it through a link that expires.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const PRIVATE_DOC_BUCKET = 'res-verification'
const PREFIX = `${PRIVATE_DOC_BUCKET}/`

export type PrivateDocKind = 'properties' | 'selfie'

export function isPrivateDocRef(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

/** Where a file goes: always under the uploader's own id (the bucket's rules check it). */
export function privateDocPath(userId: string, kind: PrivateDocKind, fileName: string, now = Date.now()): string {
  const ext = (fileName.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin'
  return `${userId}/${kind}/${now}.${ext}`
}

export async function uploadPrivateDoc(supabase: SupabaseClient, userId: string, kind: PrivateDocKind, file: File): Promise<string> {
  const path = privateDocPath(userId, kind, file.name)
  const { error } = await supabase.storage.from(PRIVATE_DOC_BUCKET).upload(path, file, { contentType: file.type })
  if (error) throw error
  return PREFIX + path
}

/** A link that works for a few minutes. Old public links and typed-in URLs pass through unchanged. */
export async function openablePrivateDoc(supabase: SupabaseClient, value: string | null | undefined, seconds = 300): Promise<string | null> {
  if (!value) return null
  if (!isPrivateDocRef(value)) return value
  const { data, error } = await supabase.storage.from(PRIVATE_DOC_BUCKET).createSignedUrl(value.slice(PREFIX.length), seconds)
  return error ? null : data.signedUrl
}
