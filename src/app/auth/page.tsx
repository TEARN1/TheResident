'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import { loginUser, resetFailedAttempts, addLog, RootState, AppDispatch, toUUID, GUEST_USER_ID } from '../../store'
import { supabase } from '../../utils/supabase'
import { fetchEnabledProviders, isOAuthFailure, OAUTH_FAILURE_MESSAGES } from '../../utils/oauth'
import { performLogin } from '../../utils/authLogin'
import { Shield, CheckCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { safeNextPath } from '../../utils/launch'
import { track } from '../../utils/track'
import { cleanScriptTags, scanInput, checkPasswordStrength, encodeHTMLEntities } from '../../utils/security'
import Image from 'next/image'

// Cross-app SSO mark for The Gruvs — their real logo (public/gruvs-logo.png),
// not a placeholder monogram.
function GruvsMark() {
  return (
    <Image
      src="/gruvs-logo.png"
      alt="The Gruvs"
      aria-hidden="true"
      width={22}
      height={22}
      style={{
        borderRadius: '50%',
        objectFit: 'cover',
        flexShrink: 0
      }}
    />
  )
}

// Where to land after signing in: the deep link the proxy bounced us from
// (?next=/dashboard/housing?listing=...), or the dashboard.
function afterAuthPath(): string {
  if (typeof window === 'undefined') return '/dashboard'
  return safeNextPath(new URLSearchParams(window.location.search).get('next'))
}

export default function AuthPage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()

  // (The theme switcher that sat in the corner here is gone: themes live in
  // Profile, and the root layout already applies the saved one.)

  const failedAttempts = useSelector((state: RootState) => state.auth.failedAttempts)
  const lockedUntil = useSelector((state: RootState) => state.auth.lockedUntil)
  
  // Tab control: 'login' | 'signup'
  // Log In first: most people who reach /auth already have an account (the
  // landing page's own inline login covers the common case; this page is
  // mainly landed on directly, e.g. a bookmark or the "Join Your Suburb"
  // link) — defaulting to the signup form put a returning resident one extra
  // click away from where they actually needed to be.
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login')
  
  // Common Form Fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  // '' (not a real role) is the deliberate default on the LOGIN form: this
  // dropdown is only ever consulted as a fallback for a first-ever sign-in
  // (e.g. via Gruvs SSO) when no res_profiles row exists yet — silently
  // pre-selecting 'tenant' meant a landlord's very first login could create
  // them as a tenant without them ever having made a choice. The signup form
  // reuses the same state but always has the user actively pick one of the
  // two real options before submitting, so defaulting it to '' there too is
  // harmless.
  const [role, setRole] = useState<'tenant' | 'landlord' | ''>('')
  
  // Sign up asks only what an account needs (name, email, password, tenant
  // or landlord). The tenant profile and landlord house rules it used to ask
  // up front are filled in later on the Profile page, where they already live.
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Message states
  const [securityMessage, setSecurityMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [resetEmailSending, setResetEmailSending] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState(false)
  // "Sign in with The Gruvs" mode — shows the one-account helper on the login form.
  const [gruvsMode, setGruvsMode] = useState(false)

  // Arriving from The Gruvs (?sso=gruvs and friends) opens Log In in Gruvs
  // mode. Declared after activeTab/gruvsMode: it used to sit above them and
  // called both setters before they existed.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('sso') === 'gruvs' || params.get('from') === 'gruvs' || params.get('provider') === 'gruvs' || params.get('mode') === 'gruvs' || params.get('gruvs') === 'true') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from the URL on mount
      setActiveTab('login')
      setGruvsMode(true)
    } else if (params.get('role') === 'landlord') {
      // "I have a room to rent" from Housing: the person already chose, so
      // open Sign Up with Landlord picked (they can still change it).
      setActiveTab('signup')
      setRole('landlord')
    } else if (params.get('signup') === '1') {
      // A guest tapping "Sign up to request this room" lands on Sign Up.
      setActiveTab('signup')
    }
    // Back from Facebook without a session: say why (see /auth/callback).
    const oauth = params.get('oauth')
    if (isOAuthFailure(oauth)) setErrorMessage(OAUTH_FAILURE_MESSAGES[oauth])
  }, [])

  // Social sign-in (Google & Facebook) — enabled by default now that both
  // providers are configured in Supabase, with live settings check fallback.
  const [googleOn, setGoogleOn] = useState(true)
  const [facebookOn, setFacebookOn] = useState(true)
  useEffect(() => {
    // Handle implicit OAuth hash tokens (#access_token=...&refresh_token=...)
    const hash = window.location.hash || ''
    if (hash.includes('access_token=') && hash.includes('refresh_token=') && supabase) {
      const hashParams = new URLSearchParams(hash.replace(/^#/, ''))
      const access_token = hashParams.get('access_token')
      const refresh_token = hashParams.get('refresh_token')
      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(async ({ data, error }) => {
          if (!error && data?.session) {
            try { await supabase!.rpc('ensure_res_profile') } catch {}
            try { window.history.replaceState(null, '', window.location.pathname + window.location.search) } catch {}
            router.push(afterAuthPath())
          }
        }).catch(() => {})
      }
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return
    let cancelled = false
    fetchEnabledProviders(url, key).then(p => {
      if (cancelled) return
      if (typeof p.google === 'boolean') setGoogleOn(p.google)
      if (typeof p.facebook === 'boolean') setFacebookOn(p.facebook)
    })
    return () => { cancelled = true }
  }, [router])
  const [passwordStrength, setPasswordStrength] = useState<{strong: boolean; score: number; feedback: string[]} | null>(null)

  const handlePasswordChange = (val: string) => {
    setPassword(val)
    if (val.length > 0) {
      setPasswordStrength(checkPasswordStrength(val))
    } else {
      setPasswordStrength(null)
    }
  }

  // XSS Sanitization
  const sanitizeInput = (text: string): string => {
    const original = text
    const scan = scanInput(text)
    let sanitized = cleanScriptTags(text)
    sanitized = encodeHTMLEntities(sanitized)
    
    if (!scan.safe) {
      dispatch(addLog({
        action: `Threats detected and neutralized: ${scan.threats.join(', ')}`,
        type: 'xss_blocked',
        details: `Sanitized input: ${original.substring(0, 100)} => ${sanitized.substring(0, 100)}`
      }))
      setSecurityMessage(`Security alert: ${scan.threats.length} threat(s) detected and neutralized (${scan.threats.join(', ')}).`)
      setTimeout(() => setSecurityMessage(null), 6000)
    }
    return sanitized
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setErrorMessage(null)
    const result = await performLogin({
      email,
      password,
      dispatch,
      failedAttempts,
      lockedUntil,
      fallbackRole: role ? (role as 'tenant' | 'landlord') : undefined
    })
    if (!result.ok) {
      setErrorMessage(result.error)
      return
    }
    router.push(result.needsOnboarding ? '/auth/onboarding' : afterAuthPath())
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !name || !role) return

    setErrorMessage(null)

    if (passwordStrength && !passwordStrength.strong) {
      setErrorMessage('Please choose a stronger password. ' + (passwordStrength.feedback[0] || ''))
      return
    }

    if (!termsAccepted) {
      setErrorMessage('Please accept the Terms to create your account.')
      return
    }

    if (!supabase) {
      setErrorMessage('Database offline / not configured.')
      return
    }

    const sanitizedName = sanitizeInput(name)

    // Real Supabase signup
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: sanitizedName
        }
      }
    })

    if (error) {
      setErrorMessage(error.message)
      return
    }

    const user = data.user

    if (user) {
      const uuid = toUUID(user.id)
      
      // Upsert shared public.profiles first
      await supabase.from('profiles').upsert({
        id: uuid,
        name: sanitizedName,
        email: email
      })

      // Insert res_profiles configuration
      await supabase.from('res_profiles').insert({
        id: uuid,
        role: role,
        // Neutral defaults until they fill in Profile; nothing is guessed
        // (employment status used to default to "Employed").
        bio: null,
        gender: role === 'tenant' ? 'any' : null,
        children_count: 0,
        employment_status: null,
        has_pets: false,
        landlord_gender_pref: role === 'landlord' ? 'any' : null,
        landlord_children_allowed: true,
        landlord_max_children: role === 'landlord' ? 2 : 0,
        landlord_smoking_allowed: false,
        landlord_pets_allowed: false
      })

      dispatch(resetFailedAttempts(email))
      dispatch(loginUser({
        id: user.id,
        name: sanitizedName,
        email: email,
        role: role,
        createdAt: new Date().toISOString()
      }))

      dispatch(addLog({
        action: `New account onboarded: Supabase auth created`,
        type: 'auth_success',
        details: `Created account for ${sanitizedName}.`
      }))
      // No user id: with email confirmation on there is no session yet, and
      // the insert policy only accepts your own id or none.
      track('signup', { role })

      router.push(afterAuthPath())
    }
  }

  // Google/Facebook — same Supabase Auth project as The Gruvs, so this is an
  // alternate front door onto the one shared account, not a separate signup
  // path. ensure_res_profile() (called from performLogin's login path today)
  // isn't in this flow since Supabase's own onAuthStateChange redirect lands
  // straight on /dashboard; res_profiles is created lazily there if missing.
  const [oauthLoading, setOauthLoading] = useState<'google' | 'facebook' | null>(null)

  const handleOAuth = async (provider: 'google' | 'facebook') => {
    if (!supabase) {
      setErrorMessage('Database offline / not configured.')
      return
    }
    setErrorMessage(null)
    setOauthLoading(provider)
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })
    if (error) {
      setErrorMessage(error.message)
      setOauthLoading(null)
    }
    // On success the browser navigates away to the provider — nothing else to do.
  }



  const handleVisitorLogin = () => {
    // Visitor guests don't have Supabase auth records, so we set a guest token
    const visitorUser = {
      id: GUEST_USER_ID,
      name: 'Guest Visitor',
      email: 'visitor@theresidentcrew.com',
      role: 'visitor' as const,
      profile: {
        bio: 'Browsing the directory as a guest.',
        gender: 'any' as const,
        childrenCount: 0,
        employmentStatus: 'Visitor',
        hasPets: false
      }
    }

    // 30 days: it only lets someone browse public data (RLS still applies),
    // and the old 1-hour expiry bounced guests to the login screen mid-browse.
    document.cookie = `guest-mode=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
    
    dispatch(resetFailedAttempts(email))
    dispatch(loginUser(visitorUser))
    dispatch(addLog({
      action: 'Entered application in Guest / Visitor mode',
      type: 'auth_success',
      details: 'Browsing limits applied'
    }))

    router.push(afterAuthPath())
  }

  return (
    <div style={containerStyle}>
      <div style={overlayStyle} />

      {securityMessage && (
        <div style={alertStyle}>
          <Shield size={20} className="text-gold-primary" />
          <span>{securityMessage}</span>
        </div>
      )}

      {/* Kept to the essentials: email and password, plus Facebook and guest
          browsing. It used to stack three "Continue with The Gruvs" buttons,
          a theme switcher, a partner footer and a full tenant/landlord
          questionnaire on one screen. */}
      <div
        className="responsive-glass-panel"
        style={{ ...glassPanelStyle, maxWidth: '420px' }}
      >
        <div style={{ ...headerStyle, marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.65rem' }}>
            <Image
              src="/logo.png"
              alt="The Resident"
              width={48}
              height={48}
              style={{ borderRadius: '12px', objectFit: 'contain' }}
            />
          </div>
          <h2 style={{ ...logoStyle, fontSize: 'clamp(1.5rem, 7vw, 2.2rem)', letterSpacing: '3px' }}>THE RESIDENT</h2>
          <p style={{ ...taglineStyle, textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
            {activeTab === 'login' ? 'Welcome back' : 'Create your free account'}
          </p>
        </div>

        <div style={tabContainerStyle}>
          <button
            type="button"
            style={activeTab === 'login' ? activeTabStyle : inactiveTabStyle}
            onClick={() => { setActiveTab('login'); setErrorMessage(null) }}
          >
            Log in
          </button>
          <button
            type="button"
            style={activeTab === 'signup' ? activeTabStyle : inactiveTabStyle}
            onClick={() => { setActiveTab('signup'); setErrorMessage(null) }}
          >
            Sign up
          </button>
        </div>

        {errorMessage && (
          <div style={errorContainerStyle}>
            <AlertTriangle size={16} color="#ef4444" style={{ marginRight: 8 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {activeTab === 'login' ? (
          <form onSubmit={handleLogin} style={formStyle}>
            <div style={inputGroupStyle}>
              <label style={labelStyle} htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={inputGroupStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={labelStyle} htmlFor="login-password">Password</label>
                <button
                  type="button"
                  onClick={async () => {
                    if (!email) {
                      setErrorMessage('Type your email first so we know where to send the reset link.')
                      return
                    }
                    if (!supabase) {
                      setErrorMessage('Database offline / not configured.')
                      return
                    }
                    setResetEmailSending(true)
                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback?next=/dashboard/profile` : undefined
                    })
                    setResetEmailSending(false)
                    if (error) {
                      setErrorMessage(error.message)
                    } else {
                      setResetEmailSent(true)
                      setErrorMessage(null)
                    }
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--gold-primary)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: '0 2px' }}
                >
                  {resetEmailSending ? 'Sending link…' : 'Forgot password?'}
                </button>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ ...inputStyle, paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '0.85rem', background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {resetEmailSent && (
              <div style={{ ...noticeStyle, background: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.3)', color: '#86efac' }}>
                <CheckCircle size={16} color="#22c55e" />
                <span>Reset link sent to <strong>{email}</strong>. Check your inbox and spam folder.</span>
              </div>
            )}

            <button type="submit" className="btn-primary" style={submitButtonStyle}>
              Log in
            </button>

            {/* The Gruvs shares this login (same accounts), so there is
                nothing extra to tap: just say so. Highlighted when the
                visitor arrived from The Gruvs (?sso=gruvs). */}
            <p style={{ ...gruvsNoteStyle, ...(gruvsMode ? gruvsNoteActiveStyle : null) }}>
              <GruvsMark />
              <span>Have a Gruvs account? Log in with the same email and password.</span>
            </p>
          </form>
        ) : (
          <form onSubmit={handleSignup} style={formStyle}>
            <div style={inputGroupStyle}>
              <span style={labelStyle}>I am…</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {([['tenant', 'Looking for a room'], ['landlord', 'Renting out a room']] as const).map(([value, text]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRole(value)}
                    aria-pressed={role === value}
                    style={role === value ? { ...roleChoiceStyle, ...roleChoiceActiveStyle } : roleChoiceStyle}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle} htmlFor="signup-name">Name</label>
              <input
                id="signup-name"
                type="text"
                required
                autoComplete="name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle} htmlFor="signup-email">Email</label>
              <input
                id="signup-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle} htmlFor="signup-password">Password</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  placeholder="Choose a strong password"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  style={{ ...inputStyle, paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '0.85rem', background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordStrength && (
                <div style={{ marginTop: '4px' }}>
                  <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
                    {[...Array(6)].map((_, i) => (
                      <div key={i} style={{
                        flex: 1, height: '4px', borderRadius: '2px',
                        background: i < passwordStrength.score
                          ? passwordStrength.score >= 4 ? '#4CAF50' : passwordStrength.score >= 2 ? '#FFC107' : '#F44336'
                          : 'rgba(255,255,255,0.15)'
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '11px', color: passwordStrength.strong ? '#4CAF50' : '#FFC107' }}>
                    {passwordStrength.strong ? 'Strong password' : (passwordStrength.feedback[0] || 'Weak password')}
                  </span>
                </div>
              )}
            </div>

            <label htmlFor="termsAgreement" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '12px', color: '#D1D5DB', lineHeight: 1.45, cursor: 'pointer' }}>
              <input
                type="checkbox"
                id="termsAgreement"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                style={{ marginTop: '0.15rem', cursor: 'pointer', accentColor: 'var(--gold-primary)' }}
              />
              <span>
                I agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold-primary)', textDecoration: 'underline', fontWeight: 700 }}>Terms</a>
                {' '}and{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold-primary)', textDecoration: 'underline', fontWeight: 700 }}>Privacy Policy</a>
              </span>
            </label>

            <button type="submit" className="btn-gold" style={submitButtonStyle} disabled={!role}>
              {role ? 'Create account' : 'Choose an option above'}
            </button>
          </form>
        )}

        {(googleOn || facebookOn) && (<>
          <div style={socialDividerStyle}>
            <span style={socialDividerLineStyle} />
            <span style={socialDividerTextStyle}>or continue with</span>
            <span style={socialDividerLineStyle} />
          </div>

          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            {googleOn && (
              <button
                type="button"
                onClick={() => handleOAuth('google')}
                disabled={oauthLoading !== null}
                style={{ ...oauthBtnStyle, gap: '0.55rem' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/>
                </svg>
                <span>{oauthLoading === 'google' ? 'Connecting…' : 'Google'}</span>
              </button>
            )}
            {facebookOn && (
              <button
                type="button"
                onClick={() => handleOAuth('facebook')}
                disabled={oauthLoading !== null}
                style={{ ...oauthBtnStyle, gap: '0.55rem' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                <span>{oauthLoading === 'facebook' ? 'Connecting…' : 'Facebook'}</span>
              </button>
            )}
          </div>
        </>)}

        <button type="button" onClick={handleVisitorLogin} style={guestLinkStyle}>
          Just looking? Browse as a guest
        </button>

        <p style={{ margin: '1.25rem 0 0', textAlign: 'center' }}>
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={legalLinkStyle}>Terms</a>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.3)', margin: '0 8px' }}>·</span>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={legalLinkStyle}>Privacy</a>
        </p>
      </div>

    </div>
  )
}

// Styles
const legalLinkStyle: React.CSSProperties = { fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.45)', textDecoration: 'underline' }

export const containerStyle: React.CSSProperties = {
  position: 'relative',
  width: '100vw',
  minHeight: '100vh',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '2rem 1rem',
  background: 'var(--background)',
  boxSizing: 'border-box',
  overflowX: 'hidden'
}

export const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundImage: 'radial-gradient(circle at 30% 20%, var(--gold-dim) 0%, transparent 40%), radial-gradient(circle at 70% 80%, rgba(255, 105, 180, 0.03) 0%, transparent 40%)',
  zIndex: 0,
  pointerEvents: 'none'
}


