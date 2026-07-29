'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { loginUser, registerFailedAttempt, resetFailedAttempts, addLog, RootState, toUUID } from '../../store'
import { supabase } from '../../utils/supabase'
import { Shield, User as UserIcon, Lock, Users, CheckCircle, AlertTriangle, Sun, Moon } from 'lucide-react'
import { cleanScriptTags, scanInput, checkPasswordStrength, encodeHTMLEntities } from '../../utils/security'

export default function AuthPage() {
  const router = useRouter()
  const dispatch = useDispatch()

  const [theme, setTheme] = useState<'day' | 'night'>('day')

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const currentTheme = document.documentElement.getAttribute('data-theme') as 'day' | 'night' || 'day'
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(currentTheme)
    }
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'day' ? 'night' : 'day'
    setTheme(nextTheme)
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', nextTheme)
    }
  }

  const failedAttempts = useSelector((state: RootState) => state.auth.failedAttempts)
  const lockedUntil = useSelector((state: RootState) => state.auth.lockedUntil)
  
  // Tab control: 'login' | 'signup'
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('signup')
  
  // Common Form Fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'tenant' | 'landlord'>('tenant')
  
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
        ip: '127.0.0.1',
        action: `Threats detected and neutralized: ${scan.threats.join(', ')}`,
        type: 'xss_blocked',
        details: `Sanitized input: ${original.substring(0, 100)} => ${sanitized.substring(0, 100)}`
      }))
      setSecurityMessage(`Security alert: ${scan.threats.length} threat(s) detected and neutralized (${scan.threats.join(', ')}).`)
      setTimeout(() => setSecurityMessage(null), 6000)
    }
    return sanitized
  }

  // Brute force check
  const isLocked = (emailKey: string) => {
    const lockTime = lockedUntil[emailKey] || 0
    if (lockTime > Date.now()) {
      return Math.ceil((lockTime - Date.now()) / 1000)
    }
    return 0
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setErrorMessage(null)

    // Check account lockout status
    const secondsLeft = isLocked(email)
    if (secondsLeft > 0) {
      dispatch(addLog({
        ip: '127.0.0.1',
        action: 'Attempted login to locked account blocked',
        type: 'brute_force_blocked',
        details: `Failed authorization request for locked account ${email}. Lock expires in ${secondsLeft}s.`
      }))
      setErrorMessage(`Account locked due to brute force protection. Try again in ${secondsLeft} seconds.`)
      return
    }

    if (!supabase) {
      setErrorMessage('Database offline / not configured.')
      return
    }

    // Real Supabase Login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      dispatch(registerFailedAttempt(email))
      const attempts = (failedAttempts[email] || 0) + 1
      
      dispatch(addLog({
        ip: '127.0.0.1',
        action: 'Failed login attempt recorded',
        type: 'auth_failed',
        details: `Incorrect credentials entered for ${email}. Failed attempts: ${attempts}/5`
      }))

      if (attempts >= 5) {
        setErrorMessage('Brute force defense triggered. Account locked for 60 seconds.')
      } else {
        setErrorMessage(`Invalid credentials: ${error.message} (Attempt ${attempts} of 5 before account lockout).`)
      }
      return
    }

    const session = data.session
    const user = data.user

    if (session && user) {
      // Session cookies are managed by @supabase/ssr (createBrowserClient);
      // middleware.ts validates them via supabase.auth.getUser().

      // ONE ACCOUNT across The Gruvs & The Resident: this idempotent, caller-only
      // RPC guarantees both the shared master profile AND the Resident satellite
      // exist — so someone who signed up on The Gruvs is whole here on first login
      // (and vice-versa). Server-side + auth.uid()-scoped; best-effort.
      await supabase.rpc('ensure_res_profile').then(() => {}, () => {})

      // Fetch their res_profile role
      const { data: dbProfile } = await supabase
        .from('res_profiles')
        .select('role')
        .eq('id', toUUID(user.id))
        .single()

      const userRole = dbProfile?.role || role || 'visitor'

      dispatch(resetFailedAttempts(email))
      dispatch(loginUser({
        id: user.id,
        name: user.user_metadata?.name || name || 'Resident User',
        email: user.email!,
        role: userRole as 'tenant' | 'landlord' | 'visitor',
        balance: 0
      }))

      dispatch(addLog({
        ip: '127.0.0.1',
        action: `Logged in safely: Supabase session authenticated`,
        type: 'auth_success',
        details: `Email: ${email}`
      }))

      router.push('/dashboard')
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !name) return

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
        balance: 0
      }))

      dispatch(addLog({
        ip: '127.0.0.1',
        action: `New account onboarded: Supabase auth created`,
        type: 'auth_success',
        details: `Created account for ${sanitizedName}.`
      }))

      router.push('/dashboard')
    }
  }

  const handleSocialLogin = async (provider: 'google' | 'facebook' | 'apple' | 'gruvs') => {
    if (provider === 'gruvs') {
      // Direct Single Sign-On bridge to thegruvs.com
      window.location.href = 'https://thegruvs.com/auth?redirect=the-resident-crew'
      return
    }

    if (!supabase) {
      setErrorMessage('Database offline / not configured.')
      return
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider as 'google' | 'facebook' | 'apple',
      options: {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined
      }
    })

    if (error) {
      setErrorMessage(`Social authentication failed: ${error.message}`)
    }
  }

  const handleVisitorLogin = () => {
    // Visitor guests don't have Supabase auth records, so we set a guest token
    const visitorUser = {
      id: 'visitor-guest',
      name: 'Guest Visitor',
      email: 'visitor@theresident.co.za',
      role: 'visitor' as const,
      balance: 0,
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
      ip: '127.0.0.1',
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
        title="Toggle Day/Night Theme"
      >
        {theme === 'day' ? <Moon size={16} /> : <Sun size={16} />}
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

        {activeTab === 'login' ? (
          <form onSubmit={handleLogin} style={formStyle}>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Access Role</label>
              <select 
                value={role} 
                onChange={(e) => setRole(e.target.value as 'tenant' | 'landlord')}
                style={selectStyle}
              >
                <option value="tenant">I am a Tenant looking for a Room</option>
                <option value="landlord">I am a Landlord renting out Rooms</option>
              </select>
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
              <label style={labelStyle}>Password (Test lockout with bad inputs)</label>
              <input 
                type="password" 
                required 
                placeholder="Correct password is: securepass" 
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
              className="btn-gold"
              style={{ ...submitButtonStyle, background: 'rgba(212, 175, 55, 0.05)', borderStyle: 'dashed' }}
            >
              Continue as Visitor (Guest)
            </button>

            {/* Social / Cross-App Sign-In */}
            <div style={socialDividerStyle}>
              <span style={socialDividerLineStyle} />
              <span style={socialDividerTextStyle}>or continue with</span>
              <span style={socialDividerLineStyle} />
            </div>

            <button
              type="button"
              onClick={() => handleSocialLogin('gruvs')}
              style={gruvsBtnStyle}
            >
              <span style={gruvsBtnIconStyle}>🎵</span>
              Sign in with The Gruvs
            </button>

            <div style={socialRowStyle}>
              <button type="button" onClick={() => handleSocialLogin('google')} style={socialBtnStyle} title="Sign in with Google">
                <svg width="18" height="18" viewBox="0 0 48 48" style={{ display: 'block' }}>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.2 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.96 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Google
              </button>
              <button type="button" onClick={() => handleSocialLogin('facebook')} style={socialBtnStyle} title="Sign in with Facebook">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2" style={{ display: 'block' }}>
                  <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
                </svg>
                Facebook
              </button>
              <button type="button" onClick={() => handleSocialLogin('apple')} style={socialBtnStyle} title="Sign in with Apple">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}>
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                Apple
              </button>
            </div>
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
                  value={role} 
                  onChange={(e) => setRole(e.target.value as 'tenant' | 'landlord')}
                  style={selectStyle}
                >
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
              className="btn-gold"
              style={{ ...submitButtonStyle, background: 'rgba(212, 175, 55, 0.05)', borderStyle: 'dashed' }}
            >
              Continue as Visitor (Guest)
            </button>

            {/* Social / Cross-App Sign-In */}
            <div style={socialDividerStyle}>
              <span style={socialDividerLineStyle} />
              <span style={socialDividerTextStyle}>or sign up with</span>
              <span style={socialDividerLineStyle} />
            </div>

            <button
              type="button"
              onClick={() => handleSocialLogin('gruvs')}
              style={gruvsBtnStyle}
            >
              <span style={gruvsBtnIconStyle}>🎵</span>
              Sign up with The Gruvs
            </button>

            <div style={socialRowStyle}>
              <button type="button" onClick={() => handleSocialLogin('google')} style={socialBtnStyle} title="Sign up with Google">
                <svg width="18" height="18" viewBox="0 0 48 48" style={{ display: 'block' }}>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.2 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.96 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Google
              </button>
              <button type="button" onClick={() => handleSocialLogin('facebook')} style={socialBtnStyle} title="Sign up with Facebook">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2" style={{ display: 'block' }}>
                  <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
                </svg>
                Facebook
              </button>
              <button type="button" onClick={() => handleSocialLogin('apple')} style={socialBtnStyle} title="Sign up with Apple">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}>
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                Apple
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  )
}

