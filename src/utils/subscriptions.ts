// Subscription reads/checkout — server-authoritative. res_subscriptions is
// only ever written by the Paystack webhook edge function (service_role);
// this file never writes tier/status directly, it only reads and kicks off
// checkout. Pay-for-priority, not pay-to-play: a free provider is always
// fully listed and bookable, paying only buys speed/visibility (see the
// product plan for the full reasoning).
import { supabase } from './supabase'

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

/** Starts a Paystack checkout via the edge function; returns the URL to redirect to. */
export async function startCheckout(
  item: 'priority' | 'premium' | 'plus' | 'verification_speedup' | 'market_boost' | 'room_boost',
  targetId?: string
): Promise<{ url: string | null; error: string | null }> {
  if (!supabase) return { url: null, error: 'Not connected' }
  const { data, error } = await supabase.functions.invoke('paystack-checkout', { body: { item, targetId } })
  if (error) return { url: null, error: error.message || 'Could not start checkout' }
  if (data?.error === 'payments_not_configured') {
    return { url: null, error: "Payments aren't set up yet — try again soon." }
  }
  if (!data?.authorization_url) return { url: null, error: 'Could not start checkout' }
  return { url: data.authorization_url as string, error: null }
}