export const glassPanelStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  width: '100%',
  maxWidth: '520px',
  background: 'rgba(10, 10, 10, 0.75)',
  backdropFilter: 'blur(28px)',
  WebkitBackdropFilter: 'blur(28px)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  boxShadow: '0 24px 60px -12px rgba(0, 0, 0, 0.8), 0 0 32px rgb(var(--accent) / 0.12)',
  borderRadius: '24px',
  padding: '2.5rem',
  color: 'var(--foreground)',
  boxSizing: 'border-box'
}

export const headerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: '2rem'
}

export const logoStyle: React.CSSProperties = {
  fontSize: '2.2rem',
  fontFamily: 'var(--font-heading), serif',
  color: 'var(--gold-primary)',
  letterSpacing: '4px',
  fontWeight: 900,
  margin: '0 0 0.5rem 0',
  textShadow: '0 0 24px rgb(var(--accent) / 0.3)'
}

export const taglineStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'rgba(255, 255, 255, 0.7)',
  textTransform: 'uppercase',
  letterSpacing: '2.5px',
  fontWeight: 700,
  margin: 0
}


const tabContainerStyle: React.CSSProperties = {
  display: 'flex',
  background: 'rgba(0, 0, 0, 0.4)',
  borderRadius: '16px',
  padding: '4px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  marginBottom: '1.75rem'
}

