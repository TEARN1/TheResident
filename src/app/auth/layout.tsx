import { ReduxProvider } from '../../store/provider'

// The store (and Supabase with it) is provided here and in the dashboard
// layout instead of the root layout, so the home page and the public info
// pages don't download them.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <ReduxProvider>{children}</ReduxProvider>
}
