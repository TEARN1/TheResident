'use client'

// One-time Resident profile completion for a Gruvs/Google/Facebook cross-app
// login. ensure_res_profile() (dashboard/layout.tsx, authLogin.ts, and the
// OAuth callback route) creates a bare res_profiles row — role: 'visitor',
// bio: null — the first time any of those paths sees a session with none.
// That's a fine default to unblock login, but it left cross-signup users
// silently parked with defaults instead of the real tenant/landlord profile
// every direct-signup user fills in. This form is that missing step, reusing
// the exact same fields (and visual styling) as the signup form.

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { User as UserIcon, Users, AlertTriangle } from 'lucide-react'
import { loginUser, RootState, AppDispatch } from '../../../store'
import { supabase } from '../../../utils/supabase'
import { cleanScriptTags, encodeHTMLEntities } from '../../../utils/security'
import {
  containerStyle, overlayStyle, glassPanelStyle, headerStyle, logoStyle, taglineStyle,
  errorContainerStyle, formStyle, inputGroupStyle, labelStyle, inputStyle, selectStyle,
  textareaStyle, rowStyle, profileSectionStyle, sectionHeaderStyle, checkboxWrapperStyle,
  checkboxStyle, checkboxLabelStyle, preferenceGridStyle, submitButtonStyle
} from '../page'

export default function OnboardingPage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)

  const [role, setRole] = useState<'tenant' | 'landlord' | ''>('')
  const [bio, setBio] = useState('')
  const [gender, setGender] = useState<'men' | 'women' | 'any'>('any')
  const [childrenCount, setChildrenCount] = useState(0)
  const [employmentStatus, setEmploymentStatus] = useState('Employed')
  const [hasPets, setHasPets] = useState(false)
  const [genderPreference, setGenderPreference] = useState<'men' | 'women' | 'couple' | 'any'>('any')
  const [childrenAllowed, setChildrenAllowed] = useState(true)
  const [maxChildren, setMaxChildren] = useState(2)
  const [smokingAllowed, setSmokingAllowed] = useState(false)
  const [petsAllowed, setPetsAllowed] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const sanitizeInput = (text: string): string => encodeHTMLEntities(cleanScriptTags(text))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!role || !currentUser || !supabase) return
    setSubmitting(true)
    setErrorMessage(null)

    const sanitizedBio = sanitizeInput(bio)

    const { error } = await supabase.from('res_profiles').update({
      role,
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
    }).eq('id', currentUser.id)

    setSubmitting(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    dispatch(loginUser({ ...currentUser, role }))
    router.push('/dashboard')
  }

  useEffect(() => {
    if (!currentUser) router.push('/auth')
  }, [currentUser, router])

  if (!currentUser) return null

  return (
    <div style={containerStyle}>
      <div style={overlayStyle} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="responsive-glass-panel"
        style={glassPanelStyle}
      >
        <div style={headerStyle}>
          <h2 style={logoStyle}>ONE MORE STEP</h2>
          <p style={taglineStyle}>Complete your Resident profile</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--foreground)', opacity: 0.6, marginTop: '0.5rem' }}>
            You signed in with an existing account — tell us a bit about yourself so
            The Resident works properly for you. This only takes a moment.
          </p>
        </div>

        {errorMessage && (
          <div style={errorContainerStyle}>
            <AlertTriangle size={16} color="#ef4444" style={{ marginRight: 8 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={formStyle}>
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
          ) : role === 'landlord' ? (
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
          ) : null}

          <button type="submit" className="btn-gold" style={submitButtonStyle} disabled={submitting || !role}>
            {submitting ? 'Saving…' : 'Finish Setting Up'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