const activeTabStyle: React.CSSProperties = {
  flex: 1,
  background: 'linear-gradient(135deg, rgb(var(--accent) / 0.25) 0%, rgb(var(--accent) / 0.12) 100%)',
  border: '1px solid rgb(var(--accent) / 0.4)',
  borderRadius: '12px',
  color: '#FFFFFF',
  padding: '0.75rem',
  fontFamily: 'var(--font-body)',
  fontSize: '0.85rem',
  cursor: 'pointer',
  fontWeight: 800,
  boxShadow: '0 4px 12px rgb(var(--accent) / 0.15)',
  transition: 'all 0.3s ease'
}

const inactiveTabStyle: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: '12px',
  color: 'rgba(255, 255, 255, 0.5)',
  padding: '0.75rem',
  fontFamily: 'var(--font-body)',
  fontSize: '0.85rem',
  cursor: 'pointer',
  fontWeight: 600,
  transition: 'all 0.3s ease'
}

export const errorContainerStyle: React.CSSProperties = {
  background: 'rgba(239, 68, 68, 0.12)',
  border: '1px solid rgba(239, 68, 68, 0.3)',
  borderRadius: '14px',
  padding: '0.85rem 1rem',
  color: '#fca5a5',
  fontSize: '0.82rem',
  fontWeight: 600,
  marginBottom: '1.5rem',
  display: 'flex',
  alignItems: 'center'
}

