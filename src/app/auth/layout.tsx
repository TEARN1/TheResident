import type { Metadata } from 'next'
import { ReduxProvider } from '../../store/provider'
import { siteUrl } from '../site-url'

export const metadata: Metadata = {
  title: 'Sign In / Sign Up | Join Your Suburb',
  description:
    'Join The Resident to find verified student accommodation, contact trusted local trades, and connect with your South African neighbourhood.',
  alternates: { canonical: '/auth' },
  openGraph: {
    title: 'Sign In / Sign Up | Join The Resident',
    description:
      'Join The Resident to find verified student accommodation, contact trusted local trades, and connect with your South African neighbourhood.',
    url: `${siteUrl()}/auth`,
  },
}

// The store (and Supabase with it) is provided here and in the dashboard
// layout instead of the root layout, so the home page and the public info
// pages don't download them.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <ReduxProvider>{children}</ReduxProvider>
}
