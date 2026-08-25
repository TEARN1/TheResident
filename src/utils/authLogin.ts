// Shared login flow — used by both the full /auth page and the landing
// page's inline login panel. Login is security-critical (brute-force
// lockout, security logging), so it lives in exactly one place rather than
// being copy-pasted between the two entry points and drifting apart.
import type { AppDispatch } from '../store'
import { loginUser, registerFailedAttempt, resetFailedAttempts, addLog } from '../store'
import { supabase } from './supabase'

export function secondsLockedOut(lockedUntil: Record<string, number>, email: string): number {
  const lockTime = lockedUntil[email] || 0
  if (lockTime > Date.now()) {
    return Math.ceil((lockTime - Date.now()) / 1000)
  }
  return 0
}

export interface LoginArgs {
  email: string
  password: string
  dispatch: AppDispatch
  failedAttempts: Record<string, number>
  lockedUntil: Record<string, number>
  fallbackRole?: 'tenant' | 'landlord'
}

export type LoginResult =
  | { ok: true; needsOnboarding: boolean }
  | { ok: false; error: string }

/** Performs the real Supabase login, brute-force bookkeeping, and Redux session setup. */
export async function performLogin({ email, password, dispatch, failedAttempts, lockedUntil, fallbackRole }: LoginArgs): Promise<LoginResult> {
  const secondsLeft = secondsLockedOut(lockedUntil, email)
  if (secondsLeft > 0) {
    dispatch(addLog({
      action: 'Attempted login to locked account blocked',
      type: 'brute_force_blocked',
      details: `Failed authorization request for locked account ${email}. Lock expires in ${secondsLeft}s.`
    }))
    return { ok: false, error: `Account locked due to brute force protection. Try again in ${secondsLeft} seconds.` }
  }

  if (!supabase) {
    return { ok: false, error: 'Database offline / not configured.' }
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    dispatch(registerFailedAttempt(email))
    const attempts = (failedAttempts[email] || 0) + 1

    dispatch(addLog({
      action: 'Failed login attempt recorded',
      type: 'auth_failed',
      details: `Incorrect credentials entered for ${email}. Failed attempts: ${attempts}/5`
    }))

    if (attempts >= 5) {
      return { ok: false, error: 'Brute force defense triggered. Account locked for 60 seconds.' }
    }
    return { ok: false, error: `Invalid credentials: ${error.message} (Attempt ${attempts} of 5 before account lockout).` }
  }

  const session = data.session
  const user = data.user
  if (!session || !user) {
    return { ok: false, error: 'Login did not return a session — try again.' }
  }

  // ONE ACCOUNT across The Gruvs & The Resident — see auth page for the full
  // explanation of ensure_res_profile.
  await supabase.rpc('ensure_res_profile').then(() => {}, () => {})

  const { data: dbProfile } = await supabase
    .from('res_profiles')
    .select('role, bio, created_at')
    .eq('id', user.id)
    .single()

  const userRole = dbProfile?.role || fallbackRole || 'visitor'

  dispatch(resetFailedAttempts(email))
  dispatch(loginUser({
    id: user.id,
    name: user.user_metadata?.name || 'Resident User',
    email: user.email!,
    role: userRole as 'tenant' | 'landlord' | 'visitor',
    createdAt: dbProfile?.created_at || undefined
  }))

  dispatch(addLog({
    action: 'Logged in safely: Supabase session authenticated',
    type: 'auth_success',
    details: `Email: ${email}`
  }))

  // A bare ensure_res_profile() default (role never chosen, bio never set)
  // means this is a Gruvs cross-signup user's first-ever Resident login — a
  // direct signup always sets both. Let the caller route them to the
  // one-time completion form instead of the dashboard.
  const needsOnboarding = (dbProfile?.role || 'visitor') === 'visitor' && !dbProfile?.bio

  return { ok: true, needsOnboarding }
}
