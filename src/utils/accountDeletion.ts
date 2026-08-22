// Calls the delete-account edge function — real, permanent deletion, not a
// deactivation flag. The function is already deployed and correctly built:
// it takes the caller's uid from their own verified JWT (never from a request
// body, so nobody can pass someone else's id), purges every public.* row that
// references them via purge_user_data(), wipes their storage objects, then
// deletes the auth.users row itself, which cascades the rest.
//
// Nothing in this repo called it before this file — the backend half of
// account deletion existed with no front door.

import { supabase } from './supabase'

export interface DeleteAccountResult {
  ok: boolean
  error: string | null
}

export async function requestAccountDeletion(): Promise<DeleteAccountResult> {
  if (!supabase) {
    return { ok: false, error: 'Database offline / not configured.' }
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return { ok: false, error: 'You need to be signed in to delete your account.' }
  }

  const { data, error } = await supabase.functions.invoke('delete-account', {
    // The function reads the uid from this token server-side — nothing about
    // which account gets deleted is decided on the client.
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (error) {
    return { ok: false, error: error.message || 'Deletion failed. Please try again.' }
  }
  if (data?.error) {
    return { ok: false, error: String(data.error) }
  }

  // The function has already deleted the auth user — this client-side
  // signOut just clears the now-invalid local session/cookies so the app
  // doesn't keep acting as if it's still logged in.
  await supabase.auth.signOut()

  return { ok: true, error: null }
}
