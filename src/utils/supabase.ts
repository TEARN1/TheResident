import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Export the client. If URL or Key is missing (e.g. offline local mode),
// it falls back to null, allowing the app to run on local Redux state.
// createBrowserClient stores the session in cookies so middleware.ts can
// validate it server-side, and supabase-js handles token refresh itself.
export const supabase = supabaseUrl && supabaseAnonKey
  ? createBrowserClient(supabaseUrl, supabaseAnonKey)
  : null
