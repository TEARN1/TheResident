// Subscription reads/checkout — server-authoritative. res_subscriptions is
// only ever written by the payment webhook (service_role);
// this file never writes tier/status directly, it only reads and kicks off
// PayFast checkout. Pay-for-priority, not pay-to-play: a free provider is always
// fully listed and bookable, paying only buys speed/visibility (see the
// product plan for the full reasoning).
import { supabase } from './supabase'
import type { SelfServePaymentItem } from './payfast'

export type ProviderTier = 'priority' | 'premium' | null

export async function getMyProviderTier(): Promise<ProviderTier> {
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('res_subscriptions')
    .select('tier, status')
    .eq('user_id', user.id)
    .eq('product', 'provider')
    .eq('status', 'active')
    .maybeSingle()
  return (data?.tier as ProviderTier) ?? null
}

export async function getPublicProviderTier(userId: string): Promise<ProviderTier> {
  if (!supabase || !userId) return null
  const { data, error } = await supabase.rpc('res_public_provider_tier', { p_user: userId })
  if (error) return null
  return (data as ProviderTier) ?? null
}

export async function getPublicProviderTiersBulk(userIds: string[]): Promise<Record<string, ProviderTier>> {
  if (!supabase || userIds.length === 0) return {}
  const ids = [...new Set(userIds)]
  const results = await Promise.all(ids.map(id => getPublicProviderTier(id)))
  const out: Record<string, ProviderTier> = {}
  ids.forEach((id, i) => { out[id] = results[i] })
  return out
}

export async function hasHouseholdPlus(): Promise<boolean> {
  if (!supabase) return false
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data, error } = await supabase.rpc('res_has_household_plus', { p_user: user.id })
  if (error) return false
  return !!data
}

/** Starts a PayFast checkout via the Next.js API route; returns the URL to redirect to. */
export async function startCheckout(
  item: SelfServePaymentItem,
  targetId?: string,
  returnPath?: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const res = await fetch('/api/payfast/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, targetId, returnPath })
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return { url: null, error: data?.error || 'Could not start PayFast checkout.' }
    }

    if (!data?.url) {
      return { url: null, error: 'Checkout did not return a payment URL.' }
    }

    return { url: data.url as string, error: null }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Could not start checkout'
    return { url: null, error: message }
  }
}
