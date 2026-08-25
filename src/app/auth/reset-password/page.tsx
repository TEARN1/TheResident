'use client'

/**
 * Where a password-recovery link lands, after /auth/callback has exchanged
 * the emailed code for a session. At that point Supabase considers the
 * visitor authenticated *for the purpose of changing their password*, which
 * is why this page can call updateUser without asking for the old one — the
 * proof of identity was clicking a link sent to their own inbox.
 *
 * Guarded on an actual session existing: without that check the form would
 * render for anyone who typed the URL directly, let them fill it in, and
 * only fail on submit.
 */

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch } from 'react-redux'
import { motion } from 'framer-motion'
import { Lock, AlertTriangle, CheckCircle } from 'lucide-react'
import { AppDispatch, addLog } from '../../../store'
import { supabase } from '../../../utils/supabase'
import { checkPasswordStrength } from '../../../utils/security'
import {
  containerStyle, overlayStyle, glassPanelStyle, headerStyle, logoStyle, taglineStyle,
  errorContainerStyle, formStyle, inputGroupStyle, labelStyle, inputStyle, submitButtonStyle
} from '../page'

export default function ResetPasswordPage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()

  // Derived from the module-level client rather than set inside the effect:
  // with no Supabase configured there is nothing to check, so this starts
  // false instead of flipping synchronously on mount.
  const [checking, setChecking] = useState(!!supabase)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [strength, setStrength] = useState<{ strong: boolean; score: number; feedback: string[] } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user)
      setChecking(false)
    })
  }, [])

  const onPasswordChange = (val: string) => {
    setPassword(val)
    setStrength(val.length > 0 ? checkPasswordStrength(val) : null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) { setError('Database offline / not configured.'); return }
    if (password !== confirm) { setError('The two passwords don’t match.'); return }
    // Same strength bar as signup — a recovery flow is exactly where a weak
    // password would otherwise slip in unchecked.
    if (strength && !strength.strong) {
      setError('Please choose a stronger password. ' + (strength.feedback[0] || ''))
      return
    }

    setSubmitting(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSubmitting(false)

    if (updateError) {
      setError(updateError.message)
      dispatch(addLog({
        action: 'Password reset failed',
        type: 'auth_failed',
        details: `updateUser rejected the new password: ${updateError.message}`
      }))
      return
    }

    dispatch(addLog({
      action: 'Password changed via recovery link',
      type: 'auth_password_changed',
      details: 'User completed the emailed password-reset flow.'
    }))
    setDone(true)
    setTimeout(() => router.push('/dashboard'), 1800)
  }

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
          <h2 style={logoStyle}>NEW PASSWORD</h2>
          <p style={taglineStyle}>Set a new password for your account</p>
        </div>

        {error && (
          <div style={errorContainerStyle}>
            <AlertTriangle size={16} color="#ef4444" style={{ marginRight: 8 }} />
            <span>{error}</span>
          </div>
        )}

        {checking ? (
          <p style={{ textAlign: 'center', color: 'var(--foreground)', opacity: 0.7, fontSize: '0.85rem' }}>
            Checking your reset link…
          </p>
        ) : done ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <CheckCircle size={32} color="#4CAF50" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: '0.9rem', color: 'var(--foreground)' }}>
              Password updated. Taking you to your dashboard…
            </p>
          </div>
        ) : !hasSession ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <AlertTriangle size={28} color="#ef4444" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: '0.85rem', color: 'var(--foreground)', marginBottom: 16 }}>
              This reset link is invalid or has expired. Request a fresh one from the sign-in page.
            </p>
            <button onClick={() => router.push('/auth')} className="btn-primary" style={submitButtonStyle}>
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={formStyle}>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>New Password</label>
              <input
                type="password"
                required
                placeholder="choose a strong password..."
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                style={inputStyle}
              />
              {strength && (
                <div style={{ marginTop: '4px' }}>
                  <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
                    {[...Array(6)].map((_, i) => (
                      <div key={i} style={{
                        flex: 1, height: '4px', borderRadius: '2px',
                        background: i < strength.score
                          ? strength.score >= 4 ? '#4CAF50' : strength.score >= 2 ? '#FFC107' : '#F44336'
                          : 'rgba(255,255,255,0.15)'
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '11px', color: strength.strong ? '#4CAF50' : '#FFC107' }}>
                    {strength.strong ? '✅ Strong password' : `⚠️ ${strength.feedback[0] || 'Weak password'}`}
                  </span>
                </div>
              )}
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Confirm New Password</label>
              <input
                type="password"
                required
                placeholder="type it again..."
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                style={inputStyle}
              />
            </div>

            <button type="submit" className="btn-primary" style={submitButtonStyle} disabled={submitting}>
              {submitting ? 'Updating…' : <>Set new password <Lock size={14} style={{ marginLeft: 8 }} /></>}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  )
}
