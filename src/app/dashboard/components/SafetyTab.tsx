'use client'

import React, { useState, useEffect } from 'react'
import { AlertTriangle, Shield, ShieldCheck, Zap, Droplet, Wifi, Check } from 'lucide-react'
import { outageConsensus, type StatusReport } from '../../../utils/logic'
import type { Alert, NeighbourhoodStatus } from '../../../store'

/** Each report belongs to one utility — power, water and network are counted separately. */
export type KindedStatusReport = StatusReport & { kind: 'power' | 'water' | 'network' }

interface SafetyTabProps {
  alerts: Alert[]
  neighbourhoodStatus: NeighbourhoodStatus[]
  statusReports: KindedStatusReport[]
  currentUserId: string
  isVerified: boolean
  suburb: string
  onRaiseAlert: (args: { kind: 'panic' | 'incident' | 'suspicious'; title: string; description: string; severity: 'low' | 'medium' | 'high' | 'critical' }) => void
  onRespond: (alertId: string, status: 'coming' | 'arrived' | 'stood_down') => void
  onResolve: (alertId: string) => void
  onReportStatus: (kind: 'power' | 'water' | 'network', status: 'up' | 'down') => void
  styles: Record<string, React.CSSProperties>
}

const UTILITIES: Array<{ kind: 'power' | 'water' | 'network'; label: string; Icon: typeof Zap }> = [
  { kind: 'power', label: 'Power', Icon: Zap },
  { kind: 'water', label: 'Water', Icon: Droplet },
  { kind: 'network', label: 'Network', Icon: Wifi }
]

