import React from 'react'
import { useDispatch } from 'react-redux'
import { Plus, Hammer, Scale, ShieldCheck } from 'lucide-react'
import { t } from '../../../utils/i18n'
import { updateDisputeStatus } from '../../../store'
import { calculateTribunalMajority } from '../../../utils/logic'

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
  evidenceHash?: string
  votesForClaimant?: number
  votesForRespondent?: number
  juryStatus?: 'not_started' | 'voting' | 'completed'
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
  const dispatch = useDispatch()

  const handleInitJuryVoting = (disputeId: string) => {
    dispatch(updateDisputeStatus({
      disputeId,
      status: 'mediating',
      juryStatus: 'voting',
      votesForClaimant: 0,
      votesForRespondent: 0
    }))
  };

  const handleCastJuryVote = (disputeId: string, target: 'claimant' | 'respondent') => {
    const dispute = communityDisputes.find(d => d.id === disputeId)
    if (!dispute) return

    const currentClaimant = dispute.votesForClaimant || 0
    const currentRespondent = dispute.votesForRespondent || 0
    const nextClaimant = target === 'claimant' ? currentClaimant + 1 : currentClaimant
    const nextRespondent = target === 'respondent' ? currentRespondent + 1 : currentRespondent

    if (nextClaimant + nextRespondent >= 5) {
      const result = calculateTribunalMajority(nextClaimant, nextRespondent)
      let decision = 'hung'
      let rate = 0.5
      if (result === 'majority_for') {
        decision = 'claimant'
        rate = nextClaimant / 5
      } else if (result === 'majority_against') {
        decision = 'respondent'
        rate = nextRespondent / 5
      }
      dispatch(updateDisputeStatus({
        disputeId,
        status: 'resolved',
        juryStatus: 'completed',
        votesForClaimant: nextClaimant,
        votesForRespondent: nextRespondent,
        resolutionDetails: `P2P Jury Tribunal Verdict: Resolved in favor of the ${decision.toUpperCase()} with ${Math.round(rate * 100)}% juror consensus (Tally: ${nextClaimant}-${nextRespondent}).`
      }))
    } else {
      dispatch(updateDisputeStatus({
        disputeId,
        status: 'mediating',
        votesForClaimant: nextClaimant,
        votesForRespondent: nextRespondent,
        juryStatus: 'voting'
      }))
    }
  };

  const handleAutoResolveJury = (disputeId: string) => {
    const dispute = communityDisputes.find(d => d.id === disputeId)
    if (!dispute) return

    // Simulate 5 random juror votes (e.g. 3-2 or 4-1 or 5-0)
    let claimantVotes = 0
    let respondentVotes = 0
    for (let i = 0; i < 5; i++) {
      if (Math.random() > 0.5) claimantVotes++
      else respondentVotes++
    }

    // Ensure no ties (always 5 total votes)
    if (claimantVotes + respondentVotes !== 5) {
      claimantVotes = 3
      respondentVotes = 2
    }

    const result = calculateTribunalMajority(claimantVotes, respondentVotes)
    let decision = 'hung'
    let rate = 0.5
    if (result === 'majority_for') {
      decision = 'claimant'
      rate = claimantVotes / 5
    } else if (result === 'majority_against') {
      decision = 'respondent'
      rate = respondentVotes / 5
    }
    dispatch(updateDisputeStatus({
      disputeId,
      status: 'resolved',
      juryStatus: 'completed',
      votesForClaimant: claimantVotes,
      votesForRespondent: respondentVotes,
      resolutionDetails: `P2P Jury Consensus Simulation: Resolved in favor of the ${decision.toUpperCase()} (Tally: ${claimantVotes}-${respondentVotes}, Consensus: ${Math.round(rate * 100)}%).`
    }))
  };

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
            <div key={dispute.id} className="glass-panel" style={{ padding: '1.2rem', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ 
                      fontSize: '0.65rem', 
                      fontWeight: 'bold', 
                      borderRadius: '4px', 
                      padding: '0.1rem 0.4rem',
                      background: dispute.status === 'resolved' ? 'rgba(34, 197, 94, 0.15)' : dispute.status === 'mediating' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      border: `1px solid ${dispute.status === 'resolved' ? '#22c55e' : dispute.status === 'mediating' ? '#3b82f6' : '#ef4444'}`,
                      color: dispute.status === 'resolved' ? '#22c55e' : dispute.status === 'mediating' ? '#3b82f6' : '#ef4444'
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

                {dispute.evidenceHash && (
                  <div style={{ marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#D4AF37', background: 'rgba(212, 175, 55, 0.06)', border: '1px dashed rgba(212, 175, 55, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Scale size={12} /> Hashed Evidence SHA-256: {dispute.evidenceHash}
                    </span>
                  </div>
                )}

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.6rem', borderRadius: '6px', fontSize: '0.75rem' }}>
                  <p style={{ margin: '0 0 0.3rem 0', color: '#888' }}>
                    <strong>Complainant:</strong> {dispute.reportedBy} | <strong>Against:</strong> {dispute.againstUser}
                  </p>
                  <p style={{ margin: 0, color: '#888' }}>
                    <strong>Assigned Mediator:</strong> {dispute.mediatorName} (Landlord)
                  </p>
                </div>
              </div>

              {dispute.status === 'resolved' && dispute.resolutionDetails && (
                <div style={{ background: 'rgba(34, 197, 94, 0.05)', border: '1px dashed #22c55e', padding: '0.8rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                  <strong style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: '6px' }}><ShieldCheck size={14} /> {t('resolutionAction', lang)}</strong>
                  <p style={{ margin: '0.2rem 0 0 0', color: '#ccc' }}>&quot;{dispute.resolutionDetails}&quot;</p>
                </div>
              )}

              {/* Jury Consensus Board (Visible for non-resolved disputes) */}
              {dispute.status !== 'resolved' && (
                <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255,255,255,0.04)', padding: '0.8rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Hammer size={13} style={{ color: '#D4AF37' }} /> P2P Mediation Jury Panel
                    </span>
                    <span style={{ fontSize: '0.6rem', color: '#aaa', padding: '0.1rem 0.3rem', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }}>
                      {dispute.juryStatus === 'voting' ? 'VOTING SESSION' : 'NOT INITIALIZED'}
                    </span>
                  </div>

                  {(!dispute.juryStatus || dispute.juryStatus === 'not_started') && (
                    <div>
                      <button 
                        onClick={() => handleInitJuryVoting(dispute.id)}
                        className="btn-gold" 
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer' }}
                      >
                        ⚖️ Summon 5 Neighbor Jurors
                      </button>
                    </div>
                  )}

                  {dispute.juryStatus === 'voting' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <div style={{ display: 'flex', gap: '0.6rem' }}>
                        <div style={{ flex: 1, background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', padding: '0.4rem', borderRadius: '4px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.6', color: '#aaa', display: 'block' }}>Votes for Claimant</span>
                          <strong style={{ fontSize: '0.95rem', color: '#60a5fa' }}>{dispute.votesForClaimant || 0}</strong>
                        </div>
                        <div style={{ flex: 1, background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '0.4rem', borderRadius: '4px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.6', color: '#aaa', display: 'block' }}>Votes for Respondent</span>
                          <strong style={{ fontSize: '0.95rem', color: '#f87171' }}>{dispute.votesForRespondent || 0}</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button 
                          onClick={() => handleCastJuryVote(dispute.id, 'claimant')}
                          className="btn-gold"
                          style={{ flex: 1, padding: '0.25rem 0.5rem', fontSize: '0.7rem', background: '#2563eb', border: '1px solid #2563eb', color: '#fff', cursor: 'pointer' }}
                        >
                          Vote Claimant
                        </button>
                        <button 
                          onClick={() => handleCastJuryVote(dispute.id, 'respondent')}
                          className="btn-gold"
                          style={{ flex: 1, padding: '0.25rem 0.5rem', fontSize: '0.7rem', background: '#dc2626', border: '1px solid #dc2626', color: '#fff', cursor: 'pointer' }}
                        >
                          Vote Respondent
                        </button>
                        <button 
                          onClick={() => handleAutoResolveJury(dispute.id)}
                          className="btn-gold"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', cursor: 'pointer' }}
                        >
                          ⚡ Auto-Consensus
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {dispute.status === 'pending' && currentUser?.role === 'landlord' && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.8rem' }}>
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
