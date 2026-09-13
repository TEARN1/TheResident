import { createBrowserClient } from '@supabase/ssr'
import { createTimeoutFetch } from './supabaseFetch'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Export the client. If URL or Key is missing (e.g. offline local mode),
// it falls back to null, allowing the app to run on local Redux state.
// createBrowserClient stores the session in cookies so middleware.ts can
// validate it server-side, and supabase-js handles token refresh itself.
// Every data request carries a deadline — see supabaseFetch.ts. A finally
// only runs when a promise settles, and a hung request never settles, so
// without this a stalled connection strands whatever loading state the caller
// put on screen. Fixing it in the transport covers every call site at once,
// including the ones not written yet.
export const supabase = supabaseUrl && supabaseAnonKey
  ? createBrowserClient(supabaseUrl, supabaseAnonKey, {
      global: { fetch: createTimeoutFetch() }
    })
  : null