export default function SafetyTab({
  alerts,
  statusReports,
  currentUserId,
  isVerified,
  suburb,
  onRaiseAlert,
  onRespond,
  onResolve,
  onReportStatus,
  styles
}: SafetyTabProps) {
  const [showIncident, setShowIncident] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [confirmPanic, setConfirmPanic] = useState(false)

  // The consensus window is time-based, so "now" is state that ticks rather
  // than a Date.now() call during render (which would be impure and would also
  // never re-evaluate as reports age out of the window).
  const [now, setNow] = useState(0)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const activeAlerts = alerts.filter(a => a.status === 'active')

  return (
    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Panic — deliberately two-step, so a mis-tap can't page the neighbourhood */}
      <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.35)' }}>
        <h3 style={{ ...styles.panelTitleStyle, borderBottom: 'none', marginTop: 0 }}>Emergency</h3>
        <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0 0 1rem 0' }}>
          Alerts every verified neighbour nearby. Use it only for a real emergency.
        </p>

        {!confirmPanic ? (
          <button
            onClick={() => setConfirmPanic(true)}
            aria-label="Raise a panic alert"
            style={{
              width: '100%', padding: '1rem', borderRadius: '10px', cursor: 'pointer',
              background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444',
              color: '#ef4444', fontWeight: 'bold', fontSize: '1rem'
            }}
          >
            <AlertTriangle size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
            PANIC ALERT
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button
              onClick={() => {
                onRaiseAlert({ kind: 'panic', title: 'Panic alert', description: 'Immediate help needed.', severity: 'critical' })
                setConfirmPanic(false)
              }}
              style={{
                flex: 1, padding: '1rem', borderRadius: '10px', cursor: 'pointer',
                background: '#ef4444', border: 'none', color: '#fff', fontWeight: 'bold'
              }}
            >
              Yes — send it now
            </button>
            <button
              onClick={() => setConfirmPanic(false)}
              style={{
                flex: 1, padding: '1rem', borderRadius: '10px', cursor: 'pointer',
                background: 'transparent', border: '1px solid #666', color: '#aaa'
              }}
            >
              Cancel
            </button>
          </div>
        )}

        <button
          onClick={() => setShowIncident(v => !v)}
          style={{
            marginTop: '0.8rem', width: '100%', padding: '0.6rem', borderRadius: '8px',
            cursor: 'pointer', background: 'transparent', border: '1px solid #444', color: '#ccc',
            fontSize: '0.8rem'
          }}
        >
          Report a non-emergency incident
        </button>

        {showIncident && (
          <form
            onSubmit={e => {
              e.preventDefault()
              if (!title.trim()) return
              onRaiseAlert({ kind: 'incident', title, description, severity: 'medium' })
              setTitle('')
              setDescription('')
              setShowIncident(false)
            }}
            style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
          >
            <label htmlFor="incident-title" style={{ fontSize: '0.75rem', color: '#888' }}>What happened?</label>
            <input
              id="incident-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Break-in attempt on Zone 5"
              style={styles.inputStyle}
              required
            />
            <textarea
              id="incident-detail"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Any detail that would help a neighbour."
              rows={2}
              style={styles.inputStyle}
            />
            <button type="submit" className="btn-gold" style={{ padding: '0.6rem', cursor: 'pointer' }}>
              Report it
            </button>
          </form>
        )}
      </div>

      {/* Live alerts */}
      <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '12px' }}>
        <h3 style={{ ...styles.panelTitleStyle, borderBottom: 'none', marginTop: 0 }}>
          Active alerts {activeAlerts.length > 0 && `(${activeAlerts.length})`}
        </h3>

        {!isVerified && (
          <p style={{
            fontSize: '0.75rem', color: '#D4AF37', background: 'rgba(212,175,55,0.1)',
            padding: '0.6rem', borderRadius: '6px', margin: '0 0 1rem 0'
          }}>
            <ShieldCheck size={14} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
            Only verified neighbours can respond to alerts. Get verified on The Gruvs to help out.
          </p>
        )}

        {activeAlerts.length === 0 ? (
          <div style={styles.emptyStateStyle}>
            <Shield size={28} color="#22c55e" />
            <p>All quiet. No active alerts in your area.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {activeAlerts.map(alert => (
              <div
                key={alert.id}
                style={{
                  padding: '0.9rem', borderRadius: '8px',
                  background: alert.severity === 'panic' ? 'rgba(239,68,68,0.12)' : 'rgba(0,0,0,0.2)',
                  border: `1px solid ${alert.severity === 'panic' ? '#ef4444' : 'rgba(255,255,255,0.08)'}`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={16} color={alert.severity === 'panic' ? '#ef4444' : '#D4AF37'} />
                  <strong style={{ color: 'var(--text-primary, #fff)' }}>{alert.title}</strong>
                  <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#888' }}>
                    {alert.severity.toUpperCase()}
                  </span>
                </div>
                {alert.description && (
                  <p style={{ fontSize: '0.8rem', color: '#bbb', margin: '0.5rem 0' }}>{alert.description}</p>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                  {alert.createdBy === currentUserId ? (
                    <button
                      onClick={() => onResolve(alert.id)}
                      className="btn-gold"
                      style={{ padding: '0.3rem 0.7rem', fontSize: '0.7rem', cursor: 'pointer' }}
                    >
                      <Check size={12} style={{ verticalAlign: 'middle' }} /> Mark resolved
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => onRespond(alert.id, 'coming')}
                        disabled={!isVerified}
                        style={{
                          padding: '0.3rem 0.7rem', fontSize: '0.7rem',
                          cursor: isVerified ? 'pointer' : 'not-allowed',
                          opacity: isVerified ? 1 : 0.5,
                          background: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e',
                          color: '#22c55e', borderRadius: '4px'
                        }}
                      >
                        I&apos;m coming
                      </button>
                      <button
                        onClick={() => onRespond(alert.id, 'arrived')}
                        disabled={!isVerified}
                        style={{
                          padding: '0.3rem 0.7rem', fontSize: '0.7rem',
                          cursor: isVerified ? 'pointer' : 'not-allowed',
                          opacity: isVerified ? 1 : 0.5,
                          background: 'transparent', border: '1px solid #666',
                          color: '#ccc', borderRadius: '4px'
                        }}
                      >
                        I&apos;ve arrived
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Crowd-signal utilities: one report is noise, three is a fact */}
      <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '12px' }}>
        <h3 style={{ ...styles.panelTitleStyle, borderBottom: 'none', marginTop: 0 }}>
          What&apos;s working in {suburb || 'your area'}?
        </h3>
        <p style={{ fontSize: '0.75rem', color: '#888', margin: '0 0 1rem 0' }}>
          Three neighbours reporting the same thing within 30 minutes confirms an outage.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {UTILITIES.map(({ kind, label, Icon }) => {
            // Each utility is counted on its own — a water outage says nothing
            // about the power.
            const consensus = now === 0
              ? { confirmed: false, reporters: 0 }
              : outageConsensus(statusReports.filter(r => r.kind === kind), now)
            const confirmed = consensus.confirmed

            return (
              <div
                key={kind}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.7rem',
                  borderRadius: '8px', background: 'rgba(0,0,0,0.2)',
                  border: `1px solid ${confirmed ? '#ef4444' : 'rgba(255,255,255,0.06)'}`
                }}
              >
                <Icon size={18} color={confirmed ? '#ef4444' : '#22c55e'} />
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary, #fff)' }}>{label}</strong>
                  <div style={{ fontSize: '0.7rem', color: '#888' }}>
                    {confirmed
                      ? `Outage confirmed — ${consensus.reporters} neighbours reporting`
                      : consensus.reporters > 0
                        ? `${consensus.reporters} report${consensus.reporters === 1 ? '' : 's'} — not confirmed yet`
                        : 'Working'}
                  </div>
                </div>
                <button
                  onClick={() => onReportStatus(kind, 'down')}
                  style={{
                    padding: '0.3rem 0.6rem', fontSize: '0.7rem', cursor: 'pointer',
                    background: 'transparent', border: '1px solid #ef4444', color: '#ef4444',
                    borderRadius: '4px'
                  }}
                >
                  It&apos;s down
                </button>
                <button
                  onClick={() => onReportStatus(kind, 'up')}
                  style={{
                    padding: '0.3rem 0.6rem', fontSize: '0.7rem', cursor: 'pointer',
                    background: 'transparent', border: '1px solid #22c55e', color: '#22c55e',
                    borderRadius: '4px'
                  }}
                >
                  It&apos;s back
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
