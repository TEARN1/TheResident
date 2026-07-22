'use client'

import React, { useState } from 'react'
import { MapPin, Plus, LogIn, Key, Lock } from 'lucide-react'
import type { Community } from '../../../store'

interface CommunitiesTabProps {
  communities: Community[]
  memberOf: string[]
  currentUserId: string
  onCreate: (args: { name: string; kind: 'street' | 'block' | 'complex' | 'estate' | 'suburb'; suburb: string }) => void
  onJoin: (communityId: string) => void
  onLeave: (communityId: string) => void
  onRedeem: (code: string) => void
  styles: Record<string, React.CSSProperties>
}

const KINDS = ['street', 'block', 'complex', 'estate', 'suburb'] as const

export default function CommunitiesTab({
  communities,
  memberOf,
  onCreate,
  onJoin,
  onLeave,
  onRedeem,
  styles
}: CommunitiesTabProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<(typeof KINDS)[number]>('street')
  const [suburb, setSuburb] = useState('')
  const [code, setCode] = useState('')

  return (
    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.8rem' }}>
          <h3 style={{ ...styles.panelTitleStyle, borderBottom: 'none', margin: 0 }}>Your street, your block</h3>
          <button
            onClick={() => setShowCreate(v => !v)}
            className="btn-gold"
            style={{ marginLeft: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.75rem', cursor: 'pointer' }}
          >
            <Plus size={12} style={{ verticalAlign: 'middle' }} /> Start one
          </button>
        </div>

        <p style={{ fontSize: '0.75rem', color: '#888', margin: '0 0 1rem 0' }}>
          A community scopes everything else — notices, alerts, the market — to the people who actually live near you.
        </p>

        {showCreate && (
          <form
            onSubmit={e => {
              e.preventDefault()
              if (!name.trim()) return
              onCreate({ name, kind, suburb })
              setName(''); setSuburb(''); setShowCreate(false)
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.2rem' }}
          >
            <label htmlFor="com-name" style={{ fontSize: '0.75rem', color: '#888' }}>Name</label>
            <input id="com-name" value={name} onChange={e => setName(e.target.value)}
                   placeholder="Zone 5, Ivory Park" style={styles.inputStyle} required />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select id="com-kind" value={kind} onChange={e => setKind(e.target.value as typeof kind)}
                      style={{ ...styles.inputStyle, flex: 1 }} aria-label="Community kind">
                {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <input id="com-suburb" value={suburb} onChange={e => setSuburb(e.target.value)}
                     placeholder="Suburb" style={{ ...styles.inputStyle, flex: 1 }} />
            </div>
            <button type="submit" className="btn-gold" style={{ padding: '0.6rem', cursor: 'pointer' }}>
              Create — you&apos;ll be its founder
            </button>
          </form>
        )}

        {communities.length === 0 ? (
          <div style={styles.emptyStateStyle}>
            <MapPin size={28} color="#D4AF37" />
            <p>No communities near you yet. Start the first one.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            {communities.map(c => {
              const joined = memberOf.includes(c.id)
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.8rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <MapPin size={18} color="#D4AF37" />
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary, #fff)' }}>{c.name}</strong>
                    <div style={{ fontSize: '0.7rem', color: '#888' }}>{c.suburb}</div>
                  </div>
                  {joined ? (
                    <button
                      onClick={() => onLeave(c.id)}
                      style={{ padding: '0.3rem 0.7rem', fontSize: '0.7rem', cursor: 'pointer', background: 'transparent', border: '1px solid #666', color: '#aaa', borderRadius: '4px' }}
                    >
                      Leave
                    </button>
                  ) : (
                    <button
                      onClick={() => onJoin(c.id)}
                      className="btn-gold"
                      style={{ padding: '0.3rem 0.7rem', fontSize: '0.7rem', cursor: 'pointer' }}
                    >
                      <LogIn size={12} style={{ verticalAlign: 'middle' }} /> Join
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Private communities are invite-only */}
      <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '12px' }}>
        <h3 style={{ ...styles.panelTitleStyle, borderBottom: 'none', marginTop: 0 }}>
          <Lock size={14} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
          Have an invite code?
        </h3>
        <form
          onSubmit={e => {
            e.preventDefault()
            if (!code.trim()) return
            onRedeem(code)
            setCode('')
          }}
          style={{ display: 'flex', gap: '0.5rem' }}
        >
          <label htmlFor="invite-code" style={{ display: 'none' }}>Invite code</label>
          <input
            id="invite-code"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="A1B2C3D4"
            style={{ ...styles.inputStyle, flex: 1, letterSpacing: '0.1em' }}
          />
          <button type="submit" className="btn-gold" style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
            <Key size={12} style={{ verticalAlign: 'middle' }} /> Redeem
          </button>
        </form>
      </div>

      {/* Connection Density Booster Card */}
      <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '12px', background: 'rgba(212,175,55,0.04)', border: '1px border rgba(212,175,55,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ margin: 0, color: '#fff', fontSize: '0.9rem' }}>Suburb Connection Density Boost</h4>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#aaa' }}>
              Linking with neighbors scales your community multiplier and unlocks local trade perks.
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.65rem', color: '#888', textTransform: 'uppercase', display: 'block' }}>XP Multiplier</span>
            <strong style={{ fontSize: '1.1rem', color: '#D4AF37' }}>
              {(memberOf.length > 0 ? (memberOf.length * 35 >= 100 ? 1.5 : memberOf.length * 35 >= 50 ? 1.2 : 1.0) : 1.0).toFixed(1)}x
            </strong>
          </div>
        </div>
      </div>
    </div>
  )
}
