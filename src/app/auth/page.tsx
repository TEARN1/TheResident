'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { loginUser, resetFailedAttempts, addLog, RootState, AppDispatch, toUUID, GUEST_USER_ID } from '../../store'
import { supabase } from '../../utils/supabase'
import { performLogin } from '../../utils/authLogin'
import { Shield, User as UserIcon, Lock, Users, CheckCircle, AlertTriangle, Sun, Moon } from 'lucide-react'
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

export default function AuthPage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()

  // Shared across the WHOLE app now — 'residentTheme' in localStorage, the
  // same key the dashboard reads/writes (see dashboard/layout.tsx,
  // dashboard/profile/page.tsx). This used to be DOM-only here (never
  // persisted), so a theme choice made on this page silently reverted the
  // next time any page reloaded, and never touched the dashboard's own
  // separate 'dashboardTheme' key at all.
  const [theme, setTheme] = useState<'light' | 'night'>('night')

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('residentTheme') : null
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage/DOM on mount
    setTheme(stored === 'light' ? 'light' : 'night')
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'night' ? 'light' : 'night'
    setTheme(nextTheme)
    if (typeof window !== 'undefined') {
      localStorage.setItem('residentTheme', nextTheme)
      document.documentElement.setAttribute('data-theme', nextTheme)
    }
  }

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
  
  // Tenant Profile Fields
  const [bio, setBio] = useState('')
  const [gender, setGender] = useState<'men' | 'women' | 'any'>('any')
  const [childrenCount, setChildrenCount] = useState(0)
  const [employmentStatus, setEmploymentStatus] = useState('Employed')
  const [hasPets, setHasPets] = useState(false)
  
  // Landlord Preference Fields
  const [genderPreference, setGenderPreference] = useState<'men' | 'women' | 'couple' | 'any'>('any')
  const [childrenAllowed, setChildrenAllowed] = useState(true)
  const [maxChildren, setMaxChildren] = useState(2)
  const [smokingAllowed, setSmokingAllowed] = useState(false)
  const [petsAllowed, setPetsAllowed] = useState(false)

  // Message states
  const [securityMessage, setSecurityMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // "Sign in with The Gruvs" mode — shows the one-account helper on the login form.
  const [gruvsMode, setGruvsMode] = useState(false)
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
    if (!email || !password || !role) return

    setErrorMessage(null)
    const result = await performLogin({ email, password, dispatch, failedAttempts, lockedUntil, fallbackRole: role })
    if (!result.ok) {
      setErrorMessage(result.error)
      return
    }
    router.push(result.needsOnboarding ? '/auth/onboarding' : '/dashboard')
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !name || !role) return

    setErrorMessage(null)

    if (passwordStrength && !passwordStrength.strong) {
      setErrorMessage('Please choose a stronger password. ' + (passwordStrength.feedback[0] || ''))
      return
    }

    if (!supabase) {
      setErrorMessage('Database offline / not configured.')
      return
    }

    const sanitizedName = sanitizeInput(name)
    const sanitizedBio = sanitizeInput(bio)

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
        bio: sanitizedBio || null,
        gender: role === 'tenant' ? gender : null,
        children_count: role === 'tenant' ? childrenCount : 0,
        employment_status: role === 'tenant' ? employmentStatus : null,
        has_pets: role === 'tenant' ? hasPets : false,
        landlord_gender_pref: role === 'landlord' ? genderPreference : null,
        landlord_children_allowed: role === 'landlord' ? childrenAllowed : true,
        landlord_max_children: role === 'landlord' ? maxChildren : 0,
        landlord_smoking_allowed: role === 'landlord' ? smokingAllowed : false,
        landlord_pets_allowed: role === 'landlord' ? petsAllowed : false
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

      router.push('/dashboard')
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

  const handleGruvsSSO = () => {
    // One account across The Gruvs & The Resident — they share the SAME Supabase
    // Auth project, so there is no separate "Gruvs password": your Gruvs email +
    // password ARE your login here. A cross-domain redirect to thegruvs.com can't
    // hand a session back (it's a static SPA with no SSO endpoint), so instead we
    // drop straight into the login form with a clear one-account note. On submit,
    // handleLogin() calls ensure_res_profile() to set up the Resident side
    // automatically — a Gruvs user becomes whole here on their first sign-in.
    setActiveTab('login')
    setGruvsMode(true)
    setErrorMessage(null)
    if (typeof document !== 'undefined') {
      setTimeout(() => {
        const el = document.querySelector<HTMLInputElement>('input[type="email"]')
        el?.focus()
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 60)
    }
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

    document.cookie = `guest-mode=1; path=/; max-age=3600`
    
    dispatch(resetFailedAttempts(email))
    dispatch(loginUser(visitorUser))
    dispatch(addLog({
      action: 'Entered application in Guest / Visitor mode',
      type: 'auth_success',
      details: 'Browsing limits applied'
    }))

    router.push('/dashboard')
  }

  return (
    <div style={containerStyle}>
      <div style={overlayStyle} />
      
      <button
        onClick={toggleTheme}
        style={themeToggleStyle}
        title={theme === 'night' ? 'Switch to light theme' : 'Switch to dark theme'}
        aria-label={theme === 'night' ? 'Switch to light theme' : 'Switch to dark theme'}
        aria-pressed={theme === 'light'}
      >
        {theme === 'night' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      
      {securityMessage && (
        <div style={alertStyle}>
          <Shield size={20} color="#D4AF37" />
          <span>{securityMessage}</span>
        </div>
      )}

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="responsive-glass-panel"
        style={glassPanelStyle}
      >
        <div style={headerStyle}>
          <h2 style={logoStyle}>THE RESIDENT</h2>
          <p style={taglineStyle}>Verified Co-Living & Rental Portal</p>
          <p style={crossAppNoteStyle}>One account — the same login works on The Gruvs</p>
        </div>

        {/* Tab Selection */}
        <div style={tabContainerStyle}>
          <button 
            style={activeTab === 'signup' ? activeTabStyle : inactiveTabStyle}
            onClick={() => setActiveTab('signup')}
          >
            Create Profile
          </button>
          <button 
            style={activeTab === 'login' ? activeTabStyle : inactiveTabStyle}
            onClick={() => setActiveTab('login')}
          >
            Log In
          </button>
        </div>

        {errorMessage && (
          <div style={errorContainerStyle}>
            <AlertTriangle size={16} color="#ef4444" style={{ marginRight: 8 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {gruvsMode && activeTab === 'login' && (
          <div style={gruvsBannerStyle}>
            <GruvsMark />
            <span>
              <strong>One account.</strong> Sign in with the same email &amp; password you use on
              The Gruvs — we&apos;ll set up your Resident profile automatically.
            </span>
          </div>
        )}

        {/* Google temporarily pulled — Supabase provider isn't configured yet. */}
        <div style={oauthRowStyle}>
          <button
            type="button"
            onClick={() => handleOAuth('facebook')}
            disabled={oauthLoading !== null}
            style={oauthBtnStyle}
          >
            {oauthLoading === 'facebook' ? 'Connecting…' : 'Continue with Facebook'}
          </button>
        </div>
        <div style={socialDividerStyle}>
          <span style={socialDividerLineStyle} />
          <span style={socialDividerTextStyle}>or</span>
          <span style={socialDividerLineStyle} />
        </div>

        {activeTab === 'login' ? (
          <form onSubmit={handleLogin} style={formStyle}>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Access Role</label>
              <select
                required
                value={role}
                onChange={(e) => setRole(e.target.value as 'tenant' | 'landlord')}
                style={selectStyle}
              >
                <option value="" disabled>Select your role…</option>
                <option value="tenant">I am a Tenant looking for a Room</option>
                <option value="landlord">I am a Landlord renting out Rooms</option>
              </select>
              <p style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
                Only used to set up your account the very first time you sign in — ignored after that.
                Got the wrong one? Fix it any time from Profile → Switch role.
              </p>
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Email Address</label>
              <input 
                type="email" 
                required 
                placeholder="enter your email..." 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                required
                placeholder="enter your password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
              />
            </div>

            <button type="submit" className="btn-primary" style={submitButtonStyle}>
              Grant Access <Lock size={14} style={{ marginLeft: 8 }} />
            </button>

            <button
              type="button"
              onClick={handleVisitorLogin}
              className="btn-outline"
              style={submitButtonStyle}
            >
              <UserIcon size={15} style={{ marginRight: 6 }} /> Continue as Visitor (Guest)
            </button>

            {/* Cross-App Sign-In (one account works on both The Resident and The Gruvs) */}
            <div style={socialDividerStyle}>
              <span style={socialDividerLineStyle} />
              <span style={socialDividerTextStyle}>or use your Gruvs account</span>
              <span style={socialDividerLineStyle} />
            </div>

            <button
              type="button"
              onClick={handleGruvsSSO}
              style={gruvsBtnStyle}
            >
              <GruvsMark />
              Sign in with The Gruvs
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup} style={formStyle}>
            <div style={rowStyle}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Full Name</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Sarah Connor" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Account Role</label>
                <select
                  required
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'tenant' | 'landlord')}
                  style={selectStyle}
                >
                  <option value="" disabled>Select your role…</option>
                  <option value="tenant">Tenant</option>
                  <option value="landlord">Landlord</option>
                </select>
              </div>
            </div>

            <div style={rowStyle}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Email</label>
                <input 
                  type="email" 
                  required 
                  placeholder="name@domain.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Password</label>
                <input 
                  type="password" 
                  required 
                  placeholder="secure key..." 
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  style={inputStyle}
                />
                {passwordStrength && (
                  <div style={{marginTop: '4px'}}>
                    <div style={{display: 'flex', gap: '3px', marginBottom: '4px'}}>
                      {[...Array(6)].map((_, i) => (
                        <div key={i} style={{
                          flex: 1, height: '4px', borderRadius: '2px',
                          background: i < passwordStrength.score 
                            ? passwordStrength.score >= 4 ? '#4CAF50' : passwordStrength.score >= 2 ? '#FFC107' : '#F44336'
                            : 'rgba(255,255,255,0.15)'
                        }} />
                      ))}
                    </div>
                    <span style={{fontSize: '11px', color: passwordStrength.strong ? '#4CAF50' : '#FFC107'}}>
                      {passwordStrength.strong ? '✅ Strong password' : `⚠️ ${passwordStrength.feedback[0] || 'Weak password'}`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Role-Based Onboarding */}
            {role === 'tenant' ? (
              <div style={profileSectionStyle}>
                <h4 style={sectionHeaderStyle}><UserIcon size={14} style={{ marginRight: 6 }} /> Tenant Requirement Profile</h4>
                
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>About Yourself / Intro bio</label>
                  <textarea 
                    rows={2} 
                    placeholder="Tell landlords about yourself, your cleanliness habits, etc." 
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    style={textareaStyle}
                  />
                </div>

                <div style={rowStyle}>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Gender</label>
                    <select 
                      value={gender} 
                      onChange={(e) => setGender(e.target.value as 'men' | 'women' | 'any')}
                      style={selectStyle}
                    >
                      <option value="any">Any / Rather not say</option>
                      <option value="men">Male</option>
                      <option value="women">Female</option>
                    </select>
                  </div>
                  
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Number of Children</label>
                    <input 
                      type="number" 
                      min={0} 
                      max={10} 
                      value={childrenCount}
                      onChange={(e) => setChildrenCount(parseInt(e.target.value) || 0)}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={rowStyle}>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Employment Status</label>
                    <select 
                      value={employmentStatus} 
                      onChange={(e) => setEmploymentStatus(e.target.value)}
                      style={selectStyle}
                    >
                      <option value="Employed">Full-time Employed</option>
                      <option value="Self-Employed">Self-Employed</option>
                      <option value="Student">Student</option>
                      <option value="Unemployed">Other / Unemployed</option>
                    </select>
                  </div>
                  
                  <div style={checkboxWrapperStyle}>
                    <input 
                      type="checkbox" 
                      id="hasPets" 
                      checked={hasPets} 
                      onChange={(e) => setHasPets(e.target.checked)}
                      style={checkboxStyle}
                    />
                    <label htmlFor="hasPets" style={checkboxLabelStyle}>I have pets</label>
                  </div>
                </div>
              </div>
            ) : (
              <div style={profileSectionStyle}>
                <h4 style={sectionHeaderStyle}><Users size={14} style={{ marginRight: 6 }} /> Landlord Preferences & Rules</h4>
                
                <div style={rowStyle}>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Gender Preference</label>
                    <select 
                      value={genderPreference} 
                      onChange={(e) => setGenderPreference(e.target.value as 'men' | 'women' | 'couple' | 'any')}
                      style={selectStyle}
                    >
                      <option value="any">Any Welcomed</option>
                      <option value="men">Men Only</option>
                      <option value="women">Women Only</option>
                      <option value="couple">Couples Only</option>
                    </select>
                  </div>

                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Max Children Allowed</label>
                    <input 
                      type="number" 
                      min={0} 
                      max={10} 
                      value={maxChildren}
                      onChange={(e) => setMaxChildren(parseInt(e.target.value) || 0)}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div className="responsive-pref-grid" style={preferenceGridStyle}>
                  <div style={checkboxWrapperStyle}>
                    <input 
                      type="checkbox" 
                      id="childrenAllowed" 
                      checked={childrenAllowed} 
                      onChange={(e) => setChildrenAllowed(e.target.checked)}
                      style={checkboxStyle}
                    />
                    <label htmlFor="childrenAllowed" style={checkboxLabelStyle}>Children Allowed</label>
                  </div>

                  <div style={checkboxWrapperStyle}>
                    <input 
                      type="checkbox" 
                      id="smokingAllowed" 
                      checked={smokingAllowed} 
                      onChange={(e) => setSmokingAllowed(e.target.checked)}
                      style={checkboxStyle}
                    />
                    <label htmlFor="smokingAllowed" style={checkboxLabelStyle}>Smoking Allowed</label>
                  </div>

                  <div style={checkboxWrapperStyle}>
                    <input 
                      type="checkbox" 
                      id="petsAllowed" 
                      checked={petsAllowed} 
                      onChange={(e) => setPetsAllowed(e.target.checked)}
                      style={checkboxStyle}
                    />
                    <label htmlFor="petsAllowed" style={checkboxLabelStyle}>Pets Allowed</label>
                  </div>
                </div>
              </div>
            )}

            <button type="submit" className="btn-gold" style={submitButtonStyle}>
              Confirm Profile & Enter <CheckCircle size={14} style={{ marginLeft: 8 }} />
            </button>

            <button
              type="button"
              onClick={handleVisitorLogin}
              className="btn-outline"
              style={submitButtonStyle}
            >
              <UserIcon size={15} style={{ marginRight: 6 }} /> Continue as Visitor (Guest)
            </button>

            {/* Cross-App Sign-In (one account works on both The Resident and The Gruvs) */}
            <div style={socialDividerStyle}>
              <span style={socialDividerLineStyle} />
              <span style={socialDividerTextStyle}>or sign up with Gruvs</span>
              <span style={socialDividerLineStyle} />
            </div>

            <button
              type="button"
              onClick={handleGruvsSSO}
              style={gruvsBtnStyle}
            >
              <GruvsMark />
              Sign up with The Gruvs
            </button>
          </form>
        )}
      </motion.div>
    </div>
  )
}

// Styles
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

const themeToggleStyle: React.CSSProperties = {
  position: 'absolute',
  top: '20px',
  right: '20px',
  zIndex: 10,
  background: 'var(--glass-bg)',
  border: '1px solid var(--glass-border)',
  borderRadius: '50%',
  width: '40px',
  height: '40px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  color: 'var(--gold-primary)',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  boxShadow: '0 4px 6px -1px var(--shadow-color)'
}

export const glassPanelStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  width: '100%',
  maxWidth: '540px',
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid var(--glass-border)',
  boxShadow: '0 8px 32px 0 var(--shadow-color), 0 0 20px var(--gold-dim)',
  borderRadius: '16px',
  padding: '2.5rem',
  color: 'var(--foreground)',
  boxSizing: 'border-box'
}

export const headerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: '1.5rem'
}

export const logoStyle: React.CSSProperties = {
  fontSize: '2rem',
  fontFamily: 'var(--font-heading), serif',
  color: 'var(--gold-primary)',
  letterSpacing: '4px',
  margin: '0 0 0.5rem 0'
}

export const taglineStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--foreground)',
  opacity: 0.6,
  textTransform: 'uppercase',
  letterSpacing: '2px',
  margin: 0
}

const crossAppNoteStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--gold-primary)',
  opacity: 0.75,
  letterSpacing: '1px',
  margin: '0.4rem 0 0 0'
}

const tabContainerStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid var(--glass-border)',
  marginBottom: '1.5rem'
}

// Both objects share the exact same property keys (only borderBottom's value
// differs) so React never has to add/remove a style property when the active
// tab changes — mixing the `border` shorthand with the `borderBottom`
// longhand on one object triggers a React dev warning and is fragile to diff.
const activeTabStyle: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  borderTop: 'none',
  borderLeft: 'none',
  borderRight: 'none',
  borderBottom: '2px solid var(--gold-primary)',
  color: 'var(--gold-primary)',
  padding: '0.75rem',
  fontFamily: 'var(--font-body)',
  fontSize: '0.9rem',
  cursor: 'pointer',
  fontWeight: 'bold',
  transition: 'all 0.3s ease'
}

const inactiveTabStyle: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  borderTop: 'none',
  borderLeft: 'none',
  borderRight: 'none',
  borderBottom: '2px solid transparent',
  color: 'var(--foreground)',
  opacity: 0.5,
  padding: '0.75rem',
  fontFamily: 'var(--font-body)',
  fontSize: '0.9rem',
  cursor: 'pointer',
  transition: 'all 0.3s ease'
}