// Styles
const containerStyle: React.CSSProperties = {
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

const overlayStyle: React.CSSProperties = {
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

const glassPanelStyle: React.CSSProperties = {
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

const headerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: '1.5rem'
}

const logoStyle: React.CSSProperties = {
  fontSize: '2rem',
  fontFamily: 'var(--font-heading), serif',
  color: 'var(--gold-primary)',
  letterSpacing: '4px',
  margin: '0 0 0.5rem 0'
}

const taglineStyle: React.CSSProperties = {
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

const activeTabStyle: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  border: 'none',
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
  border: 'none',
  color: 'var(--foreground)',
  opacity: 0.5,
  padding: '0.75rem',
  fontFamily: 'var(--font-body)',
  fontSize: '0.9rem',
  cursor: 'pointer',
  transition: 'all 0.3s ease'
}

const errorContainerStyle: React.CSSProperties = {
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

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.2rem'
}

const inputGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
  flex: 1
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--foreground)',
  opacity: 0.8,
  textTransform: 'uppercase',
  letterSpacing: '1px'
}

const inputStyle: React.CSSProperties = {
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

const selectStyle: React.CSSProperties = {
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

const textareaStyle: React.CSSProperties = {
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

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
  width: '100%'
}

const profileSectionStyle: React.CSSProperties = {
  borderTop: '1px dashed var(--glass-border)',
  paddingTop: '1.2rem',
  marginTop: '0.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--gold-primary)',
  margin: '0 0 0.5rem 0',
  display: 'flex',
  alignItems: 'center'
}

const checkboxWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  flex: 1,
  paddingTop: '1.5rem'
}

const checkboxStyle: React.CSSProperties = {
  cursor: 'pointer',
  width: '18px',
  height: '18px',
  accentColor: 'var(--gold-primary)'
}

const checkboxLabelStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--foreground)',
  cursor: 'pointer'
}

const preferenceGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '0.5rem',
  marginTop: '0.5rem'
}

const submitButtonStyle: React.CSSProperties = {
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

const gruvsBtnIconStyle: React.CSSProperties = {
  fontSize: '1.1rem',
  lineHeight: 1
}

const socialRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '0.6rem'
}

const socialBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.4rem',
  padding: '0.6rem 0.5rem',
  background: 'var(--glass-bg)',
  border: '1px solid var(--glass-border)',
  borderRadius: '8px',
  color: 'var(--foreground)',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s ease'
}
