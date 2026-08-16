// Turns a raw Postgres/PostgREST error — the kind a direct `.insert()` /
// `.update()` / `.delete()` call throws — into something a resident can act
// on. `humanizeDbError` in store/actions.ts already does this for RPC error
// CODES (e.g. 'no_seats_available'); this covers the different shape of
// error that comes back from writing straight to a table, where Postgres's
// own message text is the only thing available; RLS rejections are the most
// common case in practice, since a guest/expired session hits them constantly.
export function humanizeSupabaseError(message: string): string {
  const m = message.toLowerCase()

  if (m.includes('row-level security') || m.includes('permission denied')) {
    return 'You need an account to do that — guests can browse, but posting requires being signed in.'
  }
  if (m.includes('jwt') && (m.includes('expired') || m.includes('invalid'))) {
    return 'Your session has expired — log in again to continue.'
  }
  if (m.includes('duplicate key') || m.includes('already exists')) {
    return 'That already exists — try refreshing the page.'
  }
  if (m.includes('violates foreign key')) {
    return 'That refers to something that no longer exists — try refreshing the page.'
  }
  if (m.includes('violates not-null constraint')) {
    return 'A required field is missing — check the form and try again.'
  }
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) {
    return 'Could not reach the server — check your connection and try again.'
  }
  if (m.includes('rate_limited') || m.includes('too many requests')) {
    return 'You are doing that too often — try again shortly.'
  }
  // Fall back to the real message rather than a generic "something went
  // wrong" — an unrecognised-but-real Postgres error is still more useful
  // to a confused user (and to whoever they screenshot it to) than nothing.
  return message
}