export const errorContainerStyle: React.CSSProperties = {
  background: 'rgba(239, 68, 68, 0.15)',
  border: '1px solid #ef4444',
  borderRadius: '6px',
  padding: '0.8rem',
  color: 'var(--foreground)',
  fontSize: '0.8rem',
  marginBottom: '1.5rem',
  display: 'flex',
  alignItems: 'center'
}

export const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.2rem'
}

export const inputGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
  flex: 1
}

export const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--foreground)',
  opacity: 0.8,
  textTransform: 'uppercase',
  letterSpacing: '1px'
}

export const inputStyle: React.CSSProperties = {
  background: 'var(--input-bg)',
  border: '1px solid var(--glass-border)',
  borderRadius: '6px',
  padding: '0.75rem',
  color: 'var(--foreground)',
  fontFamily: 'var(--font-body)',
  fontSize: '0.9rem',
  outline: 'none',
  transition: 'border-color 0.3s ease',
  boxSizing: 'border-box',
  width: '100%'
}

export const selectStyle: React.CSSProperties = {
  background: 'var(--input-bg)',
  border: '1px solid var(--glass-border)',
  borderRadius: '6px',
  padding: '0.75rem',
  color: 'var(--foreground)',
  fontFamily: 'var(--font-body)',
  fontSize: '0.9rem',
  outline: 'none',
  cursor: 'pointer',
  boxSizing: 'border-box',
  width: '100%'
}

