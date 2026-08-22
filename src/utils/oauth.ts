// Google / Facebook sign-in — a thin wrapper around Supabase's OAuth flow.
//
// Kept in one place for the same reason performLogin is: this is
// security-critical and used from more than one entry point (the /auth page
// today; potentially the landing page's inline panel later), and two copies
// of an OAuth call site drift apart exactly where it matters — the redirect
// target.
//
// signInWithOAuth does a full top-level navigation to the provider (Google or
// Facebook), not a fetch — so there's nothing to await for a result here. The
// provider redirects to /auth/callback with a ?code=, and that route handler
// (src/app/auth/callback/route.ts) is what actually creates the session.

import { supabase } from './supabase'

export type OAuthProvider = 'google' | 'facebook'

export interface OAuthStartResult {
  ok: boolean
  error: string | null
}

/**
 * Starts the redirect to the provider. On success the browser navigates away
 * immediately, so the "ok: true" case never really renders anything — it
 * exists so a caller can still show an error if the redirect itself failed to
 * initiate (misconfigured provider, network down before the redirect fires).
 */
export async function signInWithProvider(provider: OAuthProvider): Promise<OAuthStartResult> {
  if (!supabase) {
    return { ok: false, error: 'Database offline / not configured.' }
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      // Re-consent every time is unnecessary friction for a returning user;
      // Supabase still refreshes the token itself on expiry.
      queryParams: provider === 'google' ? { access_type: 'offline', prompt: 'select_account' } : undefined,
    },
  })

  if (error) {
    // Distinguish "not configured" so the UI can say something useful rather
    // than a generic failure — this is the error Supabase returns when a
    // project hasn't had the provider turned on in the dashboard yet, which
    // is expected to be true until that's done.
    if (/provider is not enabled/i.test(error.message)) {
      return { ok: false, error: `${providerLabel(provider)} sign-in isn't turned on yet.` }
    }
    return { ok: false, error: error.message }
  }

  return { ok: true, error: null }
}

export function providerLabel(provider: OAuthProvider): string {
  return provider === 'google' ? 'Google' : 'Facebook'
}
