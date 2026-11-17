// The Supabase project address and its public (anon) key. Both are public by
// design: every visitor's browser receives them, and row-level security is
// what protects the data. They default here so a build that is missing the
// NEXT_PUBLIC_* variables still connects. A live build without them showed
// "Database offline / not configured" and nobody could sign in.
// The env variables still win when set (e.g. to point at another project).
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://feevvddvrjmfbhffccbf.supabase.co'

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlZXZ2ZGR2cmptZmJoZmZjY2JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTEwNTAsImV4cCI6MjA4ODI2NzA1MH0.CvZRz05orvSEeaawwponcjpZypX3CePBny6zsgmc4bU'