export const textareaStyle: React.CSSProperties = {
  background: 'var(--input-bg)',
  border: '1px solid var(--glass-border)',
  borderRadius: '6px',
  padding: '0.75rem',
  color: 'var(--foreground)',
  fontFamily: 'var(--font-body)',
  fontSize: '0.9rem',
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
  borderTop: '1px dashed var(--glass-border)',
  paddingTop: '1.2rem',
  marginTop: '0.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
}

export const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--gold-primary)',
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
  color: 'var(--foreground)',
  cursor: 'pointer'
}

export const preferenceGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '0.5rem',
  marginTop: '0.5rem'
}

export const submitButtonStyle: React.CSSProperties = {
  marginTop: '1rem',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '0.9rem',
  fontSize: '0.9rem',
  fontWeight: 'bold',
  letterSpacing: '2px',
  width: '100%'
}

const alertStyle: React.CSSProperties = {
  position: 'fixed',
  top: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'var(--sidebar-bg)',
  border: '1px solid var(--gold-primary)',
  borderRadius: '8px',
  padding: '1rem 1.5rem',
  color: 'var(--foreground)',
  display: 'flex',
  alignItems: 'center',
  gap: '0.8rem',
  zIndex: 1000,
  fontSize: '0.85rem',
  boxShadow: '0 4px 20px var(--shadow-color)',
  width: '90%',
  maxWidth: '500px'
}

