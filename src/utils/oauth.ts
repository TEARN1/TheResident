// Social login (Continue with Facebook) helpers, shared by the sign-in page
// and the /auth/callback route.

export type OAuthFailure = 'cancelled' | 'no_email' | 'failed'

/**
 * Why a social login came back without a session, from the `error` and
 * `error_description` Supabase puts on the redirect. Kept to three reasons
 * the person can act on.
 */
export function oauthFailureReason(error: string | null, description: string | null): OAuthFailure {
  const text = `${error ?? ''} ${description ?? ''}`.toLowerCase()
  if (text.includes('access_denied') || text.includes('cancel') || text.includes('denied')) return 'cancelled'
  // Facebook accounts made with a phone number can have no email address,
  // and Supabase needs one to create the account.
  if (text.includes('email')) return 'no_email'
  return 'failed'
}

export const OAUTH_FAILURE_MESSAGES: Record<OAuthFailure, string> = {
  cancelled: 'Facebook login was cancelled. You can try again, or use your email.',
  no_email: "Your Facebook account didn't share an email address, which we need for your account. Sign up with your email instead.",
  failed: "Facebook login didn't finish. Please try again, or use your email."
}

export function isOAuthFailure(value: string | null): value is OAuthFailure {
  return value === 'cancelled' || value === 'no_email' || value === 'failed'
}

/**
 * Which social logins are switched on for this Supabase project, from the
 * public /auth/v1/settings endpoint. The Facebook button is shown only when
 * this says so: while the provider is off, tapping it opened a bare
 * "provider is not enabled" error page from Supabase.
 */
export async function fetchEnabledProviders(supabaseUrl: string, anonKey: string): Promise<Record<string, boolean>> {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: anonKey } })
    if (!res.ok) return {}
    const body = await res.json() as { external?: Record<string, boolean> }
    return body.external ?? {}
  } catch {
    return {}
  }
}
