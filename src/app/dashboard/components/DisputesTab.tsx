import React from 'react'
import { Plus } from 'lucide-react'
import { t } from '../../../utils/i18n'

interface Dispute {
  id: string
  title: string
  description: string
  category: string
  reportedBy: string
  reportedById: string
  againstUser: string
  againstUserId?: string
  mediatorId?: string
  mediatorName?: string
  status: 'pending' | 'mediating' | 'resolved'
  timestamp: string
  resolutionDetails?: string
}

interface DisputesTabProps {
  communityDisputes: Dispute[]
  currentUser: { name: string; balance: number; id: string; role: string } | null
  setShowDisputeModal: (val: boolean) => void
  resolvingDisputeId: string | null
  setResolvingDisputeId: (val: string | null) => void
  resolutionText: string
  setResolutionText: (val: string) => void
  handleResolveDispute: (e: React.FormEvent) => void
  lang: 'en' | 'zu' | 'xh' | 'af'
  styles: Record<string, React.CSSProperties>
}

export default function DisputesTab({
  communityDisputes,
  currentUser,
  setShowDisputeModal,
  resolvingDisputeId,
  setResolvingDisputeId,
  resolutionText,
  setResolutionText,
  handleResolveDispute,
  lang,
  styles
}: DisputesTabProps) {
  return (
    <div>
      <div style={styles.landlordHeaderRowStyle}>
        <h3 style={{ ...styles.panelTitleStyle, borderBottom: 'none', margin: 0 }}>{t('mediationLedger', lang)}</h3>
        {currentUser?.role !== 'landlord' && (
          <button className="btn-gold" style={{ cursor: 'pointer' }} onClick={() => setShowDisputeModal(true)}>
            <Plus size={14} style={{ marginRight: 6 }} /> {t('reportDisputeBtn', lang)}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.2rem' }}>
        {communityDisputes.length > 0 ? (
          communityDisputes.map(dispute => (
            <div key={dispute.id} className="glass-panel" style={{ padding: '1.2rem', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ 
                    fontSize: '0.6rem', 
                    fontWeight: 'bold', 
                    borderRadius: '4px', 
                    padding: '0.1rem 0.3rem',
                    background: dispute.status === 'resolved' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: `1px solid ${dispute.status === 'resolved' ? '#22c55e' : '#ef4444'}`,
                    color: dispute.status === 'resolved' ? '#22c55e' : '#ef4444'
                  }}>
                    {dispute.status.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#D4AF37' }}>
                    Category: <strong>{dispute.category}</strong>
                  </span>
                </div>
                <span style={{ fontSize: '0.7rem', color: '#888' }}>
                  Filed: {dispute.timestamp}
                </span>
              </div>

              <h4 style={{ margin: '0 0 0.4rem 0', color: '#fff', fontSize: '0.95rem' }}>{dispute.title}</h4>
              <p style={{ margin: '0 0 0.8rem 0', fontSize: '0.8rem', color: '#ccc', lineHeight: '1.4' }}>
                <strong>Details:</strong> {dispute.description}
              </p>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.6rem', borderRadius: '6px', fontSize: '0.75rem' }}>
                <p style={{ margin: '0 0 0.3rem 0', color: '#888' }}>
                  <strong>Complainant:</strong> {dispute.reportedBy} | <strong>Against:</strong> {dispute.againstUser}
                </p>
                <p style={{ margin: 0, color: '#888' }}>
                  <strong>Assigned Mediator:</strong> {dispute.mediatorName} (Landlord)
                </p>
              </div>

              {dispute.status === 'resolved' && dispute.resolutionDetails && (
                <div style={{ marginTop: '0.8rem', background: 'rgba(34, 197, 94, 0.05)', border: '1px dashed #22c55e', padding: '0.8rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                  <strong style={{ color: '#22c55e' }}>{t('resolutionAction', lang)}</strong>
                  <p style={{ margin: '0.2rem 0 0 0', color: '#ccc' }}>&quot;{dispute.resolutionDetails}&quot;</p>
                </div>
              )}

              {dispute.status === 'pending' && currentUser?.role === 'landlord' && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.8rem' }}>
                  {resolvingDisputeId === dispute.id ? (
                    <form onSubmit={handleResolveDispute}>
                      <textarea 
                        rows={2}
                        required
                        placeholder="Describe mediation actions or resolution details..."
                        value={resolutionText}
                        onChange={(e) => setResolutionText(e.target.value)}
                        style={styles.modalTextareaStyle}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button type="submit" className="btn-gold" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer' }}>{t('submitResolution', lang)}</button>
                        <button type="button" className="btn-primary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer' }} onClick={() => setResolvingDisputeId(null)}>{t('cancel', lang)}</button>
                      </div>
                    </form>
                  ) : (
                    <button 
                      className="btn-gold" 
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer' }}
                      onClick={() => setResolvingDisputeId(dispute.id)}
                    >
                      {t('resolveBtn', lang)}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <div style={styles.emptyStateStyle}>{t('noDisputes', lang)}</div>
        )}
      </div>
    </div>
  )
}