// Social login styles
const gruvsBannerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  background: 'var(--gold-dim, rgba(212,175,55,0.10))',
  border: '1px solid var(--gold-primary, #D4AF37)',
  borderRadius: '10px',
  padding: '12px 14px',
  marginBottom: '16px',
  color: 'var(--foreground)',
  fontSize: '0.8rem',
  lineHeight: 1.4,
}

const socialDividerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  margin: '1.25rem 0 0.5rem'
}

const socialDividerLineStyle: React.CSSProperties = {
  flex: 1,
  height: '1px',
  background: 'var(--glass-border)'
}

const socialDividerTextStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--foreground)',
  opacity: 0.5,
  textTransform: 'uppercase',
  letterSpacing: '1.5px',
  whiteSpace: 'nowrap'
}

const oauthRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  marginTop: '0.25rem'
}

const oauthBtnStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.7rem 0.5rem',
  background: 'var(--input-bg)',
  border: '1px solid var(--glass-border)',
  borderRadius: '10px',
  color: 'var(--foreground)',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.25s ease'
}

const gruvsBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.6rem',
  width: '100%',
  padding: '0.75rem 1rem',
  marginBottom: '0.75rem',
  background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.05) 100%)',
  border: '1.5px solid var(--gold-primary)',
  borderRadius: '10px',
  color: 'var(--gold-primary)',
  fontSize: '0.9rem',
  fontWeight: 700,
  letterSpacing: '0.5px',
  cursor: 'pointer',
  transition: 'all 0.25s ease',
  boxShadow: '0 0 12px rgba(212, 175, 55, 0.12)'
}