export const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem'
}

export const inputGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.45rem',
  flex: 1
}

export const labelStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  color: 'rgba(255, 255, 255, 0.65)',
  textTransform: 'uppercase',
  letterSpacing: '1.5px',
  fontWeight: 800
}

export const inputStyle: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.5)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: '14px',
  padding: '0.85rem 1rem',
  color: '#FFFFFF',
  fontFamily: 'var(--font-body)',
  fontSize: '0.92rem',
  outline: 'none',
  transition: 'all 0.25s ease',
  boxSizing: 'border-box',
  width: '100%'
}

export const selectStyle: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.5)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: '14px',
  padding: '0.85rem 1rem',
  color: '#FFFFFF',
  fontFamily: 'var(--font-body)',
  fontSize: '0.92rem',
  outline: 'none',
  cursor: 'pointer',
  boxSizing: 'border-box',
  width: '100%'
}

export const textareaStyle: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.5)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: '14px',
  padding: '0.85rem 1rem',
  color: '#FFFFFF',
  fontFamily: 'var(--font-body)',
  fontSize: '0.92rem',
  outline: 'none',
  resize: 'none',
  boxSizing: 'border-box',
  width: '100%'
}

export const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
  width: '100%'
}

export const profileSectionStyle: React.CSSProperties = {
  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  paddingTop: '1.25rem',
  marginTop: '0.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.1rem'
}

