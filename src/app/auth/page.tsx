'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { loginUser, registerFailedAttempt, resetFailedAttempts, addLog, RootState } from '../../store'
import { Shield, User as UserIcon, Lock, Users, CheckCircle, AlertTriangle } from 'lucide-react'
import { cleanScriptTags, scanInput, checkPasswordStrength, encodeHTMLEntities } from '../../utils/security'

// SHA-256 Hashing helper using Web Crypto API
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function AuthPage() {
  const router = useRouter()
  const dispatch = useDispatch()

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

    // Hash the password to keep it secure
    const hash = await sha256(password)

    // Simulate incorrect password if it doesn't match a test value
    // (We consider "securepass" as the only correct password for testing lockout)
    if (password !== 'securepass') {
      dispatch(registerFailedAttempt(email))
      const attempts = (failedAttempts[email] || 0) + 1
      
      dispatch(addLog({
        ip: '127.0.0.1',
        action: 'Failed login attempt recorded',
        type: 'auth_failed',
        details: `Incorrect password entered for ${email}. Failed attempts: ${attempts}/5`
      }))

      if (attempts >= 5) {
        setErrorMessage('Brute force defense triggered. Account locked for 60 seconds.')
      } else {
        setErrorMessage(`Invalid credentials. Attempt ${attempts} of 5 before account lockout. (Use password "securepass" to log in).`)
      }
      return
    }

    // Success login
    const mockUser = {
      id: role === 'tenant' ? 'tenant-100' : 'landlord-100',
      name: role === 'tenant' ? 'Global Tenant' : 'Global Landlord',
      email: email,
      role: role,
      passwordHash: hash,
      balance: role === 'tenant' ? 850 : 4500,
      profile: role === 'tenant' ? {
        bio: 'Looking for a clean flat close to bus and tube stations.',
        gender: 'any' as const,
        childrenCount: 0,
        employmentStatus: 'Employed',
        hasPets: false
      } : undefined,
      preferences: role === 'landlord' ? {
        genderPreference: 'any' as const,
        childrenAllowed: true,
        maxChildren: 2,
        smokingAllowed: false,
        petsAllowed: false
      } : undefined
    }

    document.cookie = `session-token=mock-jwt-token; path=/; max-age=3600`
    
    dispatch(resetFailedAttempts(email))
    dispatch(loginUser(mockUser))
    dispatch(addLog({
      ip: '127.0.0.1',
      action: `Logged in safely: hash verified`,
      type: 'auth_success',
      details: `Email: ${email} | Hash: ${hash.substr(0, 16)}...`
    }))
    
    router.push('/dashboard')
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !name) return

    setErrorMessage(null)

    if (passwordStrength && !passwordStrength.strong) {
      setErrorMessage('Please choose a stronger password. ' + (passwordStrength.feedback[0] || ''))
      return
    }

    const sanitizedName = sanitizeInput(name)
    const sanitizedBio = sanitizeInput(bio)
    const hash = await sha256(password)

    const newUser = {
      id: role === 'tenant' ? `tenant-${Date.now()}` : `landlord-${Date.now()}`,
      name: sanitizedName,
      email: email,
      role: role,
      passwordHash: hash,
      balance: role === 'tenant' ? 500 : 2500,
      profile: role === 'tenant' ? {
        bio: sanitizedBio || 'No biography details provided.',
        gender,
        childrenCount,
        employmentStatus,
        hasPets
      } : undefined,
      preferences: role === 'landlord' ? {
        genderPreference,
        childrenAllowed,
        maxChildren,
        smokingAllowed,
        petsAllowed
      } : undefined
    }

    document.cookie = `session-token=mock-jwt-token; path=/; max-age=3600`
    
    dispatch(resetFailedAttempts(email))
    dispatch(loginUser(newUser))
    dispatch(addLog({
      ip: '127.0.0.1',
      action: `New account onboarded with password hash`,
      type: 'auth_success',
      details: `Created account for ${newUser.name}. Password hash generated: ${hash.substr(0, 16)}...`
    }))

    router.push('/dashboard')
  }

  const handleVisitorLogin = () => {
    const visitorUser = {
      id: 'visitor-guest',
      name: 'Guest Visitor',
      email: 'visitor@theresident.co.za',
      role: 'visitor' as const,
      balance: 100,
      profile: {
        bio: 'Browsing the directory as a guest.',
        gender: 'any' as const,
        childrenCount: 0,
        employmentStatus: 'Visitor',
        hasPets: false
      }
    }

    document.cookie = `session-token=guest-token; path=/; max-age=3600`
    
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
  background: '#0d0d0d',
  boxSizing: 'border-box',
  overflowX: 'hidden'
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(212, 175, 55, 0.08) 0%, transparent 40%), radial-gradient(circle at 70% 80%, rgba(255, 105, 180, 0.05) 0%, transparent 40%)',
  zIndex: 0,
  pointerEvents: 'none'
}

const glassPanelStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  width: '100%',
  maxWidth: '540px',
  background: 'rgba(255, 255, 255, 0.03)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(212, 175, 55, 0.2)',
  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.8), 0 0 20px rgba(212,175,55,0.05)',
  borderRadius: '16px',
  padding: '2.5rem',
  color: '#ededed',
  boxSizing: 'border-box'
}

const headerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: '1.5rem'
}

const logoStyle: React.CSSProperties = {
  fontSize: '2rem',
  fontFamily: 'var(--font-heading), serif',
  color: '#D4AF37',
  letterSpacing: '4px',
  margin: '0 0 0.5rem 0'
}

const taglineStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#a0a0a0',
  textTransform: 'uppercase',
  letterSpacing: '2px',
  margin: 0
}

const tabContainerStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  marginBottom: '1.5rem'
}

const activeTabStyle: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  borderBottom: '2px solid #D4AF37',
  color: '#D4AF37',
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
  color: '#888',
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
  color: '#fff',
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
  color: '#c0c0c0',
  textTransform: 'uppercase',
  letterSpacing: '1px'
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.4)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '6px',
  padding: '0.75rem',
  color: '#fff',
  fontFamily: 'var(--font-body)',
  fontSize: '0.9rem',
  outline: 'none',
  transition: 'border-color 0.3s ease',
  boxSizing: 'border-box',
  width: '100%'
}

const selectStyle: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.4)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '6px',
  padding: '0.75rem',
  color: '#fff',
  fontFamily: 'var(--font-body)',
  fontSize: '0.9rem',
  outline: 'none',
  cursor: 'pointer',
  boxSizing: 'border-box',
  width: '100%'
}

const textareaStyle: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.4)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '6px',
  padding: '0.75rem',
  color: '#fff',
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
  borderTop: '1px dashed rgba(212, 175, 55, 0.2)',
  paddingTop: '1.2rem',
  marginTop: '0.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#D4AF37',
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
  accentColor: '#D4AF37'
}

const checkboxLabelStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#ededed',
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
  background: 'rgba(13, 13, 13, 0.95)',
  border: '1px solid #D4AF37',
  borderRadius: '8px',
  padding: '1rem 1.5rem',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  gap: '0.8rem',
  zIndex: 1000,
  fontSize: '0.85rem',
  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
  width: '90%',
  maxWidth: '500px'
}
