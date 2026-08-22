'use client'

// A public page, deliberately outside /dashboard so middleware.ts's auth gate
// never touches it — Play and App Store account-deletion policy requires this
// be reachable without installing the app or being logged in, not just buried
// in a settings screen behind a login wall.
//
// It still requires a real session to actually delete anything: the backend
// (supabase/functions/delete-account, already deployed) takes the account id
// from the caller's own verified JWT, on purpose, so nobody can delete an
// account they don't own by guessing a URL. A visitor with no session gets
// the same explanation and a way to sign in first, not a dead end.

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader, ShieldCheck, Trash2 } from 'lucide-react'
import { supabase } from '../../utils/supabase'
import { requestAccountDeletion } from '../../utils/accountDeletion'

type Stage = 'checking' | 'signed_out' | 'confirming' | 'deleting' | 'done' | 'error'

const CONFIRM_PHRASE = 'DELETE'

export default function DeleteAccountPage() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('checking')
  const [email, setEmail] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!supabase) {
        if (!cancelled) { setError('Database offline / not configured.'); setStage('error') }
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (!session) {
        setStage('signed_out')
      } else {
        setEmail(session.user.email ?? null)
        setStage('confirming')
      }
    })()
    return () => { cancelled = true }
  }, [])

  const handleDelete = async () => {
    setStage('deleting')
    setError(null)
    const result = await requestAccountDeletion()
    if (!result.ok) {
      setError(result.error)
      setStage('confirming')
      return
    }
    setStage('done')
    setTimeout(() => router.push('/'), 4000)
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Delete your account</h1>

        {stage === 'checking' && (
          <p style={bodyStyle}>Checking your sign-in status…</p>
        )}

        {stage === 'signed_out' && (
          <>
            <p style={bodyStyle}>
              Deleting an account has to be done by the account&apos;s owner, so you&apos;ll
              need to sign in first before this page can act on it.
            </p>
            <Link href="/auth" style={primaryBtnStyle}>Sign in to continue</Link>
            <p style={noteStyle}>
              If you can no longer sign in — a lost password, a changed number — you cannot
              be identity-verified through this page. That is a deliberate limit: a self-serve
              deletion flow that worked without proving ownership would let anyone delete
              anyone&apos;s account.
            </p>
          </>
        )}

        {(stage === 'confirming' || stage === 'deleting') && (
          <>
            <div style={warningBoxStyle}>
              <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: '#fca5a5' }}>This cannot be undone.</p>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#d1d5db', lineHeight: 1.5 }}>
                  Deleting {email ? <strong>{email}</strong> : 'your account'} permanently removes
                  your profile, your listings, messages, reports, and any photos you&apos;ve
                  uploaded — on both The Resident and The Gruvs, since they share one account.
                  There is no recovery window and no way to restore it afterward.
                </p>
              </div>
            </div>

            <label style={labelStyle}>
              Type <strong>{CONFIRM_PHRASE}</strong> to confirm
            </label>
            <input
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              disabled={stage === 'deleting'}
              autoComplete="off"
              autoCapitalize="off"
              style={inputStyle}
            />

            {error && <p style={errorTextStyle}>{error}</p>}

            <button
              type="button"
              onClick={handleDelete}
              disabled={typed !== CONFIRM_PHRASE || stage === 'deleting'}
              style={{
                ...dangerBtnStyle,
                opacity: typed !== CONFIRM_PHRASE || stage === 'deleting' ? 0.5 : 1,
                cursor: typed !== CONFIRM_PHRASE || stage === 'deleting' ? 'not-allowed' : 'pointer',
              }}
              aria-busy={stage === 'deleting'}
            >
              {stage === 'deleting'
                ? <><Loader size={15} className="animate-spin" /> Deleting…</>
                : <><Trash2 size={15} /> Permanently delete my account</>}
            </button>

            <Link href="/dashboard" style={cancelLinkStyle}>Cancel and go back</Link>
          </>
        )}

        {stage === 'done' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#4ade80' }}>
              <ShieldCheck size={20} />
              <p style={{ margin: 0, fontWeight: 700 }}>Your account has been deleted.</p>
            </div>
            <p style={bodyStyle}>Redirecting you to the homepage…</p>
          </>
        )}

        {stage === 'error' && (
          <p style={errorTextStyle}>{error}</p>
        )}
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#0a0a0a',
  padding: '24px',
}

const cardStyle: React.CSSProperties = {
  maxWidth: '460px',
  width: '100%',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '16px',
  padding: '32px',
}

const titleStyle: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 800,
  color: '#fff',
  margin: '0 0 16px',
}

const bodyStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#9ca3af',
  lineHeight: 1.6,
  margin: '0 0 20px',
}

const noteStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
  lineHeight: 1.5,
  marginTop: '20px',
}

const warningBoxStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  background: 'rgba(239, 68, 68, 0.08)',
  border: '1px solid rgba(239, 68, 68, 0.25)',
  borderRadius: '10px',
  padding: '14px',
  marginBottom: '20px',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  color: '#d1d5db',
  marginBottom: '8px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '14px',
  marginBottom: '16px',
  boxSizing: 'border-box',
}

const dangerBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  width: '100%',
  padding: '14px',
  background: '#ef4444',
  color: '#fff',
  border: 'none',
  borderRadius: '10px',
  fontSize: '13px',
  fontWeight: 800,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '12px 24px',
  background: '#D4AF37',
  color: '#000',
  borderRadius: '10px',
  fontSize: '13px',
  fontWeight: 800,
  textDecoration: 'none',
}

const cancelLinkStyle: React.CSSProperties = {
  display: 'block',
  textAlign: 'center',
  marginTop: '14px',
  fontSize: '13px',
  color: '#9ca3af',
}

const errorTextStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#fca5a5',
  margin: '0 0 16px',
}