export const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--gold-primary)',
  fontWeight: 800,
  margin: '0 0 0.5rem 0',
  display: 'flex',
  alignItems: 'center'
}

export const checkboxWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  flex: 1,
  paddingTop: '1.5rem'
}

export const checkboxStyle: React.CSSProperties = {
  cursor: 'pointer',
  width: '18px',
  height: '18px',
  accentColor: 'var(--gold-primary)'
}

export const checkboxLabelStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'rgba(255, 255, 255, 0.8)',
  cursor: 'pointer',
  fontWeight: 600
}

export const preferenceGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '0.75rem',
  marginTop: '0.5rem'
}

export const submitButtonStyle: React.CSSProperties = {
  marginTop: '1rem',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '0.9rem 1.5rem',
  fontSize: '0.85rem',
  fontWeight: 900,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  borderRadius: '14px',
  cursor: 'pointer',
  transition: 'all 0.25s ease',
  width: '100%'
}

const alertStyle: React.CSSProperties = {
  position: 'fixed',
  top: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(10, 10, 10, 0.9)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgb(var(--accent) / 0.4)',
  borderRadius: '16px',
  padding: '1rem 1.5rem',
  color: '#FFFFFF',
  display: 'flex',
  alignItems: 'center',
  gap: '0.8rem',
  zIndex: 1000,
  fontSize: '0.85rem',
  fontWeight: 600,
  boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6), 0 0 20px rgb(var(--accent) / 0.15)',
  width: '90%',
  maxWidth: '500px'
}


const socialDividerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  margin: '1.5rem 0 0.75rem'
}

const socialDividerLineStyle: React.CSSProperties = {
  flex: 1,
  height: '1px',
  background: 'rgba(255, 255, 255, 0.1)'
}

const socialDividerTextStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'rgba(255, 255, 255, 0.5)',
  textTransform: 'uppercase',
  letterSpacing: '1.5px',
  fontWeight: 700,
  whiteSpace: 'nowrap'
}


const oauthBtnStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.85rem 1rem',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: '14px',
  color: '#FFFFFF',
  fontSize: '0.85rem',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 0.25s ease'
}

const noticeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  padding: '0.75rem 1rem',
  borderRadius: '12px',
  border: '1px solid transparent',
  fontSize: '0.8rem'
}

const gruvsNoteStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  margin: '0.25rem 0 0',
  padding: '0.6rem 0.75rem',
  borderRadius: '12px',
  border: '1px solid transparent',
  fontSize: '0.75rem',
  lineHeight: 1.4,
  color: 'rgba(255, 255, 255, 0.6)'
}

const gruvsNoteActiveStyle: React.CSSProperties = {
  background: 'rgba(168, 85, 247, 0.12)',
  borderColor: 'rgba(168, 85, 247, 0.4)',
  color: 'rgba(255, 255, 255, 0.9)'
}

const roleChoiceStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.75rem 0.5rem',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  background: 'rgba(255, 255, 255, 0.04)',
  color: 'rgba(255, 255, 255, 0.75)',
  fontSize: '0.8rem',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 0.2s ease'
}

const roleChoiceActiveStyle: React.CSSProperties = {
  background: 'rgb(var(--accent))',
  borderColor: 'rgb(var(--accent))',
  color: '#000000',
  fontWeight: 900
}

const guestLinkStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: '0.75rem',
  padding: '0.5rem',
  background: 'none',
  border: 'none',
  color: 'rgba(255, 255, 255, 0.65)',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
  textDecoration: 'underline'
}
